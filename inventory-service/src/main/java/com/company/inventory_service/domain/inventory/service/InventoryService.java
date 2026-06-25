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
        Warehouse warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new RuntimeException("Warehouse not found"));

        StockTransaction transaction = StockTransaction.builder()
                .productId(productId)
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


