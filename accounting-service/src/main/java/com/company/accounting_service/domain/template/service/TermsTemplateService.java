package com.company.accounting_service.domain.template.service;

import com.company.accounting_service.domain.template.dto.TermsTemplateDTO;
import com.company.accounting_service.domain.template.entity.TermsTemplate;
import com.company.accounting_service.domain.template.repository.TermsTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TermsTemplateService {

    private final TermsTemplateRepository termsTemplateRepository;

    @Transactional(readOnly = true)
    public List<TermsTemplateDTO> getAllTermsTemplates() {
        return termsTemplateRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public TermsTemplateDTO saveTermsTemplate(TermsTemplateDTO dto) {
        TermsTemplate template;
        if (dto.getId() != null) {
            template = termsTemplateRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Terms Template not found"));
        } else {
            template = new TermsTemplate();
        }

        template.setName(dto.getName());
        template.setContent(dto.getContent());

        template = termsTemplateRepository.save(template);
        return mapToDTO(template);
    }

    @Transactional
    public void deleteTermsTemplate(Long id) {
        termsTemplateRepository.deleteById(id);
    }

    private TermsTemplateDTO mapToDTO(TermsTemplate template) {
        TermsTemplateDTO dto = new TermsTemplateDTO();
        dto.setId(template.getId());
        dto.setName(template.getName());
        dto.setContent(template.getContent());
        return dto;
    }
}
