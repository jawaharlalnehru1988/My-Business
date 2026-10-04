package com.company.inventory_service.domain.inventory.service;

import com.company.inventory_service.domain.inventory.dto.ProductDTO;
import com.company.inventory_service.domain.inventory.entity.Product;
import com.company.inventory_service.domain.inventory.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

import com.company.inventory_service.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    @Transactional(readOnly = true)
    public List<ProductDTO> getAllProducts() {
        return productRepository.findByTenant(TenantContext.getCurrentTenant()).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public ProductDTO saveProduct(ProductDTO dto) {
        Product product;
        if (dto.getId() != null) {
            product = productRepository.findByIdAndTenant(dto.getId(), TenantContext.getCurrentTenant())
                    .orElseThrow(() -> new RuntimeException("Product not found"));
        } else {
            product = new Product();
            product.setTenantId(TenantContext.getCurrentTenant());
        }

        product.setName(dto.getName());
        product.setHsn(dto.getHsn());
        product.setPurchasePrice(dto.getPurchasePrice());
        product.setSellingPrice(dto.getSellingPrice());
        product.setRate(dto.getRate());
        product.setTaxPercent(dto.getTaxPercent());
        product.setUnit(dto.getUnit());
        product.setStock(dto.getStock());
        product.setDescription(dto.getDescription());
        product.setExtraJson(com.company.inventory_service.core.json.ExtraJson.write(dto.extraFields()));

        product = productRepository.save(product);
        return mapToDTO(product);
    }

    @Transactional
    public void deleteProduct(Long id) {
        Product product = productRepository.findByIdAndTenant(id, TenantContext.getCurrentTenant())
                .orElseThrow(() -> new RuntimeException("Product not found"));
        productRepository.delete(product);
    }

    private ProductDTO mapToDTO(Product product) {
        ProductDTO dto = new ProductDTO();
        dto.setId(product.getId());
        dto.setName(product.getName());
        dto.setHsn(product.getHsn());
        dto.setPurchasePrice(product.getPurchasePrice());
        dto.setSellingPrice(product.getSellingPrice());
        dto.setRate(product.getRate());
        dto.setTaxPercent(product.getTaxPercent());
        dto.setUnit(product.getUnit());
        dto.setStock(product.getStock());
        dto.setDescription(product.getDescription());
        dto.extraFields().putAll(com.company.inventory_service.core.json.ExtraJson.read(product.getExtraJson()));
        return dto;
    }
}
