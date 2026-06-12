package com.company.accounting.domain.reporting.controller;

import com.company.accounting.domain.reporting.dto.DashboardMetricsDTO;
import com.company.accounting.domain.reporting.service.ReportingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
@RequiredArgsConstructor
public class ReportingController {

    private final ReportingService reportingService;

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardMetricsDTO> getDashboardMetrics() {
        return ResponseEntity.ok(reportingService.getDashboardMetrics());
    }
}
