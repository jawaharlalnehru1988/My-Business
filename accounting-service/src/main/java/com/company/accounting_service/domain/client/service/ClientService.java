package com.company.accounting_service.domain.client.service;

import com.company.accounting_service.domain.client.dto.ClientDTO;
import com.company.accounting_service.domain.client.entity.Client;
import com.company.accounting_service.domain.client.repository.ClientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

import com.company.accounting_service.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class ClientService {

    private final ClientRepository clientRepository;

    @Transactional(readOnly = true)
    public List<ClientDTO> getAllClients() {
        return clientRepository.findByTenant(TenantContext.getCurrentTenant()).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ClientDTO saveClient(ClientDTO dto) {
        Client client;
        if (dto.getId() != null) {
            client = clientRepository.findByIdAndTenant(dto.getId(), TenantContext.getCurrentTenant())
                    .orElseThrow(() -> new RuntimeException("Client not found"));
        } else {
            client = new Client();
            client.setTenantId(TenantContext.getCurrentTenant());
        }

        client.setName(dto.getName());
        client.setAddress(dto.getAddress());
        client.setCity(dto.getCity());
        client.setPin(dto.getPin());
        client.setState(dto.getState());
        client.setGstin(dto.getGstin());
        client.setEmail(dto.getEmail());
        client.setPhone(dto.getPhone());
        client.setCountry(dto.getCountry());
        client.setIsSEZ(dto.getIsSEZ());
        client.setPreferredPaperSize(dto.getPreferredPaperSize());
        client.setPreferredCurrency(dto.getPreferredCurrency());
        client.setAutoPrint(dto.getAutoPrint());
        client.setExtraJson(com.company.accounting_service.core.json.ExtraJson.write(dto.extraFields()));

        client = clientRepository.save(client);
        return mapToDTO(client);
    }

    @Transactional
    public void deleteClient(Long id) {
        Client client = clientRepository.findByIdAndTenant(id, TenantContext.getCurrentTenant())
                .orElseThrow(() -> new RuntimeException("Client not found"));
        clientRepository.delete(client);
    }

    private ClientDTO mapToDTO(Client client) {
        ClientDTO dto = new ClientDTO();
        dto.setId(client.getId());
        dto.setName(client.getName());
        dto.setAddress(client.getAddress());
        dto.setCity(client.getCity());
        dto.setPin(client.getPin());
        dto.setState(client.getState());
        dto.setGstin(client.getGstin());
        dto.setEmail(client.getEmail());
        dto.setPhone(client.getPhone());
        dto.setCountry(client.getCountry());
        dto.setIsSEZ(client.getIsSEZ());
        dto.setPreferredPaperSize(client.getPreferredPaperSize());
        dto.setPreferredCurrency(client.getPreferredCurrency());
        dto.setAutoPrint(client.getAutoPrint());
        dto.extraFields().putAll(com.company.accounting_service.core.json.ExtraJson.read(client.getExtraJson()));
        return dto;
    }
}
