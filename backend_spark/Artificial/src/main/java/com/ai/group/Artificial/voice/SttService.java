package com.ai.group.Artificial.voice;

import ai.djl.Device;
import ai.djl.inference.Predictor;
import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;
import ai.djl.ndarray.NDManager;
import ai.djl.ndarray.types.DataType;
import ai.djl.ndarray.types.Shape;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ZooModel;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.codec.language.DoubleMetaphone;
import org.apache.commons.text.similarity.JaroWinklerSimilarity;
import org.apache.commons.text.similarity.LevenshteinDistance;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class SttService implements AutoCloseable {

    private final ZooModel<NDList, NDList> model;
    private final Predictor<NDList, NDList> predictor;

    private final int blankId;
    private final String[] id2token;            // index -> token
    private final Map<String, String> canon;    // lower -> cased
    private final List<String> phrases;         // known product titles (lowercased)
    private final List<String> lexWords;        // catalog words (lowercased)

    // New: indexes and priors for smarter autocomplete/snapping
    private final Map<String, List<String>> byPrefix = new HashMap<>(); // "mi" -> [microsoft, micro, ...]
    private final Map<String, Integer> priors = new HashMap<>();        // word -> freq weight
    private final DoubleMetaphone dmeta = new DoubleMetaphone();
    private final JaroWinklerSimilarity jws = new JaroWinklerSimilarity();

    // Tuning
    private final int wordSnapThreshold = 84;   // legacy threshold (kept for compatibility; not used directly now)
    private final int phraseSnapThreshold = 92; // phrase-level set ratio-ish threshold
    private static final LevenshteinDistance LD = new LevenshteinDistance();

    // New tuning knobs for the combined scorer
    private final int minPrefixBucket = 2;      // use first N letters as a candidate bucket key
    private final int maxLenDelta = 3;          // ignore candidates that differ in length by > this
    private final double snapScore = 0.78;      // combined score cutoff (0..1+)

    public SttService() throws Exception {
        // --- load TorchScript (with normalization baked in) ---
        File pt = copyResourceToTemp("voice_model/stt_en_with_norm.pt", ".pt");
        Criteria<NDList, NDList> c = Criteria.builder()
                .setTypes(NDList.class, NDList.class)
                .optModelPath(pt.toPath())
                .optEngine("PyTorch")
                .build();
        this.model = c.loadModel();
        this.predictor = model.newPredictor();

        // --- load vocab ---
        ObjectMapper om = new ObjectMapper();
        Map<String, Object> meta = om.readValue(
                new ClassPathResource("voice_model/stt_en_vocab.json").getInputStream(),
                new TypeReference<>() {});

        @SuppressWarnings("unchecked")
        Map<String, String> id2tokMap = (Map<String, String>) meta.get("id2token");
        int V = id2tokMap.keySet().stream().mapToInt(k -> Integer.parseInt(k)).max().orElse(0) + 1;
        this.id2token = new String[V];
        id2tokMap.forEach((k, v) -> {
            int id = Integer.parseInt(k);
            if (id >= 0 && id < V) id2token[id] = v;
        });
        this.blankId = ((Number) meta.get("blank_id")).intValue();
        if (blankId >= 0 && blankId < id2token.length) {
            id2token[blankId] = ""; // CTC blank
        }

        // --- load bias artifacts ---
        this.canon = om.readValue(
                new ClassPathResource("voice_model/asr_canon_words.json").getInputStream(),
                new TypeReference<Map<String, String>>() {});
        this.phrases = readLines("voice_model/asr_phrases.txt");
        List<String> hotwords = om.readValue(
                new ClassPathResource("voice_model/asr_hotwords.json").getInputStream(),
                new TypeReference<List<String>>() {});

        // --- build lexicon (lowercase) ---
        this.lexWords = buildLexicon(hotwords, phrases, canon.keySet());

        // --- build prefix buckets for fast candidate narrowing ---
        buildIndexes();

        // --- (optional) load brand/product CSV priors if present ---
        // Put a CSV at resources/voice_model/catalog.csv with lines like:
        // brand,product title,frequency
        // Microsoft,Surface Pro 9,50
        ClassPathResource catalogCsv = new ClassPathResource("voice_model/catalog.csv");
        if (catalogCsv.exists()) {
            try (InputStream in = catalogCsv.getInputStream()) {
                loadBrandProductCsv(in);
            } catch (Exception ignore) { /* non-fatal */ }
        }

        // --- warmup (optional) ---
        try (NDManager mgr = NDManager.newBaseManager(Device.cpu())) {
            NDArray x = mgr.zeros(new Shape(1, 16000)); // 1s silence
            predictor.predict(new NDList(x));
        }
    }

    // ---------- Public API ----------
    /** Accept raw WAV bytes (16k mono PCM16) and return greedy + snapped text and simple timing. */
    public Map<String, Object> transcribe(byte[] wavBytes) throws Exception {
        long t0 = System.nanoTime();
        float[] audio = WavUtil.readPcm16Mono16k(new ByteArrayInputStream(wavBytes)); // IO parse
        long t1 = System.nanoTime();

        try (NDManager mgr = NDManager.newBaseManager(Device.cpu())) {
            NDArray x = mgr.create(audio, new Shape(1, audio.length)); // [1,T]
            NDList out = predictor.predict(new NDList(x));
            NDArray logits = out.head();                                // typically [1,L,V] or [L,V]

            String greedy = decodeGreedy(logits);
            String fixed  = finalFix(greedy);

            long t2 = System.nanoTime();
            Map<String, Object> resp = new LinkedHashMap<>();
            resp.put("greedy", greedy);
            resp.put("fixed", fixed);
            resp.put("io_ms", (t1 - t0) / 1_000_000);
            resp.put("model_ms", (t2 - t1) / 1_000_000);
            return resp;
        }
    }

    @Override public void close() {
        predictor.close();
        model.close();
    }

    // ---------- Internals ----------
    private static File copyResourceToTemp(String cp, String suffix) throws IOException {
        File tmp = File.createTempFile("asr-", suffix);
        tmp.deleteOnExit();
        try (InputStream in = new ClassPathResource(cp).getInputStream()) {
            Files.copy(in, tmp.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        return tmp;
    }

    private static List<String> readLines(String cp) throws IOException {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(new ClassPathResource(cp).getInputStream()))) {
            List<String> out = new ArrayList<>();
            String s; while ((s = br.readLine()) != null) {
                s = s.trim(); if (!s.isEmpty()) out.add(s.toLowerCase(Locale.ROOT));
            }
            return out;
        }
    }

    private static List<String> buildLexicon(List<String> hot, List<String> phr, Collection<String> canonKeys) {
        Set<String> bag = new LinkedHashSet<>();
        extractWords(hot, bag);
        extractWords(phr, bag);
        for (String k : canonKeys) bag.add(k.toLowerCase(Locale.ROOT));
        return new ArrayList<>(bag);
    }

    private static void extractWords(List<String> strings, Set<String> out) {
        for (String s : strings) {
            for (String w : s.toLowerCase(Locale.ROOT).split("[^a-z0-9]+")) {
                if (w.length() >= 1 && w.length() <= 40) out.add(w);
            }
        }
    }

    private void buildIndexes() {
        for (String w : lexWords) {
            String lw = w.toLowerCase(Locale.ROOT);
            String key = lw.length() >= minPrefixBucket ? lw.substring(0, minPrefixBucket) : lw;
            byPrefix.computeIfAbsent(key, k -> new ArrayList<>()).add(lw);
        }
        // Optional: sort each bucket by length then alpha to make early exits more likely
        for (List<String> lst : byPrefix.values()) {
            lst.sort(Comparator.<String>comparingInt(String::length).thenComparing(Comparator.naturalOrder()));
        }
    }

    private void loadBrandProductCsv(InputStream in) throws IOException {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(in))) {
            String line;
            while ((line = br.readLine()) != null) {
                String[] parts = line.split(",", -1);
                if (parts.length < 2) continue;
                String brand = parts[0].trim().toLowerCase(Locale.ROOT);
                String product = parts[1].trim().toLowerCase(Locale.ROOT);

                if (!brand.isEmpty()) priors.merge(brand, 5, Integer::sum);
                if (!product.isEmpty()) {
                    for (String w : product.split("[^a-z0-9]+")) {
                        if (!w.isEmpty()) priors.merge(w, 1, Integer::sum);
                    }
                }
                // Optional frequency column (parts[2]) to scale boosts
                if (parts.length >= 3) {
                    try {
                        int freq = Math.max(0, Integer.parseInt(parts[2].trim()));
                        if (!brand.isEmpty()) priors.merge(brand, freq, Integer::sum);
                    } catch (NumberFormatException ignore) {}
                }
            }
        }
    }

    /**
     * Greedy CTC decode with repeat + blank collapse.
     * Handles logits shaped [1,L,V] or [L,V]. Casts argmax to INT32 before toIntArray().
     */
    private String decodeGreedy(NDArray logits) {
        NDArray scores = logits;

        // Squeeze batch if present: [1,L,V] -> [L,V]
        Shape sh = scores.getShape();
        if (sh.dimension() == 3 && sh.get(0) == 1) {
            scores = scores.squeeze(0);
        }

        // Now expect [L,V]
        NDArray idsNd = scores.argMax(-1); // [L], often INT64 from PyTorch backend

        // Cast to INT32 to satisfy toIntArray()
        if (idsNd.getDataType() != DataType.INT32) {
            idsNd = idsNd.toType(DataType.INT32, false);
        }

        int[] ids = idsNd.toIntArray();

        StringBuilder sb = new StringBuilder();
        int prev = -1;
        for (int id : ids) {
            if (id == blankId || id == prev) { prev = id; continue; }
            String tok = (id >= 0 && id < id2token.length && id2token[id] != null) ? id2token[id] : "";
            sb.append(tok);
            prev = id;
        }
        return sb.toString().replace('|', ' ').replaceAll("\\s+", " ").trim();
    }

    // ---------- New snapping logic (autocomplete + fuzzy + phonetic + priors) ----------

    private String snapWords(String text) {
        if (text.isEmpty()) return text;
        String[] words = text.split("\\s+");
        List<String> out = new ArrayList<>(words.length);
        for (String w : words) {
            String fix = snapOneWord(w);
            if (!fix.isEmpty()) out.add(fix);
        }
        return String.join(" ", out);
    }

    private String snapOneWord(String w) {
        String lw = w.toLowerCase(Locale.ROOT);
        if (lw.isEmpty()) return "";

        // candidate bucket by prefix
        String bucketKey = lw.length() >= minPrefixBucket ? lw.substring(0, minPrefixBucket) : lw;
        List<String> bucket = byPrefix.getOrDefault(bucketKey, Collections.emptyList());
        if (bucket.isEmpty()) return ""; // nothing plausible

        String best = null;
        double bestScore = -1.0;

        // precompute phonetic for input
        String metaIn = safeMeta(lw);

        for (String cand : bucket) {
            if (Math.abs(cand.length() - lw.length()) > maxLenDelta) continue;
            if (!cand.isEmpty() && !lw.isEmpty() && cand.charAt(0) != lw.charAt(0)) continue;

            // components
            double editSim = editSimilarity(lw, cand);      // 0..1
            double jw = jaroWinkler(lw, cand);              // 0..1
            double prefixSim = prefixCoverage(lw, cand);    // 0..1
            double phonetic = metaIn.equals(safeMeta(cand)) ? 1.0 : 0.0;
            double prior = priorWeight(cand);               // 0..~0.2

            // blend (tunable)
            double score = 0.45 * editSim
                    + 0.15 * jw
                    + 0.20 * prefixSim
                    + 0.15 * phonetic
                    + 0.05 * prior;

            // strong autocomplete bonus when cand starts with input
            if (cand.startsWith(lw) && editSim > 0.6) score += 0.08;

            if (score > bestScore) {
                bestScore = score;
                best = cand;
            }
        }

        if (best != null && bestScore >= snapScore) {
            // apply canonical casing if available
            return canon.getOrDefault(best, canon.getOrDefault(best.toLowerCase(Locale.ROOT), best));
        }
        return ""; // unknown → drop (keeps titles focused)
    }

    private String phraseSnap(String text) {
        if (text.isEmpty() || phrases.isEmpty()) return text;
        Set<String> A = new LinkedHashSet<>(Arrays.asList(text.toLowerCase(Locale.ROOT).split("\\s+")));
        String best = null; double bestScore = -1;
        for (String ph : phrases) {
            Set<String> B = new LinkedHashSet<>(Arrays.asList(ph.split("\\s+")));
            if (Collections.disjoint(A, B)) continue; // quick prune
            int inter = 0; for (String a : A) if (B.contains(a)) inter++;
            double score = 100.0 * (2.0 * inter) / (A.size() + B.size()); // token-set ratio-ish
            if (score > bestScore) { bestScore = score; best = ph; }
        }
        if (best != null && bestScore >= phraseSnapThreshold) {
            StringBuilder sb = new StringBuilder();
            for (String w : best.split("\\s+"))
                sb.append(canon.getOrDefault(w, canon.getOrDefault(w.toLowerCase(Locale.ROOT), w))).append(' ');
            return sb.toString().trim();
        }
        return text;
    }

    private String finalFix(String greedy) {
        String snapped = snapWords(greedy); // improved word-level snapping
        return phraseSnap(snapped);         // then phrase-level selection
    }

    // ---------- helpers for scoring ----------

    private String safeMeta(String s) {
        try { return dmeta.encode(s); } catch (Exception e) { return ""; }
    }

    private double editSimilarity(String a, String b) {
        int dist = LD.apply(a, b);
        int m = Math.max(1, Math.max(a.length(), b.length()));
        return 1.0 - ((double) dist / (double) m);
    }

    private double prefixCoverage(String a, String b) {
        int n = Math.min(a.length(), b.length());
        int i = 0;
        while (i < n && a.charAt(i) == b.charAt(i)) i++;
        return n == 0 ? 0 : (double) i / (double) n; // 0..1 of shared prefix
    }

    private double jaroWinkler(String a, String b) {
        try {
            Double v = jws.apply(a, b);
            return v == null ? 0.0 : v;
        } catch (Exception e) {
            return 0.0;
        }
    }

    private double priorWeight(String cand) {
        int f = priors.getOrDefault(cand, 0);
        // small diminishing returns boost (0..~0.2)
        return Math.min(0.2, Math.log1p(f) / 10.0);
    }
}
