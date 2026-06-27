package com.company.accounting.domain.purchase.service;


import com.company.accounting.domain.product.entity.Product;
import com.company.accounting.domain.product.repository.ProductRepository;
import com.company.accounting.domain.purchase.dto.PurchaseOrderCreateRequest;
import com.company.accounting.domain.purchase.dto.PurchaseOrderItemRequest;
import com.company.accounting.domain.purchase.entity.PurchaseOrder;
import com.company.accounting.domain.purchase.entity.PurchaseOrderItem;
import com.company.accounting.domain.purchase.entity.Supplier;
import com.company.accounting.domain.purchase.repository.PurchaseOrderRepository;
import com.company.accounting.domain.purchase.repository.SupplierRepository;
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
public class PurchaseOrderService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;

    private final MonolithEventProducer monolithEventProducer;

    public List<PurchaseOrder> getAllPurchaseOrders() {
        return purchaseOrderRepository.findByTenantId(TenantContext.getCurrentTenant());
    }

    @Transactional
    public PurchaseOrder createPurchaseOrder(PurchaseOrderCreateRequest request) {
        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new RuntimeException("Supplier not found"));

        PurchaseOrder order = PurchaseOrder.builder()
                .orderNumber("PO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .supplier(supplier)
                .orderDate(LocalDate.now())
                .status("PENDING")
                .tenantId(TenantContext.getCurrentTenant())
                .build();

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;

        List<com.company.accounting.integration.event.InventoryEvent.StockItem> stockItems = new java.util.ArrayList<>();

        for (PurchaseOrderItemRequest itemReq : request.getItems()) {
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

            PurchaseOrderItem item = PurchaseOrderItem.builder()
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
        PurchaseOrder savedOrder = purchaseOrderRepository.save(order);

        // Publish InventoryEvent to add stock asynchronously
        com.company.accounting.integration.event.InventoryEvent event = 
                com.company.accounting.integration.event.InventoryEvent.builder()
                .transactionId(savedOrder.getOrderNumber())
                .eventType("ADD_STOCK")
                .tenantId(TenantContext.getCurrentTenant())
                .items(stockItems)
                .warehouseId(request.getTargetWarehouseId())
                .build();
                
        monolithEventProducer.publishInventoryEvent(event);

        return savedOrder;
    }

    @Transactional
    public void completePurchaseOrder(String orderNumber) {
        PurchaseOrder order = purchaseOrderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new RuntimeException("PurchaseOrder not found"));

        if (!"PENDING".equals(order.getStatus())) {
            return;
        }

        order.setStatus("COMPLETED");
        purchaseOrderRepository.save(order);

        // Core Accounting Integration via Kafka Event
        JournalEntryCreateRequest jeRequest = new JournalEntryCreateRequest();
        jeRequest.setEntryDate(order.getOrderDate());
        jeRequest.setDescription("PO Purchase - " + order.getOrderNumber());
        jeRequest.setReferenceNumber(order.getOrderNumber());

        JournalEntryLineRequest debitPurchases = new JournalEntryLineRequest();
        debitPurchases.setLedgerName("Purchases");
        debitPurchases.setDebitAmount(order.getTotalAmount());

        JournalEntryLineRequest debitTax = new JournalEntryLineRequest();
        debitTax.setLedgerName("Input Tax (GST)");
        debitTax.setDebitAmount(order.getTotalTax());

        JournalEntryLineRequest creditCash = new JournalEntryLineRequest();
        creditCash.setLedgerName("Cash");
        creditCash.setCreditAmount(order.getGrandTotal());

        jeRequest.setLines(java.util.Arrays.asList(debitPurchases, debitTax, creditCash));

        com.company.accounting.integration.event.JournalEntryEvent event = 
                com.company.accounting.integration.event.JournalEntryEvent.builder()
                .transactionId(order.getOrderNumber())
                .eventType("CREATE_JOURNAL_ENTRY")
                .tenantId(order.getTenantId())
                .request(jeRequest)
                .build();
                
        monolithEventProducer.publishEvent(event);
    }

    @Transactional
    public void failPurchaseOrder(String orderNumber, String reason) {
        PurchaseOrder order = purchaseOrderRepository.findByOrderNumber(orderNumber)
                .orElseThrow(() -> new RuntimeException("PurchaseOrder not found"));

        if (!"PENDING".equals(order.getStatus())) {
            return;
        }

        order.setStatus("FAILED");
        purchaseOrderRepository.save(order);
    }
}
