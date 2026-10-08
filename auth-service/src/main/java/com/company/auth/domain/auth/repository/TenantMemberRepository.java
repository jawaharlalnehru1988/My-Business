package com.company.auth.domain.auth.repository;

import com.company.auth.domain.auth.entity.TenantMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TenantMemberRepository extends JpaRepository<TenantMember, Long> {
    List<TenantMember> findByUserEmailIgnoreCase(String userEmail);
    List<TenantMember> findByTenantId(Long tenantId);
    Optional<TenantMember> findByTenantIdAndUserEmailIgnoreCase(Long tenantId, String userEmail);
    void deleteByTenantIdAndUserEmailIgnoreCase(Long tenantId, String userEmail);
}
