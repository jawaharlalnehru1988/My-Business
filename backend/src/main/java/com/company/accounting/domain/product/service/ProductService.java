package com.company.accounting.domain.product.service;

import com.company.accounting.core.exceptions.ResourceNotFoundException;
import com.company.accounting.domain.product.dto.ProductCreateRequest;
import com.company.accounting.domain.product.dto.ProductDto;
import com.company.accounting.domain.product.entity.Product;
import com.company.accounting.domain.product.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import com.company.accounting.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    @Transactional
    public ProductDto createProduct(ProductCreateRequest request) {
        Product product = Product.builder()
                .name(request.getName())
                .sku(request.getSku())
                .hsnSac(request.getHsnSac())
                .basePrice(request.getBasePrice())
                .cgstPercentage(request.getCgstPercentage())
                .sgstPercentage(request.getSgstPercentage())
                .igstPercentage(request.getIgstPercentage())
                .discountPercentage(request.getDiscountPercentage())
                .expiryDate(request.getExpiryDate())
                .tenantId(TenantContext.getCurrentTenant())
                .build();
        
        Product saved = productRepository.save(product);
        return mapToDto(saved);
    }

    @Transactional(readOnly = true)
    public List<ProductDto> getAllProducts() {
        return productRepository.findByTenantId(TenantContext.getCurrentTenant())
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProductDto getProductById(Long id) {
        Product product = productRepository.findByIdAndTenantId(id, TenantContext.getCurrentTenant())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));
        return mapToDto(product);
    }

    @Transactional
    public ProductDto updateProduct(Long id, ProductCreateRequest request) {
        Product product = productRepository.findByIdAndTenantId(id, TenantContext.getCurrentTenant())
                .orElseThrow(() -> new ResourceNotFoundException("Product not found with id: " + id));
        
        product.setName(request.getName());
        product.setSku(request.getSku());
        product.setHsnSac(request.getHsnSac());
        product.setBasePrice(request.getBasePrice());
        product.setCgstPercentage(request.getCgstPercentage());
        product.setSgstPercentage(request.getSgstPercentage());
        product.setIgstPercentage(request.getIgstPercentage());
        product.setDiscountPercentage(request.getDiscountPercentage());
        product.setExpiryDate(request.getExpiryDate());

        Product saved = productRepository.save(product);
        return mapToDto(saved);
    }

    private ProductDto mapToDto(Product product) {
        return ProductDto.builder()
                .id(product.getId())
                .name(product.getName())
                .sku(product.getSku())
                .hsnSac(product.getHsnSac())
                .basePrice(product.getBasePrice())
                .cgstPercentage(product.getCgstPercentage())
                .sgstPercentage(product.getSgstPercentage())
                .igstPercentage(product.getIgstPercentage())
                .discountPercentage(product.getDiscountPercentage())
                .expiryDate(product.getExpiryDate())
                .build();
    }
}
