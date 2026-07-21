package com.company.accounting_service.domain.purchase.service;

import com.company.accounting_service.domain.purchase.dto.PurchaseDTO;
import com.company.accounting_service.domain.purchase.entity.Purchase;
import com.company.accounting_service.domain.purchase.entity.PurchaseLineItem;
import com.company.accounting_service.domain.purchase.repository.PurchaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PurchaseService {

    private final PurchaseRepository purchaseRepository;

    @Transactional(readOnly = true)
    public List<PurchaseDTO> getAllPurchases() {
        return purchaseRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public PurchaseDTO savePurchase(PurchaseDTO dto) {
        Purchase purchase;
        if (dto.getId() != null) {
            purchase = purchaseRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Purchase not found"));
            purchase.getItems().clear(); // For simplicity, rebuild items
        } else {
            purchase = new Purchase();
        }

        purchase.setDate(dto.getDate());
        purchase.setSupplierName(dto.getSupplierName());
        purchase.setSupplierAddress(dto.getSupplierAddress());
        purchase.setSupplierGstin(dto.getSupplierGstin());
        purchase.setInvoiceNumber(dto.getInvoiceNumber());
        purchase.setPaymentStatus(dto.getPaymentStatus());
        purchase.setInterstate(dto.getInterstate());
        purchase.setApplyRoundOff(dto.getApplyRoundOff());
        purchase.setNote(dto.getNote());

        if (dto.getItems() != null) {
            for (PurchaseDTO.PurchaseLineItemDTO itemDto : dto.getItems()) {
                PurchaseLineItem item = new PurchaseLineItem();
                item.setName(itemDto.getName());
                item.setHsn(itemDto.getHsn());
                item.setQuantity(itemDto.getQuantity());
                item.setRate(itemDto.getRate());
                item.setTaxPercent(itemDto.getTaxPercent());
                item.setCessPercent(itemDto.getCessPercent());
                purchase.addItem(item);
            }
        }

        purchase = purchaseRepository.save(purchase);
        return mapToDTO(purchase);
    }

    @Transactional
    public void deletePurchase(Long id) {
        purchaseRepository.deleteById(id);
    }

    private PurchaseDTO mapToDTO(Purchase purchase) {
        PurchaseDTO dto = new PurchaseDTO();
        dto.setId(purchase.getId());
        dto.setDate(purchase.getDate());
        dto.setSupplierName(purchase.getSupplierName());
        dto.setSupplierAddress(purchase.getSupplierAddress());
        dto.setSupplierGstin(purchase.getSupplierGstin());
        dto.setInvoiceNumber(purchase.getInvoiceNumber());
        dto.setPaymentStatus(purchase.getPaymentStatus());
        dto.setInterstate(purchase.getInterstate());
        dto.setApplyRoundOff(purchase.getApplyRoundOff());
        dto.setNote(purchase.getNote());

        if (purchase.getItems() != null) {
            dto.setItems(purchase.getItems().stream().map(item -> {
                PurchaseDTO.PurchaseLineItemDTO itemDto = new PurchaseDTO.PurchaseLineItemDTO();
                itemDto.setId(item.getId());
                itemDto.setName(item.getName());
                itemDto.setHsn(item.getHsn());
                itemDto.setQuantity(item.getQuantity());
                itemDto.setRate(item.getRate());
                itemDto.setTaxPercent(item.getTaxPercent());
                itemDto.setCessPercent(item.getCessPercent());
                return itemDto;
            }).collect(Collectors.toList()));
        }

        return dto;
    }
}
