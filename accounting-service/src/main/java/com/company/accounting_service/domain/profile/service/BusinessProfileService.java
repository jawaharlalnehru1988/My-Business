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

@Service
@RequiredArgsConstructor
public class BusinessProfileService {

    private final BusinessProfileRepository profileRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<BusinessProfileDTO> getAllProfiles() {
        return profileRepository.findAll().stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BusinessProfileDTO getDefaultProfile() {
        return profileRepository.findAll().stream().findFirst()
                .map(this::mapToDTO)
                .orElse(new BusinessProfileDTO());
    }

    @Transactional
    public BusinessProfileDTO saveProfile(BusinessProfileDTO dto) {
        BusinessProfile profile;
        if (dto.getId() != null) {
            profile = profileRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Profile not found"));
        } else {
            // For the default `/api/profile` endpoint, if id is null, we either update the first or create new
            List<BusinessProfile> all = profileRepository.findAll();
            if (!all.isEmpty()) {
                profile = all.get(0);
            } else {
                profile = new BusinessProfile();
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

        profile = profileRepository.save(profile);
        return mapToDTO(profile);
    }

    @Transactional
    public BusinessProfileDTO saveSpecificProfile(BusinessProfileDTO dto) {
        BusinessProfile profile;
        if (dto.getId() != null) {
            profile = profileRepository.findById(dto.getId())
                    .orElseThrow(() -> new RuntimeException("Profile not found"));
        } else {
            profile = new BusinessProfile();
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

        profile = profileRepository.save(profile);
        return mapToDTO(profile);
    }

    @Transactional
    public void deleteProfile(Long id) {
        profileRepository.deleteById(id);
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

        return dto;
    }
}
