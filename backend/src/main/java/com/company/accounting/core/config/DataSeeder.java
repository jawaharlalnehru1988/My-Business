package com.company.accounting.core.config;

import com.company.accounting.domain.auth.entity.Role;
import com.company.accounting.domain.auth.entity.User;
import com.company.accounting.domain.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        if (userRepository.findByEmail("admin@system.com").isEmpty()) {
            User admin = User.builder()
                    .email("admin@system.com")
                    .password(passwordEncoder.encode("admin123"))
                    .role(Role.ROLE_SUPER_ADMIN)
                    .build();
            userRepository.save(admin);
        }
    }
}
