package com.spark.electronics_store;

import com.spark.electronics_store.dto.BrandRequestCreateDto;
import com.spark.electronics_store.model.*;
import com.spark.electronics_store.repository.BrandRepository;
import com.spark.electronics_store.repository.ProductPhotoRepository;
import com.spark.electronics_store.repository.ProductRepository;
import com.spark.electronics_store.repository.UserSyncRepository;
import com.spark.electronics_store.service.BrandRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

@SpringBootApplication
@RequiredArgsConstructor
public class ElectronicsStoreApplication {

	public static void main(String[] args) {
		SpringApplication.run(ElectronicsStoreApplication.class, args);
	}

	private final BrandRepository brandRepo;
	private final ProductRepository productRepo;
	private final ProductPhotoRepository photoRepo;
	private final UserSyncRepository userSyncRepo;
	private final BrandRequestService brandRequestService;

	@Value("${seed.store.enabled:true}")
	private boolean seedEnabled;

	@Value("${seed.store.reset:true}")
	private boolean seedReset;

	@Value("${seed.store.brands-csv:brands.csv}")
	private String brandsCsv;

	@Value("${seed.store.products-csv:products.csv}")
	private String productsCsv;

	@Value("${seed.store.photos-root:seed/products}")
	private String photosRoot;

	// NEW: wait config for user sync
	@Value("${seed.store.user-sync-timeout-ms:30000}")
	private long userSyncTimeoutMs;

	@Value("${seed.store.user-sync-poll-ms:1000}")
	private long userSyncPollMs;

	@org.springframework.context.annotation.Bean
	public CommandLineRunner seedRunner() {
		return args -> {
			if (!seedEnabled) return;
			seedAll();
		};
	}

