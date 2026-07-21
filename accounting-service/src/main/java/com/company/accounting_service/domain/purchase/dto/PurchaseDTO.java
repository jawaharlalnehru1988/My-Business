package com.company.accounting_service.domain.purchase.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class PurchaseDTO {
    private Long id;
    private LocalDate date;
    private String supplierName;
    private String supplierAddress;
    private String supplierGstin;
    private String invoiceNumber;
    private String paymentStatus;
    private Boolean interstate;
    private Boolean applyRoundOff;
    private String note;
    private List<PurchaseLineItemDTO> items;

    @Data
    public static class PurchaseLineItemDTO {
        private Long id;
        private String name;
        private String hsn;
        private BigDecimal quantity;
        private BigDecimal rate;
        private BigDecimal taxPercent;
        private BigDecimal cessPercent;
    }
}
