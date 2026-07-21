package com.company.accounting_service.domain.expense.service;

import com.company.accounting_service.domain.expense.dto.ExpenseDTO;
import com.company.accounting_service.domain.expense.entity.Expense;
import com.company.accounting_service.domain.expense.repository.ExpenseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final ExpenseRepository expenseRepository;

    @Transactional(readOnly = true)
    public List<ExpenseDTO> getAllExpenses() {
        return expenseRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ExpenseDTO saveExpense(ExpenseDTO dto) {
        Expense expense;
        if (dto.getId() != null) {
            expense = expenseRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Expense not found"));
        } else {
            expense = new Expense();
        }

        expense.setDate(dto.getDate());
        expense.setDescription(dto.getDescription());
        expense.setCategory(dto.getCategory());
        expense.setAmount(dto.getAmount());
        expense.setGstAmount(dto.getGstAmount());
        expense.setGstPercent(dto.getGstPercent());
        expense.setInterstate(dto.getInterstate());
        expense.setVendorName(dto.getVendorName());
        expense.setVendorGstin(dto.getVendorGstin());
        expense.setInvoiceNo(dto.getInvoiceNo());
        expense.setPaymentMode(dto.getPaymentMode());
        expense.setNote(dto.getNote());

        expense = expenseRepository.save(expense);
        return mapToDTO(expense);
    }

    @Transactional
    public void deleteExpense(Long id) {
        expenseRepository.deleteById(id);
    }

    private ExpenseDTO mapToDTO(Expense expense) {
        ExpenseDTO dto = new ExpenseDTO();
        dto.setId(expense.getId());
        dto.setDate(expense.getDate());
        dto.setDescription(expense.getDescription());
        dto.setCategory(expense.getCategory());
        dto.setAmount(expense.getAmount());
        dto.setGstAmount(expense.getGstAmount());
        dto.setGstPercent(expense.getGstPercent());
        dto.setInterstate(expense.getInterstate());
        dto.setVendorName(expense.getVendorName());
        dto.setVendorGstin(expense.getVendorGstin());
        dto.setInvoiceNo(expense.getInvoiceNo());
        dto.setPaymentMode(expense.getPaymentMode());
        dto.setNote(expense.getNote());
        return dto;
    }
}
