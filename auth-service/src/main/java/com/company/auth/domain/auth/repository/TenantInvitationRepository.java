package com.company.auth.domain.auth.repository;

import com.company.auth.domain.auth.entity.TenantInvitation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TenantInvitationRepository extends JpaRepository<TenantInvitation, Long> {
    List<TenantInvitation> findByInviteeEmailIgnoreCaseAndStatus(String inviteeEmail, String status);
    List<TenantInvitation> findByTenantId(Long tenantId);
    Optional<TenantInvitation> findByIdAndInviteeEmailIgnoreCase(Long id, String inviteeEmail);
    Optional<TenantInvitation> findByIdAndTenantId(Long id, Long tenantId);
    List<TenantInvitation> findByTenantIdAndInviteeEmailIgnoreCaseAndStatus(Long tenantId, String inviteeEmail, String status);
}
