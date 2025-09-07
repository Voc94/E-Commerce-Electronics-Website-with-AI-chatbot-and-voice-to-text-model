package com.spark.electronics_store.config;

import static org.springframework.security.config.Customizer.withDefaults;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;

@Configuration
public class SecurityConfig {

    // 1. Chain for the internal sync endpoint using static bearer token
    @Bean
    @Order(1)
    public SecurityFilterChain syncEndpointSecurityChain(HttpSecurity http,
                                                         @Value("${sync.shared-secret:moldo}") String staticSecret) throws Exception {
        http
                .securityMatcher("/internal/sync/users/**")
                .csrf(csrf -> csrf.disable())
                .addFilterBefore(new StaticBearerTokenAuthenticationFilter(staticSecret),
                        org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().hasRole("INTERNAL") // the filter gives ROLE_INTERNAL
                );
        return http.build();
    }

    // 2. Default chain for everything else: JWT resource server
    @Bean
    @Order(2)
    public SecurityFilterChain defaultSecurityChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        // Allow logo fetch without authentication
                        .requestMatchers("/public/**").permitAll()
                        .requestMatchers("/products/search").permitAll()
                        .requestMatchers("/products/**").permitAll()
                        .requestMatchers("/brands/requests/*/logo").permitAll()
                        .requestMatchers("/brands/*/products/*/photos/*").permitAll()
                        .requestMatchers("/orders").authenticated()
                        .requestMatchers("/orders/**").authenticated()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(withDefaults()));
        return http.build();
    }

    // JWT decoder for the resource server chain
    @Bean
    public JwtDecoder jwtDecoder(@Value("${app.auth.token-secret}") String secret) {
        byte[] keyBytes = java.util.Base64.getDecoder().decode(secret);
        SecretKey hmacKey = new SecretKeySpec(keyBytes, "HmacSHA256");
        return NimbusJwtDecoder.withSecretKey(hmacKey).build();
    }
}
