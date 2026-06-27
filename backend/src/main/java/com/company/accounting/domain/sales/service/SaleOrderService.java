package com.company.accounting.domain.sales.service;

import com.company.accounting.domain.product.entity.Product;
import com.company.accounting.domain.product.repository.ProductRepository;
import com.company.accounting.domain.sales.dto.SaleOrderCreateRequest;
import com.company.accounting.domain.sales.dto.SaleOrderItemRequest;
import com.company.accounting.domain.sales.entity.Customer;
import com.company.accounting.domain.sales.entity.SaleOrder;
import com.company.accounting.domain.sales.entity.SaleOrderItem;
import com.company.accounting.domain.sales.repository.CustomerRepository;
import com.company.accounting.domain.sales.repository.SaleOrderRepository;
import com.company.accounting.integration.dto.JournalEntryCreateRequest;
import com.company.accounting.integration.dto.JournalEntryLineRequest;
import com.company.accounting.integration.producer.MonolithEventProducer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.company.accounting.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class SaleOrderService {

    private final SaleOrderRepository saleOrderRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final MonolithEventProducer monolithEventProducer;

    public List<SaleOrder> getAllSaleOrders() {
        return saleOrderRepository.findByTenantId(TenantContext.getCurrentTenant());
    }

    @Transactional
    public SaleOrder createSaleOrder(SaleOrderCreateRequest request) {
        Customer customer = null;
        if (request.getCustomerId() != null && request.getCustomerId() > 0) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElse(null);
        }

        SaleOrder order = SaleOrder.builder()
                .invoiceNumber("INV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .customer(customer)
                .saleDate(LocalDate.now())
                .status("PENDING")
                .tenantId(TenantContext.getCurrentTenant())
                .build();

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;

        List<com.company.accounting.integration.event.InventoryEvent.StockItem> stockItems = new java.util.ArrayList<>();

        for (SaleOrderItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new RuntimeException("Product not found"));

            BigDecimal subTotal = itemReq.getUnitPrice().multiply(itemReq.getQuantity());
            
            BigDecimal cgst = product.getCgstPercentage() != null ? product.getCgstPercentage() : BigDecimal.ZERO;
            BigDecimal sgst = product.getSgstPercentage() != null ? product.getSgstPercentage() : BigDecimal.ZERO;
            BigDecimal igst = product.getIgstPercentage() != null ? product.getIgstPercentage() : BigDecimal.ZERO;
            BigDecimal taxRate = cgst.add(sgst).max(igst);
            BigDecimal taxAmount = subTotal.multiply(taxRate).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
            BigDecimal itemTotal = subTotal.add(taxAmount);

            totalAmount = totalAmount.add(subTotal);
            totalTax = totalTax.add(taxAmount);

            SaleOrderItem item = SaleOrderItem.builder()
                    .product(product)
                    .quantity(itemReq.getQuantity())
                    .unitPrice(itemReq.getUnitPrice())
                    .subTotal(subTotal)
                    .taxAmount(taxAmount)
                    .totalAmount(itemTotal)
                    .build();

            order.addItem(item);

            stockItems.add(com.company.accounting.integration.event.InventoryEvent.StockItem.builder()
                    .productId(product.getId())
                    .quantity(itemReq.getQuantity())
                    .build());
        }

        order.setTotalAmount(totalAmount);
        order.setTotalTax(totalTax);
        order.setGrandTotal(totalAmount.add(totalTax));
        SaleOrder savedOrder = saleOrderRepository.save(order);

        // Publish InventoryEvent to deduct stock asynchronously
        com.company.accounting.integration.event.InventoryEvent event = 
                com.company.accounting.integration.event.InventoryEvent.builder()
                .transactionId(savedOrder.getInvoiceNumber())
                .eventType("DEDUCT_STOCK")
                .tenantId(TenantContext.getCurrentTenant())
                .items(stockItems)
                .warehouseId(request.getSourceWarehouseId())
                .build();
                
        monolithEventProducer.publishInventoryEvent(event);

        return savedOrder;
    }

    @Transactional
    public void completeSaleOrder(String invoiceNumber) {
        SaleOrder order = saleOrderRepository.findByInvoiceNumber(invoiceNumber)
                .orElseThrow(() -> new RuntimeException("SaleOrder not found"));

        if (!"PENDING".equals(order.getStatus())) {
            return;
        }

        order.setStatus("COMPLETED");
        saleOrderRepository.save(order);

        // Core Accounting Integration via Kafka Event
        JournalEntryCreateRequest jeRequest = new JournalEntryCreateRequest();
        jeRequest.setEntryDate(order.getSaleDate());
        jeRequest.setDescription("POS Sale - " + order.getInvoiceNumber());
        jeRequest.setReferenceNumber(order.getInvoiceNumber());

        JournalEntryLineRequest debitCash = new JournalEntryLineRequest();
        debitCash.setLedgerName("Cash");
        debitCash.setDebitAmount(order.getGrandTotal());

        JournalEntryLineRequest creditSales = new JournalEntryLineRequest();
        creditSales.setLedgerName("Sales");
        creditSales.setCreditAmount(order.getTotalAmount());

        JournalEntryLineRequest creditTax = new JournalEntryLineRequest();
        creditTax.setLedgerName("Output Tax (GST)");
        creditTax.setCreditAmount(order.getTotalTax());

        jeRequest.setLines(java.util.Arrays.asList(debitCash, creditSales, creditTax));
        
        com.company.accounting.integration.event.JournalEntryEvent event = 
                com.company.accounting.integration.event.JournalEntryEvent.builder()
                .transactionId(order.getInvoiceNumber())
                .eventType("CREATE_JOURNAL_ENTRY")
                .tenantId(order.getTenantId())
                .request(jeRequest)
                .build();
                
        monolithEventProducer.publishEvent(event);
    }

    @Transactional
    public void failSaleOrder(String invoiceNumber, String reason) {
        SaleOrder order = saleOrderRepository.findByInvoiceNumber(invoiceNumber)
                .orElseThrow(() -> new RuntimeException("SaleOrder not found"));

        if (!"PENDING".equals(order.getStatus())) {
            return;
        }

        order.setStatus("FAILED");
        // We could store the reason in a notes field if it existed
        saleOrderRepository.save(order);
    }
}

