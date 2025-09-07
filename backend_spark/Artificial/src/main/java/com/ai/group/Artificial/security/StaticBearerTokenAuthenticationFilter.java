package com.ai.group.Artificial.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

public class StaticBearerTokenAuthenticationFilter extends OncePerRequestFilter {
    private final String expected;

    public StaticBearerTokenAuthenticationFilter(String expected) {
        this.expected = expected;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String h = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (h != null && h.startsWith("Bearer ")) {
            String token = h.substring(7).trim();
            if (expected.equals(token)) {
                var auth = new UsernamePasswordAuthenticationToken(
                        "internal-sync", null, List.of(new SimpleGrantedAuthority("ROLE_INTERNAL")));
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        chain.doFilter(request, response);
    }
}
