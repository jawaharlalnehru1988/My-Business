package com.company.accounting_service.domain.profile.controller;

import com.company.accounting_service.domain.profile.dto.BusinessProfileDTO;
import com.company.accounting_service.domain.profile.service.BusinessProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class BusinessProfileController {

    private final BusinessProfileService profileService;

    // ---- Single Profile endpoints (Legacy/Default) ----
    @GetMapping("/api/v1/profile")
    public ResponseEntity<BusinessProfileDTO> getDefaultProfile() {
        return ResponseEntity.ok(profileService.getDefaultProfile());
    }

    @PostMapping("/api/v1/profile")
    public ResponseEntity<BusinessProfileDTO> saveDefaultProfile(@RequestBody BusinessProfileDTO profileDTO) {
        return ResponseEntity.ok(profileService.saveProfile(profileDTO));
    }

    // ---- Multi-Business Profiles endpoints ----
    @GetMapping("/api/v1/profiles")
    public ResponseEntity<List<BusinessProfileDTO>> getAllProfiles() {
        return ResponseEntity.ok(profileService.getAllProfiles());
    }

    @PostMapping("/api/v1/profiles")
    public ResponseEntity<BusinessProfileDTO> saveProfile(@RequestBody BusinessProfileDTO profileDTO) {
        return ResponseEntity.ok(profileService.saveSpecificProfile(profileDTO));
    }

    @DeleteMapping("/api/v1/profiles/{id}")
    public ResponseEntity<Void> deleteProfile(@PathVariable Long id) {
        profileService.deleteProfile(id);
        return ResponseEntity.noContent().build();
    }
}
