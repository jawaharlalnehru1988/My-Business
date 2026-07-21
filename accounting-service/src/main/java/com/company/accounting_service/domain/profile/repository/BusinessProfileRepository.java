package com.company.accounting_service.domain.profile.repository;

import com.company.accounting_service.domain.profile.entity.BusinessProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BusinessProfileRepository extends JpaRepository<BusinessProfile, Long> {
}
