package com.company.accounting_service.domain.meta.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "meta_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MetaSetting {

    @Id
    @Column(name = "setting_key", nullable = false, length = 100)
    private String key;

    @Column(name = "value_json", columnDefinition = "TEXT")
    private String valueJson;

    @Version
    private Long version;
}
