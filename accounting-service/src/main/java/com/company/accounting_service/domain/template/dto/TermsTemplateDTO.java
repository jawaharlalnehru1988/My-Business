package com.company.accounting_service.domain.template.dto;

import com.company.accounting_service.core.json.ExtensibleDTO;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = false)
public class TermsTemplateDTO extends ExtensibleDTO {
    private Long id;
    private String name;
    private String content;
}
