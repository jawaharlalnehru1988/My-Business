package com.company.accounting.domain.auth.service;

import com.company.accounting.core.security.CustomUserDetails;
import com.company.accounting.core.security.JwtUtil;
import com.company.accounting.domain.tenant.entity.Tenant;
import com.company.accounting.domain.tenant.repository.TenantRepository;
import com.company.accounting.domain.auth.dto.AuthRequest;
import com.company.accounting.domain.auth.dto.AuthResponse;
import com.company.accounting.domain.auth.dto.RegisterRequest;
import com.company.accounting.domain.auth.entity.Role;
import com.company.accounting.domain.auth.entity.User;
import com.company.accounting.domain.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new RuntimeException("Email already registered.");
        }

        // 1. Create Business (Tenant)
        Tenant tenant = new Tenant();
        tenant.setBusinessName(request.getBusinessName());
        tenant.setGstNumber(request.getGstNumber());
        tenant.setContactInfo(request.getContactInfo());
        tenant.setAddress(request.getAddress());
        Tenant savedTenant = tenantRepository.save(tenant);

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
            businessName = tenantRepository.findById(user.getTenantId())
                    .map(Tenant::getBusinessName)
                    .orElse("Unknown Business");
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
