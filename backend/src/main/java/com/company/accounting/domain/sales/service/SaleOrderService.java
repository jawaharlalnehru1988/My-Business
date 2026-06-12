package com.company.accounting.domain.sales.service;

import com.company.accounting.domain.inventory.service.InventoryService;
import com.company.accounting.domain.product.entity.Product;
import com.company.accounting.domain.product.repository.ProductRepository;
import com.company.accounting.domain.sales.dto.SaleOrderCreateRequest;
import com.company.accounting.domain.sales.dto.SaleOrderItemRequest;
import com.company.accounting.domain.sales.entity.Customer;
import com.company.accounting.domain.sales.entity.SaleOrder;
import com.company.accounting.domain.sales.entity.SaleOrderItem;
import com.company.accounting.domain.sales.repository.CustomerRepository;
import com.company.accounting.domain.sales.repository.SaleOrderRepository;
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
public class SaleOrderService {

    private final SaleOrderRepository saleOrderRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final InventoryService inventoryService;
    private final AccountingService accountingService;

    public List<SaleOrder> getAllSaleOrders() {
        return saleOrderRepository.findByTenantId(TenantContext.getCurrentTenant());
    }

    @Transactional
    public SaleOrder createAndCompleteSaleOrder(SaleOrderCreateRequest request) {
        Customer customer = null;
        if (request.getCustomerId() != null && request.getCustomerId() > 0) {
            customer = customerRepository.findById(request.getCustomerId())
                    .orElse(null);
        }

        SaleOrder order = SaleOrder.builder()
                .invoiceNumber("INV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .customer(customer)
                .saleDate(LocalDate.now())
                .status("COMPLETED")
                .tenantId(TenantContext.getCurrentTenant())
                .build();

        BigDecimal totalAmount = BigDecimal.ZERO;
        BigDecimal totalTax = BigDecimal.ZERO;

        for (SaleOrderItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new RuntimeException("Product not found"));

            // Check inventory
            BigDecimal currentStock = inventoryService.getStockBalance(product.getId(), request.getSourceWarehouseId());
            if (currentStock == null || currentStock.compareTo(itemReq.getQuantity()) < 0) {
                throw new RuntimeException("Insufficient stock for product: " + product.getName() + " in the selected warehouse.");
            }

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

            // Integrate with Inventory: Stock OUT (negative quantity)
            inventoryService.adjustStock(
                    product.getId(),
                    request.getSourceWarehouseId(),
                    itemReq.getQuantity().negate(), // IMPORTANT: Negative for Stock OUT
                    "SALE"
            );
        }

        order.setTotalAmount(totalAmount);
        order.setTotalTax(totalTax);
        order.setGrandTotal(totalAmount.add(totalTax));
        SaleOrder savedOrder = saleOrderRepository.save(order);

        // Core Accounting Integration
        Ledger cashLedger = accountingService.getOrCreateLedger("Cash", "ASSET");
        Ledger salesLedger = accountingService.getOrCreateLedger("Sales", "INCOME");
        Ledger taxLedger = accountingService.getOrCreateLedger("Output Tax (GST)", "LIABILITY");

        JournalEntryCreateRequest jeRequest = new JournalEntryCreateRequest();
        jeRequest.setEntryDate(savedOrder.getSaleDate());
        jeRequest.setDescription("POS Sale - " + savedOrder.getInvoiceNumber());
        jeRequest.setReferenceNumber(savedOrder.getInvoiceNumber());

        JournalEntryLineRequest debitCash = new JournalEntryLineRequest();
        debitCash.setLedgerId(cashLedger.getId());
        debitCash.setDebitAmount(savedOrder.getGrandTotal());

        JournalEntryLineRequest creditSales = new JournalEntryLineRequest();
        creditSales.setLedgerId(salesLedger.getId());
        creditSales.setCreditAmount(savedOrder.getTotalAmount());

        JournalEntryLineRequest creditTax = new JournalEntryLineRequest();
        creditTax.setLedgerId(taxLedger.getId());
        creditTax.setCreditAmount(savedOrder.getTotalTax());

        jeRequest.setLines(java.util.Arrays.asList(debitCash, creditSales, creditTax));
        accountingService.postJournalEntry(jeRequest);

        return savedOrder;
    }
}
