package com.company.auth.domain.auth.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceDto {
    private Long tenantId;
    private String businessName;
    private String role;
    private boolean current;
}
