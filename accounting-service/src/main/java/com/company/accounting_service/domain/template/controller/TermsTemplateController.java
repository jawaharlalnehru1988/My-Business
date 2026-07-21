package com.company.accounting_service.domain.template.controller;

import com.company.accounting_service.domain.template.dto.TermsTemplateDTO;
import com.company.accounting_service.domain.template.service.TermsTemplateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/templates")
@RequiredArgsConstructor
public class TermsTemplateController {

    private final TermsTemplateService termsTemplateService;

    @GetMapping
    public ResponseEntity<List<TermsTemplateDTO>> getAllTermsTemplates() {
        return ResponseEntity.ok(termsTemplateService.getAllTermsTemplates());
    }

    @PostMapping
    public ResponseEntity<TermsTemplateDTO> saveTermsTemplate(@RequestBody TermsTemplateDTO termsTemplateDTO) {
        return ResponseEntity.ok(termsTemplateService.saveTermsTemplate(termsTemplateDTO));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTermsTemplate(@PathVariable Long id) {
        termsTemplateService.deleteTermsTemplate(id);
        return ResponseEntity.noContent().build();
    }
}
