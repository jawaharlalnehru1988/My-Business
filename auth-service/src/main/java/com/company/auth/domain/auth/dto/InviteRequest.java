package com.company.auth.domain.auth.dto;

import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InviteRequest {
    private String email;
    private String role; // defaults to "ACCOUNTING_PARTNER" if empty
}
