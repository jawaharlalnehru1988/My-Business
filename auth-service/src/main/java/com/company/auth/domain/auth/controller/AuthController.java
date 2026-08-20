package com.company.auth.domain.auth.controller;

import com.company.auth.domain.auth.dto.AuthRequest;
import com.company.auth.domain.auth.dto.AuthResponse;
import com.company.auth.domain.auth.dto.RegisterRequest;
import com.company.auth.domain.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1/auth", "/api/auth"})
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

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
    public ResponseEntity<AuthResponse> setupTenant(@RequestBody RegisterRequest request, org.springframework.security.core.Authentication authentication) {
        String email = authentication.getName();
        return ResponseEntity.ok(authService.setupTenant(request, email));
    }
}
