package com.company.accounting_service.domain.recurring.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class RecurringInvoiceDTO {
    private Long id;
    private String clientName;
    private String clientState;
    private String clientGstin;
    private String clientAddress;
    private String frequency;
    private String invoiceType;
    private String notes;
    private LocalDate nextDate;
    private Boolean active;
    private List<RecurringInvoiceLineItemDTO> items;

    @Data
    public static class RecurringInvoiceLineItemDTO {
        private Long id;
        private String name;
        private String hsn;
        private BigDecimal quantity;
        private BigDecimal rate;
        private BigDecimal taxPercent;
        private BigDecimal discount;
    }
}
