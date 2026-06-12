package com.company.accounting.domain.purchase.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "suppliers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "contact_person")
    private String contactPerson;

    private String phone;
    private String email;

    @Column(name = "gst_number")
    private String gstNumber;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;
}