	@Transactional
	protected void seedAll() throws Exception {
		if (seedReset) {
			photoRepo.deleteAll();
			productRepo.deleteAll();
			brandRepo.deleteAll();
			// NOTE: we do NOT clear user_sync or brand_requests — they come from sync and approvals.
		}

		// 1) Seed BRANDS from CSV (build slug → Brand map)
		Map<String, Brand> brandBySlug = new LinkedHashMap<>();
		for (Map<String, String> r : readCsv(brandsCsv)) {
			String name = val(r, "name");
			String slug = val(r, "slug");
			String logoUrl = val(r, "logo_url");
			if (slug.isBlank()) slug = slugify(name);

			Brand b = brandRepo.findBySlug(slug).orElseGet(Brand::new);
			b.setName(name);
			b.setSlug(slug);
			b.setLogoUrl(logoUrl);
			b = brandRepo.save(b);
			brandBySlug.put(slug, b);
		}

		// 2) Seed PRODUCTS from CSV (order matters for photo folders)
		Map<String, List<Product>> perCatOrdered = new LinkedHashMap<>();
		for (Map<String, String> r : readCsv(productsCsv)) {
			UUID id = asUuid(r.get("id"));
			String name = val(r, "name");
			String slug = val(r, "slug");
			String desc = r.getOrDefault("description", "");
			BigDecimal price = asBigDecimal(r.get("price"));
			String currency = val(r, "currency");
			String catStr = val(r, "category");
			if (catStr.isBlank()) continue;
			ProductCategory category = ProductCategory.valueOf(catStr);

			String statusStr = r.getOrDefault("status", "ACTIVE");
			ProductStatus status = ProductStatus.valueOf(statusStr);
			boolean deleted = Boolean.parseBoolean(r.getOrDefault("deleted", "false"));

			String brandSlug = val(r, "brand_slug");
			if (brandSlug.isBlank()) brandSlug = guessBrandSlug(name);
			Brand brand = brandBySlug.get(brandSlug);
			if (brand == null) {
				Brand nb = new Brand();
				nb.setName(capitalizeWords(brandSlug.replace('-', ' ')));
				nb.setSlug(brandSlug);
				brand = brandRepo.save(nb);
				brandBySlug.put(brandSlug, brand);
			}

			Product p = (id != null ? productRepo.findById(id).orElse(null) : null);
			if (p == null) {
				p = new Product();
				p.setId(id != null ? id : UUID.randomUUID());
			}
			p.setBrand(brand);
			p.setName(name);
			p.setSlug(slug);
			p.setDescription(desc);
			p.setPrice(price);
			p.setCurrency(currency);
			p.setCategory(category);
			p.setStatus(status == null ? ProductStatus.ACTIVE : status);
			p.setDeleted(deleted);

			p = productRepo.save(p);
			perCatOrdered.computeIfAbsent(category.name(), k -> new ArrayList<>()).add(p);
		}

		// 3) PHOTOS (classpath: seed/products/<CATEGORY>/<INDEX>/1..9.(jpg|jpeg|png))
		for (var e : perCatOrdered.entrySet()) {
			String cat = e.getKey();
			List<Product> list = e.getValue();
			for (int i = 0; i < list.size(); i++) {
				Product product = list.get(i);
				String idx = String.format("%03d", i + 1);
				String dir = photosRoot + "/" + cat + "/" + idx;

				var dirRes = new ClassPathResource(dir);
				if (!dirRes.exists()) continue;

				photoRepo.deleteAll(photoRepo.findByProduct_IdOrderByPositionAsc(product.getId()));

				int pos = 0;
				boolean primarySet = false;
				for (String base : List.of("1","2","3","4","5","6","7","8","9")) {
					for (String ext : List.of("jpg","jpeg","png")) {
						var fileRes = new ClassPathResource(dir + "/" + base + "." + ext);
						if (!fileRes.exists()) continue;
						try (InputStream is = fileRes.getInputStream()) {
							byte[] bytes = is.readAllBytes();
							ProductPhoto ph = ProductPhoto.builder()
									.id(UUID.randomUUID())
									.product(product)
									.filename(base + "." + ext)
									.contentType(ext.equalsIgnoreCase("png") ? MediaType.IMAGE_PNG_VALUE : MediaType.IMAGE_JPEG_VALUE)
									.data(bytes)
									.position(pos)
									.primary(!primarySet && pos == 0)
									.build();
							photoRepo.save(ph);
							pos++;
							if (!primarySet) primarySet = true;
						} catch (Exception ignored) {}
					}
				}
			}
		}

		// 4) WAIT for all expected sellers to be synced into user_sync
		Set<String> expectedSellerEmails = new LinkedHashSet<>();
		for (String slug : brandBySlug.keySet()) {
			expectedSellerEmails.add(slug + "-seller@noreply.local");
		}
		// we also want the admin present, to capture its UUID as reviewer
		expectedSellerEmails.add("admin@admin.com");

		waitForUsers(expectedSellerEmails, userSyncTimeoutMs, userSyncPollMs);

		// Determine reviewer: admin UUID if present, else email fallback
		final String adminReviewer = userSyncRepo.findByEmailIgnoreCase("admin@admin.com")
				.map(u -> u.getId().toString())
				.orElse("admin@admin.com");

		// 5) For each seller, create a real PENDING request then APPROVE it (this will assign brand & role)
		int createdPending = 0, approved = 0, ensured = 0;
		for (String email : expectedSellerEmails) {
			if (!email.endsWith("-seller@noreply.local")) continue;

			Optional<UserSync> userOpt = userSyncRepo.findByEmailIgnoreCase(email);
			if (userOpt.isEmpty()) continue;
			UserSync seller = userOpt.get();

			// Map email slug back to a brand
			String slug = email.replace("-seller@noreply.local", "");
			Brand brand = brandBySlug.get(slug);
			if (brand == null) continue; // shouldn't happen, but guard

			try {
				if (seller.getBrand() == null) {
					// Create a real PENDING request
					BrandRequestCreateDto dto = new BrandRequestCreateDto();
					dto.setName(brand.getName());
					dto.setSlug(brand.getSlug());
					dto.setLogoUrl(brand.getLogoUrl());

					var pending = brandRequestService.submitRequest(dto, seller.getId());
					createdPending++;

					// Approve it as admin
					brandRequestService.approve(pending.getId(), adminReviewer);
					approved++;
					System.out.println("[seed] approved brand request for " + email + " → '" + brand.getSlug() + "'");
				} else {
					// Seller already has a brand — ensure an APPROVED record exists
					brandRequestService.ensureApprovedRecordFor(seller.getId(), brand, adminReviewer);
					ensured++;
				}
			} catch (Exception e) {
				System.err.println("[seed] request/approval flow failed for " + email + ": " + e.getMessage());
			}
		}

		System.out.println("[seed] PENDING created: " + createdPending + ", APPROVED: " + approved + ", ensured existing: " + ensured);
		System.out.println("[seed] brands/products/photos complete ✓");
	}

	// --------- waiting for user sync ---------
	private void waitForUsers(Set<String> emails, long timeoutMs, long pollMs) {
		if (emails.isEmpty()) return;

		long deadline = System.currentTimeMillis() + Math.max(0, timeoutMs);
		Set<String> missing = new LinkedHashSet<>(emails);

		while (true) {
			Iterator<String> it = missing.iterator();
			while (it.hasNext()) {
				String email = it.next();
				if (userSyncRepo.findByEmailIgnoreCase(email).isPresent()) {
					it.remove();
				}
			}
			if (missing.isEmpty()) {
				System.out.println("[seed] all expected users are present (" + emails.size() + ")");
				return;
			}
			if (System.currentTimeMillis() >= deadline) {
				System.out.println("[seed] timed out waiting for users. Still missing: " + missing);
				return; // continue anyway; we'll still do best-effort below
			}
			try { Thread.sleep(Math.max(100, pollMs)); } catch (InterruptedException ignored) {}
		}
	}

