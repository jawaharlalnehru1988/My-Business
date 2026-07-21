package com.company.accounting_service.domain.template.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "terms_templates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TermsTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String content;
}
