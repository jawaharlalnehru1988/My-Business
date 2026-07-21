package com.company.accounting_service.domain.template.repository;

import com.company.accounting_service.domain.template.entity.TermsTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TermsTemplateRepository extends JpaRepository<TermsTemplate, Long> {
}
