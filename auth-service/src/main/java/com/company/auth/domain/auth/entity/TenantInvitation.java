package com.company.auth.domain.auth.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "tenant_invitations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(name = "business_name")
    private String businessName;

    @Column(name = "inviter_email", nullable = false)
    private String inviterEmail;

    @Column(name = "invitee_email", nullable = false)
    private String inviteeEmail;

    @Column(name = "role", nullable = false)
    private String role; // "ACCOUNTING_PARTNER"

    @Column(name = "status", nullable = false)
    private String status; // "PENDING", "ACCEPTED", "REJECTED", "REVOKED"

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
