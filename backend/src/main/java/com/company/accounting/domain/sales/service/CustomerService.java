package com.company.accounting.domain.sales.service;

import com.company.accounting.domain.sales.entity.Customer;
import com.company.accounting.domain.sales.repository.CustomerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import com.company.accounting.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;

    public List<Customer> getAllCustomers() {
        return customerRepository.findByTenantId(TenantContext.getCurrentTenant());
    }

    @Transactional
    public Customer createCustomer(Customer customer) {
        if (customer.getTenantId() == null) customer.setTenantId(TenantContext.getCurrentTenant());
        return customerRepository.save(customer);
    }
}
