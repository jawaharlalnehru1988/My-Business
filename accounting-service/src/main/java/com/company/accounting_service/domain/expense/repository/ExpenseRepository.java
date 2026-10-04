package com.company.accounting_service.domain.expense.repository;

import com.company.accounting_service.domain.expense.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    @Query("SELECT e FROM Expense e WHERE (e.tenantId = :tenantId OR (e.tenantId IS NULL AND :tenantId = 1))")
    List<Expense> findByTenant(@Param("tenantId") Long tenantId);

    @Query("SELECT e FROM Expense e WHERE e.id = :id AND (e.tenantId = :tenantId OR (e.tenantId IS NULL AND :tenantId = 1))")
    Optional<Expense> findByIdAndTenant(@Param("id") Long id, @Param("tenantId") Long tenantId);
}

