package com.company.accounting_service.domain.profile.repository;

import com.company.accounting_service.domain.profile.entity.BusinessProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BusinessProfileRepository extends JpaRepository<BusinessProfile, Long> {

    @Query("SELECT p FROM BusinessProfile p WHERE p.tenantId = :tenantId")
    List<BusinessProfile> findByTenant(@Param("tenantId") Long tenantId);

    @Query("SELECT p FROM BusinessProfile p WHERE p.id = :id AND p.tenantId = :tenantId")
    Optional<BusinessProfile> findByIdAndTenant(@Param("id") Long id, @Param("tenantId") Long tenantId);
}

