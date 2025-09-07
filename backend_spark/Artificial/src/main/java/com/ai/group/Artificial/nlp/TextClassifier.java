// com/ai/group/Artificial/nlp/TextClassifier.java
package com.ai.group.Artificial.nlp;

import ai.djl.Application;
import ai.djl.Device;
import ai.djl.MalformedModelException;
import ai.djl.ModelException;
import ai.djl.inference.Predictor;
import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;
import ai.djl.ndarray.NDManager;
import ai.djl.ndarray.types.DataType;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ModelNotFoundException;
import ai.djl.repository.zoo.ZooModel;
import ai.djl.translate.NoopTranslator;
import ai.djl.util.Utils;
import com.ai.group.Artificial.admin.service.AdminRequestService;
import com.ai.group.Artificial.nlp.dto.ClassificationResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class TextClassifier {
    private final AdminRequestService adminRequestService;
    // ===== fixed intent codes (must match trainer)
    public static final int HELP_CATEGORY      = 0;
    public static final int HELP_LOGIN         = 1;
    public static final int HELP_LOGOUT        = 2;
    public static final int HELP_ADMIN         = 3;
    public static final int HELP_REGISTER      = 4;
    public static final int HELP_VOICE         = 5;
    public static final int HELP_ORDER         = 6;
    public static final int HELP_REQUEST_BRAND = 7;

    // ===== resources
    private static final String ROOT = "nlp_model/";
    private static final String INT_MODEL = ROOT + "intent_model.pt";
    private static final String INT_META  = ROOT + "intent_meta.json";
    private static final String INT_ID2   = ROOT + "id2intent.json";

    private static final String CAT_MODEL = ROOT + "category_model.pt";
    private static final String CAT_META  = ROOT + "category_meta.json";
    private static final String CAT_ID2   = ROOT + "id2category.json";
    private static final String CAT_FULL  = ROOT + "categories.json";

    private Path tempDir;

    // heads
    private ZooModel<NDList, NDList> intentHead;
    private ZooModel<NDList, NDList> categoryHead;

    // encoders
    private Encoder intentEncoder;
    private Encoder categoryEncoder;

    // label spaces
    private List<Integer> id2intent;
    private List<String>  id2category;

    // categories
    private Map<String, CatInfo> catByCode;

    // compatibility flags (true = we can safely run the head)
    private boolean intentHeadUsable = false;
    private boolean categoryHeadUsable = false;

    // rule-based fallback (used when a head is NOT usable)
    private RuleRouter rules;

    public TextClassifier(AdminRequestService adminRequestService) {
        this.adminRequestService = adminRequestService;
    }

    // ===== lifecycle

    @PostConstruct
    public void init() {
        try {
            tempDir = Files.createTempDirectory("nlp_model_");
            copyAll();

            ObjectMapper om = new ObjectMapper();
            Map<String, Object> intentMeta   = readJson(tempDir.resolve("intent_meta.json"), om);
            Map<String, Object> categoryMeta = readJson(tempDir.resolve("category_meta.json"), om);

            id2intent   = readJsonListOfNumbers(tempDir.resolve("id2intent.json"), om);
            id2category = readJsonListOfStrings(tempDir.resolve("id2category.json"), om);
            catByCode   = readCategories(tempDir.resolve("categories.json"), om);

            // encoders
            intentEncoder   = buildEncoder(intentMeta);
            categoryEncoder = buildEncoder(categoryMeta);

            // load heads
            intentHead   = loadTorchHead(tempDir.resolve("intent_model.pt"));
            categoryHead = loadTorchHead(tempDir.resolve("category_model.pt"));

            // decide if each head is usable (encoder representation matches training)
            String iRep = String.valueOf(intentMeta.getOrDefault("representation", "hashed"));
            String cRep = String.valueOf(categoryMeta.getOrDefault("representation", "hashed"));
            intentHeadUsable   =  ("hashed".equalsIgnoreCase(iRep) && intentEncoder instanceof HashedEncoder)
                    || ("transformer".equalsIgnoreCase(iRep) && intentEncoder instanceof TransformerEncoder);
            categoryHeadUsable = ("hashed".equalsIgnoreCase(cRep) && categoryEncoder instanceof HashedEncoder)
                    || ("transformer".equalsIgnoreCase(cRep) && categoryEncoder instanceof TransformerEncoder);

            if (!intentHeadUsable || !categoryHeadUsable) {
                log.warn("⚠️ Encoder/head mismatch detected. intentUsable={}, categoryUsable={}. Enabling rule-based fallback.",
                        intentHeadUsable, categoryHeadUsable);
            }

            // build rule router using category synonyms & a brand lexicon
            rules = new RuleRouter(catByCode);

            log.info("NLP ready. intents={}, categories={}, intentRep={}, categoryRep={}, intentUsable={}, categoryUsable={}",
                    id2intent.size(), id2category.size(), iRep, cRep, intentHeadUsable, categoryHeadUsable);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize NLP models", e);
        }
    }

    @PreDestroy
    public void close() {
        closeQuietly(intentHead);
        closeQuietly(categoryHead);
        closeQuietly(intentEncoder);
        closeQuietly(categoryEncoder);
        if (tempDir != null) {
            try { Utils.deleteQuietly(tempDir); } catch (Exception ignored) {}
        }
    }

    // ===== public API

    public ClassificationResponse classify(UUID userId, String raw) {
        String text = normalize(raw);

        // --- INTENT ---
        Integer intentCode;
        if (intentHeadUsable) {
            intentCode = top1Intent(text).id;
        } else {
            intentCode = rules.routeIntent(text);
        }

        // --- CATEGORY (only if needed) ---
        if (intentCode == HELP_CATEGORY) {
            String catCode;
            if (categoryHeadUsable) {
                catCode = top1Category(text).id;
            } else {
                catCode = rules.routeCategory(text);
            }
            CatInfo ci = catByCode.getOrDefault(catCode, new CatInfo(catCode, catCode, null, List.of()));
            String link = "/catalog?category=" + ci.code;   // override link as requested
            String msg  = "We have that category of products click the button below to access the " + ci.label;
            return new ClassificationResponse(userId, msg, link, false);
        }

        // --- intent → message + link (assume user is signed in, but keep links you asked for)
        switch (intentCode) {
            case HELP_LOGIN:
                return new ClassificationResponse(
                        userId,
                        "You’re already signed in 🎉\n\nIf you need the sign-in page (e.g., to switch accounts), open it here.",
                        "/login",
                        false
                );
            case HELP_LOGOUT:
                return new ClassificationResponse(
                        userId,
                        "Got it—here’s how to log out 👋\n\n1) Open your Dashboard\n2) Click your profile avatar (top-right)\n3) Choose “Log out”.\n\nYou can sign back in anytime.",
                        "/dashboard",
                        false
                );
            case HELP_REGISTER:
                return new ClassificationResponse(
                        userId,
                        "Looks like you already have an account and you’re signed in 🙌\n\nIf you still want the registration page (for a teammate, etc.), open it here.",
                        "/register",
                        false
                );
            case HELP_VOICE:
                return new ClassificationResponse(
                        userId,
                        "Voice search is ready to use 🎤\n\nGo to the Dashboard and look for the microphone next to the search bar (top-left).\n Tap it, press START , then say what you need. If prompted, allow mic access.",
                        "/dashboard",
                        false
                );
            case HELP_ORDER:
                return new ClassificationResponse(
                        userId,
                        "Let’s check your orders 🧾\n\nOpen your Dashboard → Orders to track shipments, view status, cancel items, or start a return. Paste an order number here if you want me to jump straight to it.",
                        "/orders",
                        false
                );
            case HELP_REQUEST_BRAND:
                return new ClassificationResponse(
                        userId,
                        "You can open the brand request page if you don’t see a brand listed yet.☕ ",
                        "/request-brand",
                        false
                );
            case HELP_ADMIN:
                try {
                    if (userId != null) {
                        adminRequestService.createAwaiting(userId, raw); // raw = user's message
                    } else {
                        log.warn("HELP_ADMIN intent but userId is null; skipping AdminRequest persistence");
                    }
                } catch (Exception ex) {
                    log.error("Failed to create AdminRequest", ex);
                }
                return new ClassificationResponse(
                        userId,
                        "Connecting you with an administrator 👤💬\n\nYou will be able to describe the issue through chat messages with them in a moment...",
                        null,
                        true
                );
            default:
                return new ClassificationResponse(
                        userId,
                        "I’m here to help 😊\n\nAsk me to find products (e.g., “find gaming laptops”), manage your account (“how do I log out?”), or filter by brand (“show Samsung phones”).",
                        null,
                        false
                );
        }
    }

    // ===== model predictors

    private Top1<Integer> top1Intent(String text) {
        try (NDManager mgr = NDManager.newBaseManager();
             Predictor<NDList, NDList> pred = intentHead.newPredictor()) {

            NDArray x = intentEncoder.encode(text, mgr);   // (1,D) float32
            NDArray logits = pred.predict(new NDList(x)).head();
            float[] p = logits.softmax(-1).toFloatArray();
            int bestIdx = argmax(p);
            return new Top1<>(id2intent.get(bestIdx), p[bestIdx]);
        } catch (Exception e) {
            log.error("intent predict failed", e);
            return new Top1<>(HELP_ADMIN, 1e-6f);
        }
    }

    private Top1<String> top1Category(String text) {
        try (NDManager mgr = NDManager.newBaseManager();
             Predictor<NDList, NDList> pred = categoryHead.newPredictor()) {

            NDArray x = categoryEncoder.encode(text, mgr);
            NDArray logits = pred.predict(new NDList(x)).head();
            float[] p = logits.softmax(-1).toFloatArray();
            int bestIdx = argmax(p);
            return new Top1<>(id2category.get(bestIdx), p[bestIdx]);
        } catch (Exception e) {
            log.error("category predict failed", e);
            return new Top1<>(id2category.isEmpty() ? "UNKNOWN" : id2category.get(0), 1e-6f);
        }
    }

    private static int argmax(float[] a) {
        int idx = 0; float best = Float.NEGATIVE_INFINITY;
        for (int i = 0; i < a.length; i++) if (a[i] > best) { best = a[i]; idx = i; }
        return idx;
    }

    // ===== encoders

    private interface Encoder extends AutoCloseable {
        NDArray encode(String text, NDManager mgr) throws Exception;
        default void close() throws Exception {}
    }

    private Encoder buildEncoder(Map<String, Object> meta) throws IOException, ModelException {
        String rep = String.valueOf(meta.getOrDefault("representation", "hashed"));
        if ("transformer".equalsIgnoreCase(rep)) {
            int dim = ((Number) meta.getOrDefault("input_dim", 384)).intValue();
            String hfId = String.valueOf(meta.getOrDefault(
                    "transformer",
                    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
            ));
            try {
                return new TransformerEncoder(hfId, dim);
            } catch (Throwable t) {
                // IMPORTANT: do NOT silently feed hashed into a transformer head
                log.warn("Transformer encoder not available ({}). This head will be marked unusable.", t.toString());
                return new BrokenEncoder(); // marker; head will be considered unusable
            }
        } else {
            return new HashedEncoder(meta);
        }
    }

    /** marker that always throws — to make the head unusable */
    private static final class BrokenEncoder implements Encoder {
        @Override public NDArray encode(String text, NDManager mgr) { throw new IllegalStateException("Encoder unavailable"); }
    }

    /** hashed features mirroring trainer */
    private static final class HashedEncoder implements Encoder {
        private final int D;
        private final boolean useBigrams, useChar;
        private final int cmin, cmax;
        private final float cwt, bwt;
        private final String transform;
        private final MessageDigest md5;

        private static final Pattern WORD_RE = Pattern.compile("[a-z0-9]+");

        private static Set<String> dedupWords(String words) {
            String[] arr = words.trim().split("\\s+");
            return new LinkedHashSet<>(Arrays.asList(arr));
        }
        private static final Set<String> STOP = dedupWords(
                "the a an and or of de la si cu pt pentru pe in din este sunt un o ale " +
                        "pro plus ultra max mini new nou original best cheap ieftin premium high-end wireless"
        );
        static final Set<String> BRANDS = dedupWords(
                "apple samsung xiaomi huawei oneplus nokia motorola sony asus lenovo dell hp acer msi " +
                        "gigabyte nvidia amd intel canon nikon dji logitech philips lg bosch razer tplink " +
                        "seagate wd western digital sandisk kingston corsair steelseries hama microsoft google meta " +
                        "beats jbl bose sennheiser"
        );

        HashedEncoder(Map<String, Object> meta) throws IOException {
            try { this.md5 = MessageDigest.getInstance("MD5"); }
            catch (Exception e) { throw new IOException("MD5 not available", e); }

            this.D = ((Number) meta.getOrDefault("input_dim", 8192)).intValue();
            this.useBigrams = Boolean.TRUE.equals(meta.get("use_bigrams"));
            this.useChar    = Boolean.TRUE.equals(meta.get("use_char_ngrams"));
            this.cmin       = ((Number) meta.getOrDefault("char_nmin", 3)).intValue();
            this.cmax       = ((Number) meta.getOrDefault("char_nmax", 6)).intValue();
            this.cwt        = ((Number) meta.getOrDefault("char_weight", .9)).floatValue();
            this.bwt        = ((Number) meta.getOrDefault("brand_weight", .0)).floatValue();
            this.transform  = String.valueOf(meta.getOrDefault("transform", "log1p"));
        }

        @Override
        public NDArray encode(String raw, NDManager mgr) {
            String text = normalize(raw);
            List<String> w = tokWords(text);

            List<String> tokens = new ArrayList<>();
            for (String t : w) if (!STOP.contains(t)) tokens.add(t);
            if (useBigrams && w.size() >= 2) {
                for (int i = 0; i < w.size() - 1; i++) tokens.add(w.get(i) + "__" + w.get(i + 1));
            }

            List<String> brands = new ArrayList<>();
            if (bwt > 0f) for (String t : w) if (BRANDS.contains(t)) brands.add("br:" + t);

            List<String> ch = new ArrayList<>();
            if (useChar) {
                String s = "^" + text + "$";
                for (int n = cmin; n <= cmax; n++) {
                    if (s.length() < n) break;
                    for (int i = 0; i + n <= s.length(); i++) ch.add("ch:" + s.substring(i, i + n));
                }
            }

            float[] vec = new float[D];
            for (String t : tokens) vec[hidx(t)] += 1f;
            for (String t : ch)     vec[hidx(t)] += cwt;
            for (String t : brands) vec[hidx(t)] += bwt;

            for (int i = 0; i < D; i++) {
                if ("log1p".equals(transform)) vec[i] = (float) Math.log1p(vec[i]);
                else if ("sqrt".equals(transform)) vec[i] = (float) Math.sqrt(vec[i]);
            }
            return mgr.create(vec).reshape(1, D).toType(DataType.FLOAT32, false);
        }

        private int hidx(String token) {
            byte[] dig = md5.digest(token.getBytes(StandardCharsets.UTF_8));
            BigInteger bi = new BigInteger(1, dig);
            return bi.mod(BigInteger.valueOf(D)).intValue();
        }

        private static List<String> tokWords(String s) {
            List<String> out = new ArrayList<>();
            Matcher m = WORD_RE.matcher(s);
            while (m.find()) out.add(m.group());
            return out;
        }
    }

    /** HF text-embedding via DJL; if this class cannot init, we mark head unusable */
    private static final class TransformerEncoder implements Encoder {
        private final int dim;
        private final ZooModel<String, float[]> embedModel;

        TransformerEncoder(String hfId, int dim) throws ModelException, IOException {
            this.dim = dim;
            Criteria<String, float[]> c = Criteria.<String, float[]>builder()
                    .optApplication(Application.NLP.TEXT_EMBEDDING)
                    .setTypes(String.class, float[].class)
                    .optModelUrls("djl://ai.djl.huggingface.pytorch/" + hfId)
                    .optEngine("PyTorch")
                    .build();
            this.embedModel = c.loadModel();
        }

        @Override
        public NDArray encode(String raw, NDManager mgr) throws Exception {
            String text = raw == null ? "" : raw;
            try (var p = embedModel.newPredictor()) {
                float[] v = p.predict(text);
                float[] out = (v.length == dim) ? v : Arrays.copyOf(v, dim);
                return mgr.create(out).reshape(1, dim).toType(DataType.FLOAT32, false);
            }
        }

        @Override public void close() { closeQuietly(embedModel); }
    }

    // ===== fallback rules

    private static final class RuleRouter {

        private final Map<String, CatInfo> cats;
        private final List<Pattern> pAdmin, pLogin, pLogout, pRegister, pVoice, pOrder, pBrandVerb, pCategoryVerb;
        private final Set<String> brands;
        private final Map<String, List<String>> catSyn; // code -> synonyms

        RuleRouter(Map<String, CatInfo> cats) {
            this.cats = cats;
            this.catSyn = new HashMap<>();
            for (var e : cats.entrySet()) {
                var syn = e.getValue().synonyms;
                this.catSyn.put(e.getKey(), syn == null ? List.of() : syn);
            }
            // verbs / cues
            pAdmin = pats(
                    "admin", "administrator", "human", "agent", "operator",
                    "asistenta", "suport", "vorbesc cu un om", "contact.*admin"
            );
            pLogin = pats("log in", "login", "sign in", "autentificare", "conecteaz", "conectare", "ma loghez");
            pLogout = pats("log out", "logout", "sign out", "delogare", "deconecteaz", "iesire cont", "ies din cont");
            pRegister = pats("register", "sign up", "create account", "inregistrare", "creeaza cont", "cont nou");
            pVoice = pats("voice", "microfon", "cautare vocala", "comanda vocala", "dictat");
            pOrder = pats("order status", "order", "comanda", "livrare", "retur", "anuleaza", "tracking", "unde.*pachet");
            pBrandVerb = pats("brand", "marca", "filter", "filtreaz", "doar", "numai", "arata", "show");
            pCategoryVerb = pats("find", "search", "show", "caut", "gaseste", "vreau", "ajuta");
            brands = HashedEncoder.BRANDS; // reuse
        }

        int routeIntent(String text) {
            String t = normalize(text);
            if (any(pAdmin, t))    return HELP_ADMIN;
            if (any(pLogout, t))   return HELP_LOGOUT;
            if (any(pLogin, t))    return HELP_LOGIN;
            if (any(pRegister, t)) return HELP_REGISTER;
            if (any(pVoice, t))    return HELP_VOICE;
            if (any(pOrder, t))    return HELP_ORDER;

            // brand intent if a brand is mentioned together with a brand-ish verb
            if (containsBrand(t) && any(pBrandVerb, t)) return HELP_REQUEST_BRAND;

            // category requests
            String cat = bestCategory(t);
            if (cat != null && (any(pCategoryVerb, t) || catHitCount(t, cat) > 0)) return HELP_CATEGORY;

            // fallback: if user typed just a brand (common), treat as brand intent
            if (containsBrand(t)) return HELP_REQUEST_BRAND;

            // default
            return HELP_CATEGORY;
        }

        String routeCategory(String text) {
            String t = normalize(text);
            String cat = bestCategory(t);
            if (cat != null) return cat;
            // last resort guesses
            if (t.contains("headphon") || t.contains("earbud") || t.contains("casti") || t.contains("boxe"))
                return guessByLabel("AUDIO");
            if (t.contains("camera") || t.contains("dslr") || t.contains("mirrorless"))
                return guessByLabel("CAMERA");
            if (t.contains("phone") || t.contains("smartphone") || t.contains("telefon"))
                return guessByLabel("SMARTPHONE");
            return cats.isEmpty() ? "UNKNOWN" : cats.keySet().iterator().next();
        }

        private String bestCategory(String t) {
            int bestScore = 0;
            String bestCode = null;
            for (var e : catSyn.entrySet()) {
                int s = 0;
                for (String syn : e.getValue()) {
                    String q = syn.toLowerCase(Locale.ROOT).trim();
                    if (q.isEmpty()) continue;
                    if (q.indexOf(' ') >= 0) {
                        if (t.contains(q)) s += 3; // phrase hit
                    } else {
                        if (Pattern.compile("\\b" + Pattern.quote(q) + "\\b").matcher(t).find()) s += 1;
                    }
                }
                if (s > bestScore) { bestScore = s; bestCode = e.getKey(); }
            }
            return bestCode;
        }

        private int catHitCount(String t, String code) {
            int s = 0;
            for (String syn : catSyn.getOrDefault(code, List.of())) {
                String q = syn.toLowerCase(Locale.ROOT).trim();
                if (q.isEmpty()) continue;
                if (q.indexOf(' ') >= 0) { if (t.contains(q)) s++; }
                else { if (Pattern.compile("\\b" + Pattern.quote(q) + "\\b").matcher(t).find()) s++; }
            }
            return s;
        }

        private boolean containsBrand(String t) {
            for (String b : brands) {
                if (Pattern.compile("\\b" + Pattern.quote(b) + "\\b").matcher(t).find()) return true;
            }
            return false;
        }

        private static boolean any(List<Pattern> ps, String s) {
            for (Pattern p : ps) if (p.matcher(s).find()) return true;
            return false;
        }

        private static List<Pattern> pats(String... xs) {
            List<Pattern> out = new ArrayList<>();
            for (String x : xs) out.add(Pattern.compile(x, Pattern.CASE_INSENSITIVE));
            return out;
        }

        private String guessByLabel(String part) {
            String up = part.toUpperCase(Locale.ROOT);
            for (var e : cats.values()) if (e.label.toUpperCase(Locale.ROOT).contains(up)) return e.code;
            for (var e : cats.keySet()) if (e.toUpperCase(Locale.ROOT).contains(up)) return e;
            return cats.isEmpty() ? "UNKNOWN" : cats.keySet().iterator().next();
        }
    }

    // ===== DJL model loader

    private ZooModel<NDList, NDList> loadTorchHead(Path modelPath) throws IOException {
        var criteria = Criteria.<NDList, NDList>builder()
                .setTypes(NDList.class, NDList.class)
                .optEngine("PyTorch")
                .optModelPath(modelPath)
                .optTranslator(new NoopTranslator())
                .optDevice(Device.cpu())
                .build();
        try {
            return criteria.loadModel();
        } catch (ModelNotFoundException | MalformedModelException e) {
            throw new IOException("Failed to load head: " + modelPath + ": " + e.getMessage(), e);
        }
    }
    // ===== file/json helpers

    private void copyAll() throws IOException {
        copyResource(INT_MODEL, tempDir.resolve("intent_model.pt"));
        copyResource(INT_META,  tempDir.resolve("intent_meta.json"));
        copyResource(INT_ID2,   tempDir.resolve("id2intent.json"));

        copyResource(CAT_MODEL, tempDir.resolve("category_model.pt"));
        copyResource(CAT_META,  tempDir.resolve("category_meta.json"));
        copyResource(CAT_ID2,   tempDir.resolve("id2category.json"));
        copyResource(CAT_FULL,  tempDir.resolve("categories.json"));
    }

    private static void copyResource(String cpPath, Path dest) throws IOException {
        var res = new ClassPathResource(cpPath);
        Files.createDirectories(dest.getParent());
        try (InputStream in = res.getInputStream()) {
            Files.copy(in, dest, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static Map<String, Object> readJson(Path p, ObjectMapper om) throws IOException {
        try (InputStream in = Files.newInputStream(p)) {
            return om.readValue(in, new TypeReference<>() {});
        }
    }

    private static List<Integer> readJsonListOfNumbers(Path p, ObjectMapper om) throws IOException {
        try (InputStream in = Files.newInputStream(p)) {
            List<?> arr = om.readValue(in, List.class);
            List<Integer> out = new ArrayList<>(arr.size());
            for (Object o : arr) out.add(((Number) o).intValue());
            return out;
        }
    }

    private static List<String> readJsonListOfStrings(Path p, ObjectMapper om) throws IOException {
        try (InputStream in = Files.newInputStream(p)) {
            List<?> arr = om.readValue(in, List.class);
            List<String> out = new ArrayList<>(arr.size());
            for (Object o : arr) out.add(String.valueOf(o));
            return out;
        }
    }

    private static Map<String, CatInfo> readCategories(Path p, ObjectMapper om) throws IOException {
        try (InputStream in = Files.newInputStream(p)) {
            List<Map<String, Object>> arr = om.readValue(in, new TypeReference<>() {});
            Map<String, CatInfo> out = new HashMap<>();
            for (Map<String, Object> m : arr) {
                String code  = String.valueOf(m.get("code"));
                String label = String.valueOf(m.getOrDefault("label", code));
                String link  = m.get("link") == null ? null : String.valueOf(m.get("link"));
                @SuppressWarnings("unchecked")
                List<String> syn = (List<String>) m.getOrDefault("synonyms", List.of());
                out.put(code, new CatInfo(code, label, link, syn));
            }
            return out;
        }
    }

    // ===== text + misc utils

    private static String normalize(String s) {
        if (s == null) return "";
        String x = s.strip().toLowerCase(Locale.ROOT);
        x = x.replace('ă','a').replace('â','a').replace('î','i')
                .replace('ș','s').replace('ş','s').replace('ț','t').replace('ţ','t');
        x = x.replaceAll("\\s+", " ").trim();
        return x;
    }

    private static void closeQuietly(AutoCloseable c) {
        if (c == null) return;
        try { c.close(); } catch (Exception ignored) {}
    }

    private static final class Top1<T> {
        final T id; final float p;
        Top1(T id, float p) { this.id = id; this.p = p; }
    }

    private record CatInfo(String code, String label, String link, List<String> synonyms) {}
}
