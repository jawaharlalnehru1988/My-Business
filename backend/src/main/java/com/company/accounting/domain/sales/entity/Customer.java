package com.company.accounting.domain.sales.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "customers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String phone;
    private String email;

    @Column(name = "gst_number")
    private String gstNumber;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;
}
