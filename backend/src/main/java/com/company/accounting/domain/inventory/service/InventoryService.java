package com.company.accounting.domain.inventory.service;

import com.company.accounting.domain.inventory.entity.StockTransaction;
import com.company.accounting.domain.inventory.entity.Warehouse;
import com.company.accounting.domain.inventory.repository.StockTransactionRepository;
import com.company.accounting.domain.inventory.repository.WarehouseRepository;
import com.company.accounting.domain.product.entity.Product;
import com.company.accounting.domain.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.company.accounting.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class InventoryService {

    private final StockTransactionRepository stockTransactionRepository;
    private final WarehouseRepository warehouseRepository;
    private final ProductRepository productRepository;

    public List<Warehouse> getAllWarehouses() {
        return warehouseRepository.findByTenantId(TenantContext.getCurrentTenant());
    }

    @Transactional
    public Warehouse createWarehouse(Warehouse warehouse) {
        if (warehouse.getTenantId() == null) warehouse.setTenantId(TenantContext.getCurrentTenant());
        return warehouseRepository.save(warehouse);
    }

    @Transactional
    public StockTransaction adjustStock(Long productId, Long warehouseId, BigDecimal quantity, String transactionType) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Product not found"));
        Warehouse warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new RuntimeException("Warehouse not found"));

        StockTransaction transaction = StockTransaction.builder()
                .product(product)
                .warehouse(warehouse)
                .quantity(quantity)
                .transactionType(transactionType)
                .createdAt(LocalDateTime.now())
                .build();

        return stockTransactionRepository.save(transaction);
    }

    public BigDecimal getStockBalance(Long productId, Long warehouseId) {
        return stockTransactionRepository.calculateStockBalance(productId, warehouseId);
    }
}
