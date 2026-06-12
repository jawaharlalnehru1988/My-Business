package com.company.accounting.domain.purchase.service;

import com.company.accounting.domain.inventory.service.InventoryService;
import com.company.accounting.domain.product.entity.Product;
import com.company.accounting.domain.product.repository.ProductRepository;
import com.company.accounting.domain.purchase.dto.PurchaseOrderCreateRequest;
import com.company.accounting.domain.purchase.dto.PurchaseOrderItemRequest;
import com.company.accounting.domain.purchase.entity.PurchaseOrder;
import com.company.accounting.domain.purchase.entity.PurchaseOrderItem;
import com.company.accounting.domain.purchase.entity.Supplier;
import com.company.accounting.domain.purchase.repository.PurchaseOrderRepository;
import com.company.accounting.domain.purchase.repository.SupplierRepository;
import com.company.accounting.domain.accounting.service.AccountingService;
import com.company.accounting.domain.accounting.dto.JournalEntryCreateRequest;
import com.company.accounting.domain.accounting.dto.JournalEntryLineRequest;
import com.company.accounting.domain.accounting.entity.Ledger;
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
    private final InventoryService inventoryService;
    private final AccountingService accountingService;

    public List<PurchaseOrder> getAllPurchaseOrders() {
        return purchaseOrderRepository.findByTenantId(TenantContext.getCurrentTenant());
    }

    @Transactional
    public PurchaseOrder createAndCompletePurchaseOrder(PurchaseOrderCreateRequest request) {
        Supplier supplier = supplierRepository.findById(request.getSupplierId())
                .orElseThrow(() -> new RuntimeException("Supplier not found"));

        PurchaseOrder order = PurchaseOrder.builder()
                .orderNumber("PO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .supplier(supplier)
                .orderDate(LocalDate.now())
                .status("COMPLETED")
                .tenantId(TenantContext.getCurrentTenant())
                .build();

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;

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

            // Integrate with Inventory: Stock IN
            inventoryService.adjustStock(
                    product.getId(),
                    request.getTargetWarehouseId(),
                    itemReq.getQuantity(),
                    "PURCHASE"
            );
        }

        order.setTotalAmount(totalAmount);
        order.setTotalTax(totalTax);
        order.setGrandTotal(totalAmount.add(totalTax));
        PurchaseOrder savedOrder = purchaseOrderRepository.save(order);

        // Core Accounting Integration
        Ledger cashLedger = accountingService.getOrCreateLedger("Cash", "ASSET");
        Ledger purchasesLedger = accountingService.getOrCreateLedger("Purchases", "EXPENSE");
        Ledger taxLedger = accountingService.getOrCreateLedger("Input Tax (GST)", "ASSET");

        JournalEntryCreateRequest jeRequest = new JournalEntryCreateRequest();
        jeRequest.setEntryDate(savedOrder.getOrderDate());
        jeRequest.setDescription("PO Purchase - " + savedOrder.getOrderNumber());
        jeRequest.setReferenceNumber(savedOrder.getOrderNumber());

        JournalEntryLineRequest debitPurchases = new JournalEntryLineRequest();
        debitPurchases.setLedgerId(purchasesLedger.getId());
        debitPurchases.setDebitAmount(savedOrder.getTotalAmount());

        JournalEntryLineRequest debitTax = new JournalEntryLineRequest();
        debitTax.setLedgerId(taxLedger.getId());
        debitTax.setDebitAmount(savedOrder.getTotalTax());

        JournalEntryLineRequest creditCash = new JournalEntryLineRequest();
        creditCash.setLedgerId(cashLedger.getId());
        creditCash.setCreditAmount(savedOrder.getGrandTotal());

        jeRequest.setLines(java.util.Arrays.asList(debitPurchases, debitTax, creditCash));
        accountingService.postJournalEntry(jeRequest);

        return savedOrder;
    }
}
