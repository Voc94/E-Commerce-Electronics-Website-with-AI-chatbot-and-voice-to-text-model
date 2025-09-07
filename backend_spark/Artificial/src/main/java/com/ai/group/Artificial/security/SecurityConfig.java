package com.ai.group.Artificial.security;

import static org.springframework.security.config.Customizer.withDefaults;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

    // Chain #1 — ONLY for internal sync; uses static bearer secret and grants ROLE_INTERNAL
    @Bean
    @Order(1)
    public SecurityFilterChain internalSyncChain(
            HttpSecurity http,
            @Value("${sync.shared-secret}") String staticSecret
    ) throws Exception {
        http
                .securityMatcher("/internal/sync/users/**")
                .csrf(csrf -> csrf.disable())
                .addFilterBefore(
                        new com.ai.group.Artificial.security.StaticBearerTokenAuthenticationFilter(staticSecret),
                        UsernamePasswordAuthenticationFilter.class
                )
                .authorizeHttpRequests(auth -> auth.anyRequest().hasRole("INTERNAL"));
        return http.build();
    }

    // Chain #2 — default app security; JWT resource server for everything else
    @Bean
    @Order(2)
    public SecurityFilterChain appChain(HttpSecurity http) throws Exception {
        http
                .cors(withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // public stuff
                        .requestMatchers("/public/**").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()            // CORS preflight

                        // voice endpoints
                        .requestMatchers(HttpMethod.POST, "/api/voice/stt").permitAll()
                        .requestMatchers(HttpMethod.POST, "/voice/stt").permitAll()

                        // SockJS/WebSocket handshake + info
                        .requestMatchers("/ws/**").permitAll()

                        // Admin support API (auth only; no role checks so it works with your current JWTs)
                        .requestMatchers(HttpMethod.GET,  "/api/admin-requests/awaiting").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/admin-requests/**").authenticated()

                        // everything else -> JWT
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(withDefaults()));
        return http.build();
    }

    // CORS for local dev; add your prod origins as needed
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(List.of("http://localhost:3000", "http://127.0.0.1:3000"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
        cfg.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    // JWT decoder for the default chain (same HS256 secret you use everywhere)
    @Bean
    public JwtDecoder jwtDecoder(@Value("${app.auth.token-secret}") String secret) {
        byte[] keyBytes = Base64.getDecoder().decode(secret);
        SecretKey hmacKey = new SecretKeySpec(keyBytes, "HmacSHA256");
        return NimbusJwtDecoder.withSecretKey(hmacKey).build();
    }
}
