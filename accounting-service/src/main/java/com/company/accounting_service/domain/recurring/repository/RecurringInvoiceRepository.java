package com.company.accounting_service.domain.recurring.repository;

import com.company.accounting_service.domain.recurring.entity.RecurringInvoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RecurringInvoiceRepository extends JpaRepository<RecurringInvoice, Long> {
}
