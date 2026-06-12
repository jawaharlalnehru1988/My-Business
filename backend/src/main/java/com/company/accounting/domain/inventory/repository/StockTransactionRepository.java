package com.company.accounting.domain.inventory.repository;

import com.company.accounting.domain.inventory.entity.StockTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface StockTransactionRepository extends JpaRepository<StockTransaction, Long> {
    
    List<StockTransaction> findByProductId(Long productId);

    @Query("SELECT COALESCE(SUM(st.quantity), 0) FROM StockTransaction st WHERE st.product.id = :productId AND st.warehouse.id = :warehouseId")
    BigDecimal calculateStockBalance(@Param("productId") Long productId, @Param("warehouseId") Long warehouseId);
}
