package com.company.accounting_service.domain.client.repository;

import com.company.accounting_service.domain.client.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ClientRepository extends JpaRepository<Client, Long> {

    @Query("SELECT c FROM Client c WHERE c.tenantId = :tenantId")
    List<Client> findByTenant(@Param("tenantId") Long tenantId);

    @Query("SELECT c FROM Client c WHERE c.id = :id AND c.tenantId = :tenantId")
    Optional<Client> findByIdAndTenant(@Param("id") Long id, @Param("tenantId") Long tenantId);
}

