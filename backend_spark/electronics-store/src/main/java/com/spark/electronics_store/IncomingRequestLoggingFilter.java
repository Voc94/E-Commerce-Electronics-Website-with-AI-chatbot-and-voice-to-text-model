package com.spark.electronics_store;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Collections;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class IncomingRequestLoggingFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(IncomingRequestLoggingFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String auth = request.getHeader("Authorization");
        String headers = Collections.list(request.getHeaderNames()).stream()
                .collect(Collectors.toMap(h -> h, request::getHeader))
                .toString();
        log.debug("Received request {} {} from {} | Authorization=[{}] | all headers={}",
                request.getMethod(), request.getRequestURI(), request.getRemoteAddr(), auth, headers);
        filterChain.doFilter(request, response);
    }
}
