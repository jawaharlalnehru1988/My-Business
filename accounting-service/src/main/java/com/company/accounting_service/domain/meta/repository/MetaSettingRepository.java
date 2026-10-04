package com.company.accounting_service.domain.meta.repository;

import com.company.accounting_service.domain.meta.entity.MetaSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MetaSettingRepository extends JpaRepository<MetaSetting, String> {
}
