package com.company.auth.domain.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tenant_members")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(name = "user_email", nullable = false)
    private String userEmail;

    @Column(name = "role", nullable = false)
    private String role; // "OWNER", "ACCOUNTING_PARTNER"

    @Column(name = "business_name")
    private String businessName;

    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
