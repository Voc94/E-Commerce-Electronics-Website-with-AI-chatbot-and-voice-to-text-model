package com.spark.demo;

import com.spark.demo.model.AuthProvider;
import com.spark.demo.model.Role;
import com.spark.demo.model.User;
import com.spark.demo.repository.UserRepository;
import com.spark.demo.service.UserSyncNotifier;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@SpringBootApplication
@RequiredArgsConstructor
public class DemoApplication {

	@Value("${upload.base-dir:uploads}")
	private String uploadBaseDir;

	@Value("${seed.users.enabled:true}")
	private boolean seedUsersEnabled;

	@Value("${seed.users.password:password}")
	private String defaultSellerPassword;

	@Value("${seed.users.try-read-brands-csv:true}")
	private boolean tryReadBrandsCsv;

	@Value("${seed.users.brands-csv:brands.csv}")
	private String brandsCsv; // if present in resources, we’ll use it to derive slugs

	public static void main(String[] args) {
		SpringApplication.run(DemoApplication.class, args);
	}

	private static record BrandRow(String name, String slug) {}

	private List<BrandRow> readBrandsFromCsv(String resource) {
		try {
			var res = new ClassPathResource(resource);
			if (!res.exists()) return List.of();
			try (var br = new BufferedReader(new InputStreamReader(res.getInputStream()))) {
				// expected header: id,name,slug,logo_url (id not used here)
				String header = br.readLine();
				if (header == null) return List.of();
				List<BrandRow> out = new ArrayList<>();
				String line;
				while ((line = br.readLine()) != null) {
					String[] a = line.split(",", -1);
					if (a.length < 3) continue;
					String name = a[1].trim();
					String slug = a[2].trim();
					if (!slug.isBlank()) out.add(new BrandRow(name, slug));
				}
				return out;
			}
		} catch (Exception e) {
			return List.of();
		}
	}

	private List<String> fallbackBrandSlugs() {
		// Must match (or be a superset of) brands.csv slugs; harmless if extras exist.
		return List.of(
				"apple","samsung","google","dell","lenovo","hp","sony","lg",
				"nvidia","amd","corsair","brother","canon","seagate","tp-link",
				"netgear","ubiquiti","logitech","keychron","anker","jbl","bose",
				"nikon","razer","microsoft","philips","instant-pot","dyson","niu","dji"
		);
	}

	@org.springframework.context.annotation.Bean
	public CommandLineRunner initOnStartup(
			UserRepository userRepository,
			PasswordEncoder passwordEncoder,
			UserSyncNotifier userSyncNotifier
	) {
		return args -> {
			// 0) Clean uploads (like before)
			Path uploads = Paths.get(uploadBaseDir).toAbsolutePath().normalize();
			if (Files.exists(uploads) && Files.isDirectory(uploads)) {
				try (Stream<Path> walk = Files.walk(uploads)) {
					walk.sorted(Comparator.reverseOrder())
							.filter(p -> !p.equals(uploads))
							.forEach(p -> { try { Files.deleteIfExists(p); } catch (Exception ignored) {} });
				}
			}
			Files.createDirectories(uploads);
			System.out.println("Cleared uploads directory at: " + uploads);

			if (!seedUsersEnabled) return;

			// 1) Ensure admin
			String adminEmail = "admin@admin.com";
			User admin = userRepository.findByEmail(adminEmail).orElseGet(() -> {
				User a = new User();
				a.setName("admin");
				a.setEmail(adminEmail);
				a.setProvider(AuthProvider.LOCAL);
				a.setPassword(passwordEncoder.encode("admin"));
				a.setRole(Role.ADMIN);
				a.setEmailVerified(true);
				return userRepository.save(a);
			});
			notifyWithRetry(userSyncNotifier, admin, 6, 1000);
			System.out.println("Admin ready & synced.");

			// 2) Build seller list (by brand slug)
			List<String> slugs;
			if (tryReadBrandsCsv) {
				List<BrandRow> rows = readBrandsFromCsv(brandsCsv);
				slugs = rows.isEmpty()
						? fallbackBrandSlugs()
						: rows.stream().map(BrandRow::slug).filter(s -> !s.isBlank()).distinct().toList();
			} else {
				slugs = fallbackBrandSlugs();
			}

			// 3) Create one seller per brand slug; email format is used by electronics-store to attach a Brand
			for (String slug : slugs) {
				String email = slug + "-seller@noreply.local";
				User u = userRepository.findByEmail(email).orElseGet(() -> {
					User s = new User();
					s.setEmail(email);
					s.setName(capitalizeSlug(slug) + " Seller");
					s.setProvider(AuthProvider.LOCAL);
					s.setPassword(passwordEncoder.encode(defaultSellerPassword));
					s.setRole(Role.BRAND_SELLER);
					s.setEmailVerified(true);
					return userRepository.save(s);
				});

				// Sync to electronics-store (upsert). Electronics-store will attach Brand based on the email slug.
				notifyWithRetry(userSyncNotifier, u, 6, 1000);
				System.out.println("Seller ready & synced: " + email);
			}
		};
	}

	private static void notifyWithRetry(UserSyncNotifier notifier, User user, int attempts, long sleepMs) {
		for (int i = 1; i <= attempts; i++) {
			try {
				notifier.notifyUpsert(user);
				return;
			} catch (Exception e) {
				if (i == attempts) {
					System.err.println("Failed to sync user " + user.getEmail() +
							" after " + attempts + " attempts: " + e.getMessage());
					return;
				}
				try { Thread.sleep(sleepMs); } catch (InterruptedException ignored) {}
			}
		}
	}

	private static String capitalizeSlug(String slug) {
		return Arrays.stream(slug.split("-"))
				.filter(s -> !s.isBlank())
				.map(s -> Character.toUpperCase(s.charAt(0)) + s.substring(1))
				.collect(Collectors.joining(" "));
	}
}
