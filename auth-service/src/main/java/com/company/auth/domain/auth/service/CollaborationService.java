package com.company.auth.domain.auth.service;

import com.company.auth.core.security.CustomUserDetails;
import com.company.auth.core.security.JwtUtil;
import com.company.auth.domain.auth.dto.AuthResponse;
import com.company.auth.domain.auth.dto.InviteRequest;
import com.company.auth.domain.auth.dto.WorkspaceDto;
import com.company.auth.domain.auth.entity.TenantInvitation;
import com.company.auth.domain.auth.entity.TenantMember;
import com.company.auth.domain.auth.entity.User;
import com.company.auth.domain.auth.repository.TenantInvitationRepository;
import com.company.auth.domain.auth.repository.TenantMemberRepository;
import com.company.auth.domain.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CollaborationService {

    private final TenantMemberRepository memberRepository;
    private final TenantInvitationRepository invitationRepository;
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    @Transactional
    public TenantInvitation sendInvitation(String inviterEmail, Long activeTenantId, InviteRequest request) {
        if (request == null || request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            throw new IllegalArgumentException("Invitee email is required.");
        }
        if (activeTenantId == null) {
            throw new IllegalStateException("Active tenant context is required to invite collaborators.");
        }

        String inviteeEmail = request.getEmail().trim().toLowerCase();
        if (inviteeEmail.equalsIgnoreCase(inviterEmail.trim())) {
            throw new IllegalArgumentException("You cannot invite yourself as a partner.");
        }

        // Check if invitee is already an active collaborator/member of this tenant
        Optional<TenantMember> existingMember = memberRepository.findByTenantIdAndUserEmailIgnoreCase(activeTenantId, inviteeEmail);
        if (existingMember.isPresent()) {
            throw new IllegalStateException("User " + inviteeEmail + " is already an accounting partner / member of this business.");
        }

        // Determine business name from current tenant membership or primary user
        String businessName = memberRepository.findByTenantId(activeTenantId).stream()
                .filter(m -> m.getBusinessName() != null && !m.getBusinessName().isEmpty())
                .map(TenantMember::getBusinessName)
                .findFirst()
                .orElse("Business #" + activeTenantId);

        String role = (request.getRole() != null && !request.getRole().trim().isEmpty()) 
                ? request.getRole().trim() 
                : "ACCOUNTING_PARTNER";

        // Check if an invitation is already pending
        List<TenantInvitation> existingPending = invitationRepository.findByTenantIdAndInviteeEmailIgnoreCaseAndStatus(
                activeTenantId, inviteeEmail, "PENDING");
        if (!existingPending.isEmpty()) {
            TenantInvitation existing = existingPending.get(0);
            existing.setUpdatedAt(LocalDateTime.now());
            existing.setBusinessName(businessName);
            existing.setRole(role);
            return invitationRepository.save(existing);
        }

        TenantInvitation invitation = TenantInvitation.builder()
                .tenantId(activeTenantId)
                .businessName(businessName)
                .inviterEmail(inviterEmail.toLowerCase())
                .inviteeEmail(inviteeEmail)
                .role(role)
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        return invitationRepository.save(invitation);
    }

    public List<TenantInvitation> getSentInvitations(Long activeTenantId) {
        if (activeTenantId == null) return List.of();
        return invitationRepository.findByTenantId(activeTenantId);
    }

    @Transactional
    public void revokeInvitation(Long invitationId, Long activeTenantId) {
        if (activeTenantId == null) throw new IllegalStateException("Active tenant required.");
        TenantInvitation inv = invitationRepository.findByIdAndTenantId(invitationId, activeTenantId)
                .orElseThrow(() -> new RuntimeException("Invitation not found."));
        inv.setStatus("REVOKED");
        inv.setUpdatedAt(LocalDateTime.now());
        invitationRepository.save(inv);
    }

    public List<TenantInvitation> getReceivedInvitations(String userEmail) {
        if (userEmail == null || userEmail.trim().isEmpty()) return List.of();
        return invitationRepository.findByInviteeEmailIgnoreCaseAndStatus(userEmail.trim(), "PENDING");
    }

    @Transactional
    public TenantMember acceptInvitation(Long invitationId, String userEmail) {
        if (userEmail == null) throw new IllegalArgumentException("User email required.");
        TenantInvitation inv = invitationRepository.findByIdAndInviteeEmailIgnoreCase(invitationId, userEmail.trim())
                .orElseThrow(() -> new RuntimeException("Invitation not found for current user."));

        if (!"PENDING".equalsIgnoreCase(inv.getStatus())) {
            throw new IllegalStateException("Invitation is no longer pending (current status: " + inv.getStatus() + ").");
        }

        inv.setStatus("ACCEPTED");
        inv.setUpdatedAt(LocalDateTime.now());
        invitationRepository.save(inv);

        // Add or update tenant membership
        Optional<TenantMember> optMember = memberRepository.findByTenantIdAndUserEmailIgnoreCase(inv.getTenantId(), userEmail.trim());
        TenantMember member;
        if (optMember.isPresent()) {
            member = optMember.get();
            member.setRole(inv.getRole());
            member.setBusinessName(inv.getBusinessName());
        } else {
            member = TenantMember.builder()
                    .tenantId(inv.getTenantId())
                    .userEmail(userEmail.trim().toLowerCase())
                    .role(inv.getRole())
                    .businessName(inv.getBusinessName())
                    .createdAt(LocalDateTime.now())
                    .build();
        }
        return memberRepository.save(member);
    }

    @Transactional
    public void rejectInvitation(Long invitationId, String userEmail) {
        if (userEmail == null) throw new IllegalArgumentException("User email required.");
        TenantInvitation inv = invitationRepository.findByIdAndInviteeEmailIgnoreCase(invitationId, userEmail.trim())
                .orElseThrow(() -> new RuntimeException("Invitation not found for current user."));
        inv.setStatus("REJECTED");
        inv.setUpdatedAt(LocalDateTime.now());
        invitationRepository.save(inv);
    }

    public List<TenantMember> getCollaborators(Long activeTenantId) {
        if (activeTenantId == null) return List.of();
        return memberRepository.findByTenantId(activeTenantId);
    }

    @Transactional
    public void removeCollaborator(Long memberId, Long activeTenantId, String currentUserEmail) {
        if (activeTenantId == null) throw new IllegalStateException("Active tenant required.");
        TenantMember member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Collaborator not found."));

        if (!member.getTenantId().equals(activeTenantId)) {
            throw new SecurityException("Cannot remove member belonging to another tenant.");
        }
        if ("OWNER".equalsIgnoreCase(member.getRole())) {
            throw new IllegalArgumentException("Cannot remove the owner of the business.");
        }
        memberRepository.delete(member);
    }

    public List<WorkspaceDto> getMyWorkspaces(String userEmail, Long currentTenantId) {
        if (userEmail == null) return List.of();
        String email = userEmail.trim().toLowerCase();

        List<TenantMember> memberships = memberRepository.findByUserEmailIgnoreCase(email);
        List<WorkspaceDto> result = new ArrayList<>();

        boolean userTenantIncluded = false;
        User user = userRepository.findByEmail(email).orElse(null);

        for (TenantMember m : memberships) {
            boolean isCur = (currentTenantId != null && currentTenantId.equals(m.getTenantId()));
            result.add(WorkspaceDto.builder()
                    .tenantId(m.getTenantId())
                    .businessName(m.getBusinessName() != null ? m.getBusinessName() : "Business #" + m.getTenantId())
                    .role(m.getRole())
                    .current(isCur)
                    .build());
            if (user != null && user.getTenantId() != null && user.getTenantId().equals(m.getTenantId())) {
                userTenantIncluded = true;
            }
        }

        // If user has a primary tenantId not yet recorded in TenantMember, record and add it
        if (user != null && user.getTenantId() != null && !userTenantIncluded) {
            boolean isCur = (currentTenantId != null && currentTenantId.equals(user.getTenantId()));
            String name = "My Business";
            TenantMember ownerMember = TenantMember.builder()
                    .tenantId(user.getTenantId())
                    .userEmail(email)
                    .role("OWNER")
                    .businessName(name)
                    .createdAt(LocalDateTime.now())
                    .build();
            memberRepository.save(ownerMember);

            result.add(0, WorkspaceDto.builder()
                    .tenantId(user.getTenantId())
                    .businessName(name)
                    .role("OWNER")
                    .current(isCur)
                    .build());
        }

        return result;
    }

    @Transactional
    public AuthResponse switchWorkspace(Long targetTenantId, String userEmail) {
        if (targetTenantId == null || userEmail == null) {
            throw new IllegalArgumentException("Tenant ID and user email required.");
        }
        String email = userEmail.trim().toLowerCase();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found."));

        // Verify membership: either primary owner or listed in TenantMember
        boolean authorized = (user.getTenantId() != null && user.getTenantId().equals(targetTenantId));
        String targetRole = "OWNER";
        String targetBusinessName = "My Business";

        Optional<TenantMember> mem = memberRepository.findByTenantIdAndUserEmailIgnoreCase(targetTenantId, email);
        if (mem.isPresent()) {
            authorized = true;
            targetRole = mem.get().getRole();
            if (mem.get().getBusinessName() != null) {
                targetBusinessName = mem.get().getBusinessName();
            }
        }

        if (!authorized) {
            throw new SecurityException("You do not have access to tenant workspace: " + targetTenantId);
        }

        CustomUserDetails userDetails = new CustomUserDetails(user);
        String jwtToken = jwtUtil.generateTokenForTenant(userDetails, targetTenantId);

        return AuthResponse.builder()
                .token(jwtToken)
                .role(targetRole)
                .tenantId(targetTenantId)
                .businessName(targetBusinessName)
                .build();
    }
}
