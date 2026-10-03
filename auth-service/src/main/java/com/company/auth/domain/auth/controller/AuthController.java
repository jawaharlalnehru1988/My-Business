package com.company.auth.domain.auth.controller;

import com.company.auth.domain.auth.dto.AuthRequest;
import com.company.auth.domain.auth.dto.AuthResponse;
import com.company.auth.domain.auth.dto.RegisterRequest;
import com.company.auth.domain.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.company.auth.core.security.JwtUtil;

@RestController
@RequestMapping({"/api/v1/auth", "/api/auth"})
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;
    private final JwtUtil jwtUtil;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> loginWithGoogle(@RequestBody com.company.auth.domain.auth.dto.GoogleAuthRequest request) {
        return ResponseEntity.ok(authService.loginWithGoogle(request));
    }

    @PostMapping("/setup-tenant")
    public ResponseEntity<AuthResponse> setupTenant(
            @RequestBody RegisterRequest request, 
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(401).build();
        }
        String token = authHeader.substring(7);
        try {
            String email = jwtUtil.extractUsername(token);
            return ResponseEntity.ok(authService.setupTenant(request, email));
        } catch (io.jsonwebtoken.JwtException e) {
            return ResponseEntity.status(401).build();
        }
    }
}
