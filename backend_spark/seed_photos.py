#!/usr/bin/env python3
"""
Seed product PHOTOS only.

Reads a CSV describing products and where to fetch their images from, downloads
3–5 consistent photos for each product, de-duplicates by perceptual hash,
and writes files to:

  electronics-store/src/main/resources/seed/products/{CATEGORY}/{INDEX}/{k}.jpg

CSV format (headers required):

mode,category,index,product_name,image_urls,product_page_url
- mode: "urls" or "scrape"
- category: one of your ProductCategory enum values (e.g. LAPTOPS)
- index: 1..N (the per-category folder name in the seeder)
- product_name: free text (used in logs only)
- image_urls: (mode=urls) comma-or-space separated direct image URLs
- product_page_url: (mode=scrape) URL of a page that has the product gallery

Example rows:
urls,LAPTOPS,1,"Acer Swift 3","https://.../front.jpg https://.../side.jpg https://.../back.jpg",
scrape,SMARTPHONES,2,"Galaxy S23",,"https://www.samsung.com/ro/smartphones/galaxy-s23/"

Usage:
  python seed_photos.py --csv products_seed.csv --min 3 --max 5
"""

import argparse
import csv
import io
import os
import re
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from PIL import Image, ImageOps
import imagehash
from bs4 import BeautifulSoup

# ===== config =====
PROJECT_ROOT = Path(__file__).resolve().parent
OUT_ROOT = PROJECT_ROOT / "electronics-store" / "src" / "main" / "resources" / "seed" / "products"
TIMEOUT = 20
HEADERS = {
    "User-Agent": "Mozilla/5.0 (+photo seeder)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
}


def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)


def fetch_bytes(url: str) -> bytes | None:
    try:
        r = requests.get(url, headers=HEADERS, timeout=TIMEOUT, stream=True)
        r.raise_for_status()
        return r.content
    except Exception as e:
        print(f"  ! download failed {url}: {e}")
        return None


