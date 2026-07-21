package com.company.accounting_service.domain.receipt.service;

import com.company.accounting_service.domain.receipt.dto.ReceiptDTO;
import com.company.accounting_service.domain.receipt.entity.Receipt;
import com.company.accounting_service.domain.receipt.repository.ReceiptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReceiptService {

    private final ReceiptRepository receiptRepository;

    @Transactional(readOnly = true)
    public List<ReceiptDTO> getAllReceipts() {
        return receiptRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ReceiptDTO saveReceipt(ReceiptDTO dto) {
        Receipt receipt;
        if (dto.getId() != null) {
            receipt = receiptRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Receipt not found"));
        } else {
            receipt = new Receipt();
        }

        receipt.setDate(dto.getDate());
        receipt.setReceiptNo(dto.getReceiptNo());
        receipt.setClientName(dto.getClientName());
        receipt.setClientAddress(dto.getClientAddress());
        receipt.setAmount(dto.getAmount());
        receipt.setPaymentMode(dto.getPaymentMode());
        receipt.setReferenceNo(dto.getReferenceNo());
        receipt.setAgainstInvoice(dto.getAgainstInvoice());
        receipt.setNote(dto.getNote());

        receipt = receiptRepository.save(receipt);
        return mapToDTO(receipt);
    }

    @Transactional
    public void deleteReceipt(Long id) {
        receiptRepository.deleteById(id);
    }

    private ReceiptDTO mapToDTO(Receipt receipt) {
        ReceiptDTO dto = new ReceiptDTO();
        dto.setId(receipt.getId());
        dto.setDate(receipt.getDate());
        dto.setReceiptNo(receipt.getReceiptNo());
        dto.setClientName(receipt.getClientName());
        dto.setClientAddress(receipt.getClientAddress());
        dto.setAmount(receipt.getAmount());
        dto.setPaymentMode(receipt.getPaymentMode());
        dto.setReferenceNo(receipt.getReferenceNo());
        dto.setAgainstInvoice(receipt.getAgainstInvoice());
        dto.setNote(receipt.getNote());
        return dto;
    }
}
