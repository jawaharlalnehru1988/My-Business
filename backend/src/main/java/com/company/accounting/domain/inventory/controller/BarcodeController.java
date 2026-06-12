package com.company.accounting.domain.inventory.controller;

import com.company.accounting.domain.inventory.service.BarcodeGeneratorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/barcodes")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class BarcodeController {

    private final BarcodeGeneratorService barcodeGeneratorService;

    @GetMapping("/generate")
    public ResponseEntity<Map<String, String>> generateBarcode(@RequestParam String content) {
        try {
            String base64Image = barcodeGeneratorService.generateBarcodeBase64(content);
            Map<String, String> response = new HashMap<>();
            response.put("barcodeText", content);
            response.put("image", base64Image);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
