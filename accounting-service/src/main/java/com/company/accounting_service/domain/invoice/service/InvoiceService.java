package com.company.accounting_service.domain.invoice.service;

import com.company.accounting_service.domain.invoice.dto.InvoiceDTO;
import com.company.accounting_service.domain.invoice.dto.InvoiceLineItemDTO;
import com.company.accounting_service.domain.invoice.entity.Invoice;
import com.company.accounting_service.domain.invoice.entity.InvoiceLineItem;
import com.company.accounting_service.domain.invoice.repository.InvoiceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<InvoiceDTO> getAllInvoices() {
        return invoiceRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public InvoiceDTO saveInvoice(InvoiceDTO dto) {
        Invoice invoice;
        if (dto.getId() != null) {
            invoice = invoiceRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Invoice not found"));
            invoice.getItems().clear(); // For simplicity, we just rebuild the items
        } else {
            invoice = new Invoice();
        }

        invoice.setInvoiceNumber(dto.getInvoiceNumber());
        invoice.setType(dto.getType());
        invoice.setInvoiceDate(dto.getInvoiceDate());
        invoice.setDueDate(dto.getDueDate());
        invoice.setClientName(dto.getClientName());
        invoice.setClientId(dto.getClientId());
        invoice.setSubtotal(dto.getSubtotal());
        invoice.setCgstAmount(dto.getCgstAmount());
        invoice.setSgstAmount(dto.getSgstAmount());
        invoice.setIgstAmount(dto.getIgstAmount());
        invoice.setTotalAmount(dto.getTotalAmount());
        invoice.setStatus(dto.getStatus());
        invoice.setNotes(dto.getNotes());
        invoice.setTerms(dto.getTerms());

        try {
            if (dto.getOptions() != null) {
                invoice.setOptionsJson(objectMapper.writeValueAsString(dto.getOptions()));
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize options JSON", e);
        }

        if (dto.getItems() != null) {
            for (InvoiceLineItemDTO itemDto : dto.getItems()) {
                InvoiceLineItem item = new InvoiceLineItem();
                item.setProductId(itemDto.getProductId());
                item.setName(itemDto.getName());
                item.setHsn(itemDto.getHsn());
                item.setQuantity(itemDto.getQuantity());
                item.setRate(itemDto.getRate());
                item.setTaxPercent(itemDto.getTaxPercent());
                item.setDiscount(itemDto.getDiscount());
                item.setAmount(itemDto.getAmount());
                invoice.addItem(item);
            }
        }

        invoice = invoiceRepository.save(invoice);
        return mapToDTO(invoice);
    }

    @Transactional
    public void deleteInvoice(Long id) {
        invoiceRepository.deleteById(id);
    }

    private InvoiceDTO mapToDTO(Invoice invoice) {
        InvoiceDTO dto = new InvoiceDTO();
        dto.setId(invoice.getId());
        dto.setInvoiceNumber(invoice.getInvoiceNumber());
        dto.setType(invoice.getType());
        dto.setInvoiceDate(invoice.getInvoiceDate());
        dto.setDueDate(invoice.getDueDate());
        dto.setClientName(invoice.getClientName());
        dto.setClientId(invoice.getClientId());
        dto.setSubtotal(invoice.getSubtotal());
        dto.setCgstAmount(invoice.getCgstAmount());
        dto.setSgstAmount(invoice.getSgstAmount());
        dto.setIgstAmount(invoice.getIgstAmount());
        dto.setTotalAmount(invoice.getTotalAmount());
        dto.setStatus(invoice.getStatus());
        dto.setNotes(invoice.getNotes());
        dto.setTerms(invoice.getTerms());

        try {
            if (invoice.getOptionsJson() != null) {
                dto.setOptions(objectMapper.readValue(invoice.getOptionsJson(), new TypeReference<Map<String, Object>>() {}));
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize options JSON", e);
        }

        if (invoice.getItems() != null) {
            dto.setItems(invoice.getItems().stream().map(item -> {
                InvoiceLineItemDTO itemDto = new InvoiceLineItemDTO();
                itemDto.setId(item.getId());
                itemDto.setProductId(item.getProductId());
                itemDto.setName(item.getName());
                itemDto.setHsn(item.getHsn());
                itemDto.setQuantity(item.getQuantity());
                itemDto.setRate(item.getRate());
                itemDto.setTaxPercent(item.getTaxPercent());
                itemDto.setDiscount(item.getDiscount());
                itemDto.setAmount(item.getAmount());
                return itemDto;
            }).collect(Collectors.toList()));
        }

        return dto;
    }
}
