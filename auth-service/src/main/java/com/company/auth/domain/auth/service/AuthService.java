package com.company.auth.domain.auth.service;

import com.company.auth.core.security.CustomUserDetails;
import com.company.auth.core.security.JwtUtil;
import com.company.auth.domain.auth.dto.AuthRequest;
import com.company.auth.domain.auth.dto.AuthResponse;
import com.company.auth.domain.auth.dto.RegisterRequest;
import com.company.auth.domain.auth.entity.Role;
import com.company.auth.domain.auth.entity.User;
import com.company.auth.domain.auth.repository.UserRepository;
import lombok.*;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final RestTemplate restTemplate;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TenantDto {
        private Long id;
        private String businessName;
        private String gstNumber;
        private String address;
        private String contactInfo;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already registered.");
        }

        // 1. Create Business (Tenant) in the backend service
        TenantDto tenantRequest = TenantDto.builder()
                .businessName(request.getBusinessName())
                .gstNumber(request.getGstNumber())
                .contactInfo(request.getContactInfo())
                .address(request.getAddress())
                .build();

        TenantDto savedTenant = null;
        try {
            savedTenant = restTemplate.postForObject(
                    "http://monolith-backend/api/v1/tenants",
                    tenantRequest,
                    TenantDto.class
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to register tenant in backend monolith: " + e.getMessage(), e);
        }

        if (savedTenant == null || savedTenant.getId() == null) {
            throw new RuntimeException("Backend monolith returned empty tenant details during registration");
        }

        // 2. Create User
        User user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.ROLE_TENANT_OWNER)
                .tenantId(savedTenant.getId())
                .build();
        User savedUser = userRepository.save(user);

        // 3. Generate Token
        CustomUserDetails userDetails = new CustomUserDetails(savedUser);
        String jwtToken = jwtUtil.generateToken(userDetails);

        return AuthResponse.builder()
                .token(jwtToken)
                .role(savedUser.getRole().name())
                .tenantId(savedUser.getTenantId())
                .businessName(savedTenant.getBusinessName())
                .build();
    }

    public AuthResponse login(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        CustomUserDetails userDetails = new CustomUserDetails(user);
        String jwtToken = jwtUtil.generateToken(userDetails);

        String businessName = null;
        if (user.getTenantId() != null) {
            try {
                TenantDto tenant = restTemplate.getForObject(
                        "http://monolith-backend/api/v1/tenants/" + user.getTenantId(),
                        TenantDto.class
                );
                if (tenant != null) {
                    businessName = tenant.getBusinessName();
                }
            } catch (Exception e) {
                businessName = "Unknown Business (Error fetching)";
            }
        } else if (user.getRole() == Role.ROLE_SUPER_ADMIN) {
            businessName = "Super Admin Console";
        }

        return AuthResponse.builder()
                .token(jwtToken)
                .role(user.getRole().name())
                .tenantId(user.getTenantId())
                .businessName(businessName)
                .build();
    }
}
