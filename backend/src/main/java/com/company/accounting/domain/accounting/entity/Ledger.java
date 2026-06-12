package com.company.accounting.domain.accounting.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "ledgers", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"name", "tenant_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ledger {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "account_group", nullable = false)
    private String accountGroup; // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE

    @Column(name = "current_balance", nullable = false, precision = 15, scale = 2)
    @Builder.Default
    private BigDecimal currentBalance = BigDecimal.ZERO;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;
}
