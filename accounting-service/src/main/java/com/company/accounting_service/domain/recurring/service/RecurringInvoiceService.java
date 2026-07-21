package com.company.accounting_service.domain.recurring.service;

import com.company.accounting_service.domain.recurring.dto.RecurringInvoiceDTO;
import com.company.accounting_service.domain.recurring.entity.RecurringInvoice;
import com.company.accounting_service.domain.recurring.entity.RecurringInvoiceLineItem;
import com.company.accounting_service.domain.recurring.repository.RecurringInvoiceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RecurringInvoiceService {

    private final RecurringInvoiceRepository recurringRepository;

    @Transactional(readOnly = true)
    public List<RecurringInvoiceDTO> getAllRecurringInvoices() {
        return recurringRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public RecurringInvoiceDTO saveRecurringInvoice(RecurringInvoiceDTO dto) {
        RecurringInvoice invoice;
        if (dto.getId() != null) {
            invoice = recurringRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Recurring invoice not found"));
            invoice.getItems().clear();
        } else {
            invoice = new RecurringInvoice();
        }

        invoice.setClientName(dto.getClientName());
        invoice.setClientState(dto.getClientState());
        invoice.setClientGstin(dto.getClientGstin());
        invoice.setClientAddress(dto.getClientAddress());
        invoice.setFrequency(dto.getFrequency());
        invoice.setInvoiceType(dto.getInvoiceType());
        invoice.setNotes(dto.getNotes());
        invoice.setNextDate(dto.getNextDate());
        invoice.setActive(dto.getActive());

        if (dto.getItems() != null) {
            for (RecurringInvoiceDTO.RecurringInvoiceLineItemDTO itemDto : dto.getItems()) {
                RecurringInvoiceLineItem item = new RecurringInvoiceLineItem();
                item.setName(itemDto.getName());
                item.setHsn(itemDto.getHsn());
                item.setQuantity(itemDto.getQuantity());
                item.setRate(itemDto.getRate());
                item.setTaxPercent(itemDto.getTaxPercent());
                item.setDiscount(itemDto.getDiscount());
                invoice.addItem(item);
            }
        }

        invoice = recurringRepository.save(invoice);
        return mapToDTO(invoice);
    }

    @Transactional
    public void deleteRecurringInvoice(Long id) {
        recurringRepository.deleteById(id);
    }

    private RecurringInvoiceDTO mapToDTO(RecurringInvoice invoice) {
        RecurringInvoiceDTO dto = new RecurringInvoiceDTO();
        dto.setId(invoice.getId());
        dto.setClientName(invoice.getClientName());
        dto.setClientState(invoice.getClientState());
        dto.setClientGstin(invoice.getClientGstin());
        dto.setClientAddress(invoice.getClientAddress());
        dto.setFrequency(invoice.getFrequency());
        dto.setInvoiceType(invoice.getInvoiceType());
        dto.setNotes(invoice.getNotes());
        dto.setNextDate(invoice.getNextDate());
        dto.setActive(invoice.getActive());

        if (invoice.getItems() != null) {
            dto.setItems(invoice.getItems().stream().map(item -> {
                RecurringInvoiceDTO.RecurringInvoiceLineItemDTO itemDto = new RecurringInvoiceDTO.RecurringInvoiceLineItemDTO();
                itemDto.setId(item.getId());
                itemDto.setName(item.getName());
                itemDto.setHsn(item.getHsn());
                itemDto.setQuantity(item.getQuantity());
                itemDto.setRate(item.getRate());
                itemDto.setTaxPercent(item.getTaxPercent());
                itemDto.setDiscount(item.getDiscount());
                return itemDto;
            }).collect(Collectors.toList()));
        }

        return dto;
    }
}
