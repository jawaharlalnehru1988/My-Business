package com.company.inventory_service.domain.inventory.service;

import com.company.inventory_service.domain.inventory.entity.StockTransaction;
import com.company.inventory_service.domain.inventory.entity.Warehouse;
import com.company.inventory_service.domain.inventory.repository.StockTransactionRepository;
import com.company.inventory_service.domain.inventory.repository.WarehouseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.company.inventory_service.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final StockTransactionRepository stockTransactionRepository;
    private final WarehouseRepository warehouseRepository;
    private final com.company.inventory_service.domain.inventory.repository.ProductRepository productRepository;
    private final com.company.inventory_service.kafka.producer.InventoryEventProducer inventoryEventProducer;

    public List<Warehouse> getAllWarehouses() {
        return warehouseRepository.findByTenantId(TenantContext.getCurrentTenant());
    }

    @Transactional
    public Warehouse createWarehouse(Warehouse warehouse) {
        if (warehouse.getTenantId() == null) warehouse.setTenantId(TenantContext.getCurrentTenant());
        return warehouseRepository.save(warehouse);
    }

    @Transactional
    public StockTransaction adjustStock(Long productId, Long warehouseId, BigDecimal quantity, String transactionType, BigDecimal unitCost) {
        Warehouse warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new RuntimeException("Warehouse not found"));

        com.company.inventory_service.domain.inventory.entity.Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        // Update product stock
        BigDecimal currentStock = product.getStock() != null ? product.getStock() : BigDecimal.ZERO;
        BigDecimal currentWac = product.getWeightedAverageCost() != null ? product.getWeightedAverageCost() : BigDecimal.ZERO;
        
        BigDecimal actualUnitCost = unitCost;
        if (actualUnitCost == null) {
            actualUnitCost = currentWac; // Use WAC for outbound transactions
        }

        StockTransaction transaction = StockTransaction.builder()
                .productId(productId)
                .warehouse(warehouse)
                .quantity(quantity)
                .unitCost(actualUnitCost)
                .transactionType(transactionType)
                .createdAt(LocalDateTime.now())
                .build();

        stockTransactionRepository.save(transaction);
        
        if (quantity.compareTo(BigDecimal.ZERO) > 0 && unitCost != null) {
            // Recalculate WAC on inbound
            BigDecimal totalValue = currentStock.multiply(currentWac).add(quantity.multiply(unitCost));
            BigDecimal newStock = currentStock.add(quantity);
            if (newStock.compareTo(BigDecimal.ZERO) > 0) {
                product.setWeightedAverageCost(totalValue.divide(newStock, 2, java.math.RoundingMode.HALF_UP));
            }
        }
        
        product.setStock(currentStock.add(quantity));
        productRepository.save(product);

        return transaction;
    }

    public BigDecimal getStockBalance(Long productId, Long warehouseId) {
        return stockTransactionRepository.calculateStockBalance(productId, warehouseId);
    }

    @Transactional
    public void reconcileStock(Long productId, Long warehouseId, BigDecimal observedQuantity) {
        com.company.inventory_service.domain.inventory.entity.Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));

        BigDecimal currentStock = product.getStock() != null ? product.getStock() : BigDecimal.ZERO;
        BigDecimal difference = observedQuantity.subtract(currentStock);

        if (difference.compareTo(BigDecimal.ZERO) == 0) {
            return; // No discrepancy
        }

        String type = difference.compareTo(BigDecimal.ZERO) < 0 ? "SHRINKAGE" : "ADJUSTMENT_UP";
        StockTransaction tx = adjustStock(productId, warehouseId, difference, type, null);

        // If there's shrinkage, publish an event to accounting to log the expense
        if (difference.compareTo(BigDecimal.ZERO) < 0) {
            java.math.BigDecimal totalShrinkageCost = tx.getUnitCost().multiply(difference.negate());
            com.company.inventory_service.kafka.event.InventoryResultEvent event = com.company.inventory_service.kafka.event.InventoryResultEvent.builder()
                    .transactionId("SHRINKAGE_" + tx.getId())
                    .status("SUCCESS")
                    .tenantId(TenantContext.getCurrentTenant())
                    .totalCogs(totalShrinkageCost) // Reusing totalCogs for the expense amount
                    .build();
            inventoryEventProducer.publishEvent(event);
        }
    }
}


