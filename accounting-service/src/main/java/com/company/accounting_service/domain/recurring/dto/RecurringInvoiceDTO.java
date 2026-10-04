package com.company.accounting_service.domain.recurring.dto;

import com.company.accounting_service.core.json.ExtensibleDTO;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = false)
public class RecurringInvoiceDTO extends ExtensibleDTO {
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
