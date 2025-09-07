package com.spark.electronics_store.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class StaticBearerTokenAuthenticationFilter extends OncePerRequestFilter {

    private static final String PREFIX = "Bearer ";
    private final String expectedToken;

    public StaticBearerTokenAuthenticationFilter(String expectedToken) {
        this.expectedToken = expectedToken;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Only apply to the sync endpoint
        return !request.getRequestURI().startsWith("/internal/sync/users");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(PREFIX)) {
            String token = header.substring(PREFIX.length());
            if (expectedToken.equals(token)) {
                // Authenticate as internal caller
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                        "internal-sync", null, List.of(new SimpleGrantedAuthority("ROLE_INTERNAL")));
                SecurityContextHolder.getContext().setAuthentication(auth);
                filterChain.doFilter(request, response);
                return;
            }
        }

        // Reject if missing or wrong
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"Unauthorized\"}");
    }
}