	// ---------- helpers ----------
	private static List<Map<String, String>> readCsv(String resource) throws Exception {
		var res = new ClassPathResource(resource);
		if (!res.exists()) return List.of();
		try (var br = new BufferedReader(new InputStreamReader(res.getInputStream(), StandardCharsets.UTF_8))) {
			String header = br.readLine();
			if (header == null) return List.of();
			String[] cols = header.split(",", -1);
			List<Map<String, String>> rows = new ArrayList<>();
			String line;
			while ((line = br.readLine()) != null) {
				String[] vals = splitCsvLine(line);
				Map<String, String> m = new LinkedHashMap<>();
				for (int i = 0; i < cols.length; i++) {
					m.put(cols[i].trim(), i < vals.length ? unquote(vals[i]) : "");
				}
				rows.add(m);
			}
			return rows;
		}
	}

	private static String[] splitCsvLine(String line) {
		List<String> out = new ArrayList<>();
		StringBuilder cur = new StringBuilder();
		boolean inQ = false;
		for (int i = 0; i < line.length(); i++) {
			char c = line.charAt(i);
			if (c == '"') inQ = !inQ;
			else if (c == ',' && !inQ) { out.add(cur.toString()); cur.setLength(0); }
			else cur.append(c);
		}
		out.add(cur.toString());
		return out.toArray(new String[0]);
	}

	private static String unquote(String s) {
		String t = s == null ? "" : s.trim();
		if (t.startsWith("\"") && t.endsWith("\"") && t.length() >= 2) {
			t = t.substring(1, t.length() - 1);
		}
		return t;
	}

	private static String val(Map<String, String> m, String k) {
		return Optional.ofNullable(m.get(k)).orElse("").trim();
	}

	private static java.util.UUID asUuid(String s) {
		try { return (s == null || s.isBlank()) ? null : java.util.UUID.fromString(s.trim()); }
		catch (Exception e) { return null; }
	}

	private static BigDecimal asBigDecimal(String s) {
		try { return (s == null || s.isBlank()) ? null : new BigDecimal(s.trim()); }
		catch (Exception e) { return null; }
	}

	private static String slugify(String s) {
		String t = (s == null ? "" : s).toLowerCase(Locale.ROOT).trim();
		t = t.replace('&', ' ').replace('+', ' ').replace('_', '-');
		t = t.replaceAll("[^a-z0-9\\-\\s]", "");
		t = t.replaceAll("\\s+", "-");
		t = t.replaceAll("-{2,}", "-");
		return t.replaceAll("(^-+|-+$)", "");
	}

	private static String guessBrandSlug(String productName) {
		String n = productName == null ? "" : productName.toLowerCase(Locale.ROOT);
		String[][] map = {
				{"apple", "apple"},{"samsung", "samsung"},{"google", "google"},{"dell", "dell"},
				{"lenovo", "lenovo"},{"hp", "hp"},{"sony", "sony"},{"lg", "lg"},
				{"nvidia", "nvidia"},{"amd", "amd"},{"corsair", "corsair"},{"brother", "brother"},
				{"canon", "canon"},{"seagate", "seagate"},{"tp-link", "tp-link"},{"tplink", "tp-link"},
				{"netgear", "netgear"},{"ubiquiti", "ubiquiti"},{"logitech", "logitech"},{"keychron", "keychron"},
				{"anker", "anker"},{"jbl", "jbl"},{"bose", "bose"},{"nikon", "nikon"},
				{"razer", "razer"},{"microsoft", "microsoft"},{"philips", "philips"},
				{"instant pot", "instant-pot"},{"dyson", "dyson"},{"niu", "niu"},{"dji", "dji"}
		};
		for (String[] kv : map) if (n.contains(kv[0])) return kv[1];
		String first = n.split("\\s+")[0];
		return slugify(first);
	}

	private static String capitalizeWords(String s) {
		String[] parts = (s == null ? "" : s).trim().split("\\s+");
		StringBuilder out = new StringBuilder();
		for (String p : parts) {
			if (p.isBlank()) continue;
			out.append(Character.toUpperCase(p.charAt(0))).append(p.length() > 1 ? p.substring(1) : "").append(' ');
		}
		return out.toString().trim();
	}
}
