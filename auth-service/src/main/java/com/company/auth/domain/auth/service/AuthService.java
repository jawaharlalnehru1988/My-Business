package com.company.auth.domain.auth.service;

import com.company.auth.core.security.CustomUserDetails;
import com.company.auth.core.security.JwtUtil;
import com.company.auth.domain.auth.dto.AuthRequest;
import com.company.auth.domain.auth.dto.AuthResponse;
import com.company.auth.domain.auth.dto.RegisterRequest;
import com.company.auth.domain.auth.entity.Role;
import com.company.auth.domain.auth.entity.TenantMember;
import com.company.auth.domain.auth.entity.User;
import com.company.auth.domain.auth.repository.TenantMemberRepository;
import com.company.auth.domain.auth.repository.UserRepository;
import lombok.*;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final TenantMemberRepository memberRepository;
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

    private Long generateUniqueTenantId() {
        return Math.abs(UUID.randomUUID().getMostSignificantBits() % 900000000000L) + 100000000000L;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail().toLowerCase().trim()).isPresent()) {
            throw new RuntimeException("Email already registered.");
        }

        String businessName = request.getBusinessName() != null && !request.getBusinessName().trim().isEmpty() 
                ? request.getBusinessName().trim() 
                : "My Business";

        Long newTenantId = generateUniqueTenantId();

        TenantDto tenantRequest = TenantDto.builder()
                .businessName(businessName)
                .gstNumber(request.getGstNumber())
                .contactInfo(request.getContactInfo())
                .address(request.getAddress())
                .build();

        try {
            TenantDto saved = restTemplate.postForObject(
                    "http://monolith-backend/api/v1/tenants",
                    tenantRequest,
                    TenantDto.class
            );
            if (saved != null && saved.getId() != null) {
                newTenantId = saved.getId();
            }
        } catch (Exception ignored) {
            // Standalone or microservices without monolith-backend
        }

        // Create User
        User user = User.builder()
                .email(request.getEmail().toLowerCase().trim())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.ROLE_TENANT_OWNER)
                .tenantId(newTenantId)
                .build();
        User savedUser = userRepository.save(user);

        // Record Owner in TenantMember
        memberRepository.save(TenantMember.builder()
                .tenantId(newTenantId)
                .userEmail(savedUser.getEmail())
                .role("OWNER")
                .businessName(businessName)
                .createdAt(LocalDateTime.now())
                .build());

        // Generate Token
        CustomUserDetails userDetails = new CustomUserDetails(savedUser);
        String jwtToken = jwtUtil.generateToken(userDetails);

        return AuthResponse.builder()
                .token(jwtToken)
                .role(savedUser.getRole().name())
                .tenantId(savedUser.getTenantId())
                .businessName(businessName)
                .build();
    }

    public AuthResponse login(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail().toLowerCase().trim(), request.getPassword())
        );

        User user = userRepository.findByEmail(request.getEmail().toLowerCase().trim())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (user.getTenantId() == null) {
            Long newTenantId = generateUniqueTenantId();
            user.setTenantId(newTenantId);
            user = userRepository.save(user);
        }

        CustomUserDetails userDetails = new CustomUserDetails(user);
        String jwtToken = jwtUtil.generateToken(userDetails);

        String businessName = null;
        try {
            TenantDto tenant = restTemplate.getForObject(
                    "http://monolith-backend/api/v1/tenants/" + user.getTenantId(),
                    TenantDto.class
            );
            if (tenant != null) {
                businessName = tenant.getBusinessName();
            }
        } catch (Exception ignored) {}

        if (businessName == null) {
            businessName = memberRepository.findByTenantId(user.getTenantId()).stream()
                    .filter(m -> m.getBusinessName() != null && !m.getBusinessName().isEmpty())
                    .map(TenantMember::getBusinessName)
                    .findFirst()
                    .orElse("My Business");
        }

        // Ensure owner membership exists
        Optional<TenantMember> optMem = memberRepository.findByTenantIdAndUserEmailIgnoreCase(user.getTenantId(), user.getEmail());
        if (optMem.isEmpty()) {
            memberRepository.save(TenantMember.builder()
                    .tenantId(user.getTenantId())
                    .userEmail(user.getEmail())
                    .role("OWNER")
                    .businessName(businessName)
                    .createdAt(LocalDateTime.now())
                    .build());
        }

        return AuthResponse.builder()
                .token(jwtToken)
                .role(user.getRole().name())
                .tenantId(user.getTenantId())
                .businessName(businessName)
                .build();
    }

    @Transactional
    public AuthResponse loginWithGoogle(com.company.auth.domain.auth.dto.GoogleAuthRequest request) {
        try {
            com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier verifier = new com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier.Builder(
                    new com.google.api.client.http.javanet.NetHttpTransport(),
                    new com.google.api.client.json.gson.GsonFactory())
                    .setAudience(java.util.Collections.singletonList("671159237759-5eu5k96v53hl3d729tmeqd35daqe69ar.apps.googleusercontent.com"))
                    .build();

            com.google.api.client.googleapis.auth.oauth2.GoogleIdToken idToken = verifier.verify(request.getCredential());
            if (idToken != null) {
                com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload payload = idToken.getPayload();
                String email = payload.getEmail().toLowerCase().trim();

                User user = userRepository.findByEmail(email).orElse(null);
                String businessName = null;

                if (user == null) {
                    // Brand new user: Always provision a dedicated, isolated tenant!
                    Long newTenantId = generateUniqueTenantId();

                    // Derive friendly business name
                    if (payload.get("name") != null && !payload.get("name").toString().trim().isEmpty()) {
                        businessName = payload.get("name").toString().trim() + "'s Business";
                    } else if (email.contains("@")) {
                        String prefix = email.split("@")[0];
                        businessName = Character.toUpperCase(prefix.charAt(0)) + prefix.substring(1) + "'s Business";
                    } else {
                        businessName = "My Business";
                    }

                    user = User.builder()
                            .email(email)
                            .password(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .role(Role.ROLE_TENANT_OWNER)
                            .tenantId(newTenantId)
                            .build();
                    user = userRepository.save(user);

                    memberRepository.save(TenantMember.builder()
                            .tenantId(newTenantId)
                            .userEmail(email)
                            .role("OWNER")
                            .businessName(businessName)
                            .createdAt(LocalDateTime.now())
                            .build());
                } else {
                    // Existing user
                    if (user.getTenantId() == null) {
                        Long newTenantId = generateUniqueTenantId();
                        user.setTenantId(newTenantId);
                        user = userRepository.save(user);
                    }

                    businessName = memberRepository.findByTenantId(user.getTenantId()).stream()
                            .filter(m -> m.getBusinessName() != null && !m.getBusinessName().isEmpty())
                            .map(TenantMember::getBusinessName)
                            .findFirst()
                            .orElse(null);

                    if (businessName == null) {
                        businessName = "My Business";
                    }

                    // Ensure owner membership exists
                    Optional<TenantMember> optMem = memberRepository.findByTenantIdAndUserEmailIgnoreCase(user.getTenantId(), email);
                    if (optMem.isEmpty()) {
                        memberRepository.save(TenantMember.builder()
                                .tenantId(user.getTenantId())
                                .userEmail(email)
                                .role("OWNER")
                                .businessName(businessName)
                                .createdAt(LocalDateTime.now())
                                .build());
                    }
                }

                CustomUserDetails userDetails = new CustomUserDetails(user);
                String jwtToken = jwtUtil.generateToken(userDetails);

                return AuthResponse.builder()
                        .token(jwtToken)
                        .role(user.getRole().name())
                        .tenantId(user.getTenantId())
                        .businessName(businessName)
                        .build();

            } else {
                throw new RuntimeException("Invalid ID token.");
            }
        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Authentication failed: " + e.getMessage());
        }
    }

    @Transactional
    public AuthResponse setupTenant(RegisterRequest request, String email) {
        String cleanEmail = email.toLowerCase().trim();
        User user = userRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String busName = request.getBusinessName() != null && !request.getBusinessName().trim().isEmpty() 
                ? request.getBusinessName().trim() 
                : "My Business";

        Long tenantId = user.getTenantId();
        if (tenantId == null) {
            tenantId = generateUniqueTenantId();
            user.setTenantId(tenantId);
            userRepository.save(user);
        }

        // Upsert TenantMember record
        Optional<TenantMember> optMem = memberRepository.findByTenantIdAndUserEmailIgnoreCase(tenantId, cleanEmail);
        if (optMem.isPresent()) {
            TenantMember m = optMem.get();
            m.setBusinessName(busName);
            memberRepository.save(m);
        } else {
            memberRepository.save(TenantMember.builder()
                    .tenantId(tenantId)
                    .userEmail(cleanEmail)
                    .role("OWNER")
                    .businessName(busName)
                    .createdAt(LocalDateTime.now())
                    .build());
        }

        CustomUserDetails userDetails = new CustomUserDetails(user);
        String jwtToken = jwtUtil.generateToken(userDetails);

        return AuthResponse.builder()
                .token(jwtToken)
                .role(user.getRole().name())
                .tenantId(user.getTenantId())
                .businessName(busName)
                .build();
    }
}