def is_probably_same_product_hashes(hashes, threshold=18):
    """
    Given a list of (phash, w, h), drop items that are 'far' from the cluster.
    We simply keep images whose median distance to others <= threshold.
    """
    if len(hashes) <= 2:
        return [True] * len(hashes)

    kept = []
    for i, (h_i, *_rest) in enumerate(hashes):
        dists = []
        for j, (h_j, *_rest2) in enumerate(hashes):
            if i == j:
                continue
            dists.append(h_i - h_j)  # hamming distance
        median = sorted(dists)[len(dists) // 2]
        kept.append(median <= threshold)
    return kept


def load_image_normalize_jpg(raw: bytes) -> Image.Image | None:
    try:
        im = Image.open(io.BytesIO(raw))
        im = ImageOps.exif_transpose(im).convert("RGB")  # fix rotations & ensure RGB
        return im
    except Exception:
        return None


def score_image(im: Image.Image) -> tuple[int, int, float]:
    w, h = im.size
    area = w * h
    aspect = w / h if h else 0
    # prefer area close to product-like ratios (not too panoramic)
    aspect_penalty = 0.0
    if aspect < 0.5 or aspect > 2.0:
        aspect_penalty = 0.3
    return (area, min(w, h), aspect_penalty)


def clean_urls_field(s: str) -> list[str]:
    if not s:
        return []
    parts = re.split(r"[,\s]+", s.strip())
    return [p for p in parts if p]


def absolute_urls(base: str, urls: list[str]) -> list[str]:
    return [urljoin(base, u) if urlparse(u).scheme == "" else u for u in urls]


def extract_images_from_html(page_url: str, html: str) -> list[str]:
    urls = set()
    soup = BeautifulSoup(html, "lxml")

    # 1) JSON-LD Product images
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            import json
            data = json.loads(tag.string or "")
            # could be list or dict
            items = data if isinstance(data, list) else [data]
            for obj in items:
                if not isinstance(obj, dict):
                    continue
                imgs = obj.get("image")
                if isinstance(imgs, str):
                    urls.add(imgs)
                elif isinstance(imgs, list):
                    for u in imgs:
                        if isinstance(u, str):
                            urls.add(u)
        except Exception:
            pass

    # 2) OpenGraph (og:image)
    for m in soup.find_all("meta"):
        prop = (m.get("property") or m.get("name") or "").lower()
        if prop in ("og:image", "twitter:image", "og:image:url"):
            content = m.get("content")
            if content:
                urls.add(content)

    # 3) Common gallery selectors (very generic)
    for sel in ["img", "source"]:
        for tag in soup.select(sel):
            for attr in ["srcset", "data-srcset", "src", "data-src"]:
                val = tag.get(attr)
                if not val:
                    continue
                # srcset → pick largest last URL
                if "srcset" in attr and "," in val:
                    candidates = [p.strip().split(" ")[0] for p in val.split(",")]
                    for c in candidates:
                        urls.add(c)
                else:
                    urls.add(val)

    # absolutize
    abs_urls = absolute_urls(page_url, list(urls))

    # filter obvious sprites/icons
    filtered = []
    for u in abs_urls:
        low = u.lower()
        if any(x in low for x in ["sprite", "icon", "logo", "placeholder", "thumb"]):
            continue
        if low.endswith((".jpg", ".jpeg", ".png", ".webp", ".avif")):
            filtered.append(u)
    return filtered


def scrape_gallery(page_url: str) -> list[str]:
    try:
        r = requests.get(page_url, headers=HEADERS, timeout=TIMEOUT)
        r.raise_for_status()
    except Exception as e:
        print(f"  ! failed to fetch page {page_url}: {e}")
        return []
    urls = extract_images_from_html(page_url, r.text)
    # prefer biggest by filename hints
    def size_hint(u: str) -> int:
        m = re.search(r"(\d{3,4})[xX](\d{3,4})", u)
        if m:
            return int(m.group(1)) * int(m.group(2))
        return 0
    urls = sorted(set(urls), key=size_hint, reverse=True)
    return urls


def pick_and_write(images: list[bytes], out_dir: Path, min_n: int, max_n: int):
    # Load & score
    work = []
    for raw in images:
        im = load_image_normalize_jpg(raw)
        if not im:
            continue
        w, h = im.size
        if min(w, h) < 400:
            # skip tiny assets
            continue
        ph = imagehash.phash(im)
        area, short_side, aspect_penalty = score_image(im)
        work.append((ph, area, short_side, aspect_penalty, im))

    if not work:
        return 0

    # remove outliers by phash median distance
    keep_mask = is_probably_same_product_hashes([(w[0], w[1], w[2]) for w in work], threshold=18)
    work = [w for w, keep in zip(work, keep_mask) if keep]

    # sort: bigger area desc, then short side desc, then lower aspect penalty
    work.sort(key=lambda t: (t[1], t[2], -t[3]), reverse=True)

    selected = work[:max_n]
    if len(selected) < min_n:
        # if we filtered too aggressively, fall back to best available
        selected = work[:min_n]

    ensure_dir(out_dir)
    count = 0
    for idx, (_ph, _area, _short, _pen, im) in enumerate(selected, start=1):
        out = out_dir / f"{idx}.jpg"
        # save reasonably compressed
        im.save(out, format="JPEG", quality=88, optimize=True, progressive=True)
        count += 1
    return count


def main():
    ap = argparse.ArgumentParser(description="Seed product photos")
    ap.add_argument("--csv", required=True, help="Path to CSV with products to fetch")
    ap.add_argument("--min", type=int, default=3, help="Minimum photos per product")
    ap.add_argument("--max", type=int, default=5, help="Maximum photos per product")
    args = ap.parse_args()

    with open(args.csv, newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        for row in rdr:
            mode = (row.get("mode") or "").strip().lower()
            category = (row.get("category") or "").strip()
            index = (row.get("index") or "").strip()
            name = (row.get("product_name") or "").strip()
            image_urls_field = row.get("image_urls") or ""
            page_url = (row.get("product_page_url") or "").strip()

            if not category or not index:
                print(f"[SKIP] missing category/index: {row}")
                continue

            out_dir = OUT_ROOT / category / index
            print(f"\n[{category}/{index}] {name}")

            urls: list[str] = []
            if mode == "urls":
                urls = clean_urls_field(image_urls_field)
            elif mode == "scrape":
                if not page_url:
                    print("  ! scrape mode without product_page_url")
                    continue
                urls = scrape_gallery(page_url)
            else:
                print(f"  ! unknown mode '{mode}', expected 'urls' or 'scrape'")
                continue

            if not urls:
                print("  ! no candidate image URLs found")
                continue

            # fetch bytes for candidates (stop after ~12 to keep it quick)
            photos = []
            for u in urls[:12]:
                raw = fetch_bytes(u)
                if raw:
                    photos.append(raw)

            if not photos:
                print("  ! failed to download any images")
                continue

            wrote = pick_and_write(photos, out_dir, args.min, args.max)
            print(f"  -> wrote {wrote} image(s) to {out_dir}")


if __name__ == "__main__":
    sys.exit(main())
