package com.company.accounting_service.domain.profile.service;

import com.company.accounting_service.domain.profile.dto.BusinessProfileDTO;
import com.company.accounting_service.domain.profile.entity.BusinessProfile;
import com.company.accounting_service.domain.profile.repository.BusinessProfileRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.company.accounting_service.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class BusinessProfileService {

    private final BusinessProfileRepository profileRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<BusinessProfileDTO> getAllProfiles() {
        return profileRepository.findByTenant(TenantContext.getCurrentTenant()).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BusinessProfileDTO getDefaultProfile() {
        return profileRepository.findByTenant(TenantContext.getCurrentTenant()).stream().findFirst()
                .map(this::mapToDTO)
                .orElse(new BusinessProfileDTO());
    }

    @Transactional
    public BusinessProfileDTO saveProfile(BusinessProfileDTO dto) {
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Active tenant context is required to save business profile.");
        }
        BusinessProfile profile;
        if (dto.getId() != null) {
            profile = profileRepository.findByIdAndTenant(dto.getId(), tenantId)
                    .orElseThrow(() -> new RuntimeException("Profile not found"));
        } else {
            List<BusinessProfile> all = profileRepository.findByTenant(tenantId);
            if (!all.isEmpty()) {
                profile = all.get(0);
            } else {
                profile = new BusinessProfile();
                profile.setTenantId(tenantId);
            }
        }

        profile.setBusinessName(dto.getBusinessName());
        profile.setAddress(dto.getAddress());
        profile.setState(dto.getState());
        profile.setGstin(dto.getGstin());
        profile.setPan(dto.getPan());
        profile.setEmail(dto.getEmail());
        profile.setPhone(dto.getPhone());
        profile.setBankName(dto.getBankName());
        profile.setAccountNumber(dto.getAccountNumber());
        profile.setIfsc(dto.getIfsc());
        profile.setUpiId(dto.getUpiId());
        profile.setLogo(dto.getLogo());
        profile.setLogoHeight(dto.getLogoHeight());
        profile.setSignature(dto.getSignature());
        profile.setGoogleClientId(dto.getGoogleClientId());
        profile.setGoogleDriveFolder(dto.getGoogleDriveFolder());

        try {
            if (dto.getPaymentAccounts() != null) {
                profile.setPaymentAccountsJson(objectMapper.writeValueAsString(dto.getPaymentAccounts()));
            } else {
                profile.setPaymentAccountsJson(null);
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize payment accounts", e);
        }
        profile.setExtraJson(com.company.accounting_service.core.json.ExtraJson.write(dto.extraFields()));

        profile = profileRepository.save(profile);
        return mapToDTO(profile);
    }

    @Transactional
    public BusinessProfileDTO saveSpecificProfile(BusinessProfileDTO dto) {
        Long tenantId = TenantContext.getCurrentTenant();
        if (tenantId == null) {
            throw new IllegalStateException("Active tenant context is required to save business profile.");
        }
        BusinessProfile profile;
        if (dto.getId() != null) {
            profile = profileRepository.findByIdAndTenant(dto.getId(), tenantId)
                    .orElseThrow(() -> new RuntimeException("Profile not found"));
        } else {
            profile = new BusinessProfile();
            profile.setTenantId(tenantId);
        }

        // Duplicated logic for saving specific profile (handles multi-business)
        profile.setBusinessName(dto.getBusinessName());
        profile.setAddress(dto.getAddress());
        profile.setState(dto.getState());
        profile.setGstin(dto.getGstin());
        profile.setPan(dto.getPan());
        profile.setEmail(dto.getEmail());
        profile.setPhone(dto.getPhone());
        profile.setBankName(dto.getBankName());
        profile.setAccountNumber(dto.getAccountNumber());
        profile.setIfsc(dto.getIfsc());
        profile.setUpiId(dto.getUpiId());
        profile.setLogo(dto.getLogo());
        profile.setLogoHeight(dto.getLogoHeight());
        profile.setSignature(dto.getSignature());
        profile.setGoogleClientId(dto.getGoogleClientId());
        profile.setGoogleDriveFolder(dto.getGoogleDriveFolder());

        try {
            if (dto.getPaymentAccounts() != null) {
                profile.setPaymentAccountsJson(objectMapper.writeValueAsString(dto.getPaymentAccounts()));
            } else {
                profile.setPaymentAccountsJson(null);
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize payment accounts", e);
        }
        profile.setExtraJson(com.company.accounting_service.core.json.ExtraJson.write(dto.extraFields()));

        profile = profileRepository.save(profile);
        return mapToDTO(profile);
    }

    @Transactional
    public void deleteProfile(Long id) {
        BusinessProfile profile = profileRepository.findByIdAndTenant(id, TenantContext.getCurrentTenant())
                .orElseThrow(() -> new RuntimeException("Profile not found"));
        profileRepository.delete(profile);
    }

    private BusinessProfileDTO mapToDTO(BusinessProfile profile) {
        BusinessProfileDTO dto = new BusinessProfileDTO();
        dto.setId(profile.getId());
        dto.setBusinessName(profile.getBusinessName());
        dto.setAddress(profile.getAddress());
        dto.setState(profile.getState());
        dto.setGstin(profile.getGstin());
        dto.setPan(profile.getPan());
        dto.setEmail(profile.getEmail());
        dto.setPhone(profile.getPhone());
        dto.setBankName(profile.getBankName());
        dto.setAccountNumber(profile.getAccountNumber());
        dto.setIfsc(profile.getIfsc());
        dto.setUpiId(profile.getUpiId());
        dto.setLogo(profile.getLogo());
        dto.setLogoHeight(profile.getLogoHeight());
        dto.setSignature(profile.getSignature());
        dto.setGoogleClientId(profile.getGoogleClientId());
        dto.setGoogleDriveFolder(profile.getGoogleDriveFolder());

        try {
            if (profile.getPaymentAccountsJson() != null) {
                dto.setPaymentAccounts(objectMapper.readValue(profile.getPaymentAccountsJson(), new TypeReference<List<Map<String, Object>>>() {}));
            }
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize payment accounts", e);
        }

        dto.extraFields().putAll(com.company.accounting_service.core.json.ExtraJson.read(profile.getExtraJson()));
        return dto;
    }
}
