package com.company.auth.domain.auth.controller;

import com.company.auth.core.security.JwtUtil;
import com.company.auth.domain.auth.dto.AuthResponse;
import com.company.auth.domain.auth.dto.InviteRequest;
import com.company.auth.domain.auth.dto.WorkspaceDto;
import com.company.auth.domain.auth.entity.TenantInvitation;
import com.company.auth.domain.auth.entity.TenantMember;
import com.company.auth.domain.auth.service.CollaborationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class CollaborationController {

    private final CollaborationService collaborationService;
    private final JwtUtil jwtUtil;

    private String extractEmail(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            return jwtUtil.extractUsername(token);
        }
        throw new SecurityException("Missing or invalid Authorization header");
    }

    private Long extractTenantId(String authHeader, String tenantHeader) {
        if (tenantHeader != null && !tenantHeader.trim().isEmpty() && !tenantHeader.equalsIgnoreCase("null") && !tenantHeader.equalsIgnoreCase("undefined")) {
            try {
                return Long.parseLong(tenantHeader.trim());
            } catch (Exception ignored) {}
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            return jwtUtil.extractTenantId(token);
        }
        return null;
    }

    @PostMapping("/invitations")
    public ResponseEntity<?> sendInvitation(
            @RequestHeader(value = "Authorization") String authHeader,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantHeader,
            @RequestBody InviteRequest request) {
        String email = extractEmail(authHeader);
        Long tenantId = extractTenantId(authHeader, tenantHeader);
        TenantInvitation inv = collaborationService.sendInvitation(email, tenantId, request);
        return ResponseEntity.ok(inv);
    }

    @GetMapping("/invitations/sent")
    public ResponseEntity<List<TenantInvitation>> getSentInvitations(
            @RequestHeader(value = "Authorization") String authHeader,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantHeader) {
        Long tenantId = extractTenantId(authHeader, tenantHeader);
        return ResponseEntity.ok(collaborationService.getSentInvitations(tenantId));
    }

    @DeleteMapping("/invitations/{id}")
    public ResponseEntity<?> revokeInvitation(
            @RequestHeader(value = "Authorization") String authHeader,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantHeader,
            @PathVariable Long id) {
        Long tenantId = extractTenantId(authHeader, tenantHeader);
        collaborationService.revokeInvitation(id, tenantId);
        return ResponseEntity.ok(Map.of("message", "Invitation revoked successfully"));
    }

    @GetMapping("/invitations/received")
    public ResponseEntity<List<TenantInvitation>> getReceivedInvitations(
            @RequestHeader(value = "Authorization") String authHeader) {
        String email = extractEmail(authHeader);
        return ResponseEntity.ok(collaborationService.getReceivedInvitations(email));
    }

    @PostMapping("/invitations/{id}/accept")
    public ResponseEntity<?> acceptInvitation(
            @RequestHeader(value = "Authorization") String authHeader,
            @PathVariable Long id) {
        String email = extractEmail(authHeader);
        TenantMember member = collaborationService.acceptInvitation(id, email);
        return ResponseEntity.ok(member);
    }

    @PostMapping("/invitations/{id}/reject")
    public ResponseEntity<?> rejectInvitation(
            @RequestHeader(value = "Authorization") String authHeader,
            @PathVariable Long id) {
        String email = extractEmail(authHeader);
        collaborationService.rejectInvitation(id, email);
        return ResponseEntity.ok(Map.of("message", "Invitation rejected"));
    }

    @GetMapping("/collaborators")
    public ResponseEntity<List<TenantMember>> getCollaborators(
            @RequestHeader(value = "Authorization") String authHeader,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantHeader) {
        Long tenantId = extractTenantId(authHeader, tenantHeader);
        return ResponseEntity.ok(collaborationService.getCollaborators(tenantId));
    }

    @DeleteMapping("/collaborators/{id}")
    public ResponseEntity<?> removeCollaborator(
            @RequestHeader(value = "Authorization") String authHeader,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantHeader,
            @PathVariable Long id) {
        String email = extractEmail(authHeader);
        Long tenantId = extractTenantId(authHeader, tenantHeader);
        collaborationService.removeCollaborator(id, tenantId, email);
        return ResponseEntity.ok(Map.of("message", "Collaborator removed successfully"));
    }

    @GetMapping("/workspaces")
    public ResponseEntity<List<WorkspaceDto>> getWorkspaces(
            @RequestHeader(value = "Authorization") String authHeader,
            @RequestHeader(value = "X-Tenant-ID", required = false) String tenantHeader) {
        String email = extractEmail(authHeader);
        Long tenantId = extractTenantId(authHeader, tenantHeader);
        return ResponseEntity.ok(collaborationService.getMyWorkspaces(email, tenantId));
    }

    @PostMapping("/workspaces/switch/{targetTenantId}")
    public ResponseEntity<AuthResponse> switchWorkspace(
            @RequestHeader(value = "Authorization") String authHeader,
            @PathVariable Long targetTenantId) {
        String email = extractEmail(authHeader);
        AuthResponse response = collaborationService.switchWorkspace(targetTenantId, email);
        return ResponseEntity.ok(response);
    }
}
