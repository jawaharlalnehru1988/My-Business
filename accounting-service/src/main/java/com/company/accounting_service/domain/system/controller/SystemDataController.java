package com.company.accounting_service.domain.system.controller;

import com.company.accounting_service.domain.client.dto.ClientDTO;
import com.company.accounting_service.domain.client.service.ClientService;
import com.company.accounting_service.domain.expense.dto.ExpenseDTO;
import com.company.accounting_service.domain.expense.service.ExpenseService;
import com.company.accounting_service.domain.invoice.dto.InvoiceDTO;
import com.company.accounting_service.domain.invoice.service.InvoiceService;
import com.company.accounting_service.domain.meta.entity.MetaSetting;
import com.company.accounting_service.domain.meta.repository.MetaSettingRepository;
import com.company.accounting_service.domain.profile.dto.BusinessProfileDTO;
import com.company.accounting_service.domain.profile.service.BusinessProfileService;
import com.company.accounting_service.domain.purchase.dto.PurchaseDTO;
import com.company.accounting_service.domain.purchase.service.PurchaseService;
import com.company.accounting_service.domain.receipt.dto.ReceiptDTO;
import com.company.accounting_service.domain.receipt.service.ReceiptService;
import com.company.accounting_service.domain.recurring.dto.RecurringInvoiceDTO;
import com.company.accounting_service.domain.recurring.service.RecurringInvoiceService;
import com.company.accounting_service.domain.supplier.dto.SupplierDTO;
import com.company.accounting_service.domain.supplier.service.SupplierService;
import com.company.accounting_service.domain.template.dto.TermsTemplateDTO;
import com.company.accounting_service.domain.template.service.TermsTemplateService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping
@RequiredArgsConstructor
@Slf4j
public class SystemDataController {

    private final InvoiceService invoiceService;
    private final ClientService clientService;
    private final SupplierService supplierService;
    private final ExpenseService expenseService;
    private final PurchaseService purchaseService;
    private final ReceiptService receiptService;
    private final RecurringInvoiceService recurringInvoiceService;
    private final TermsTemplateService termsTemplateService;
    private final BusinessProfileService businessProfileService;
    private final MetaSettingRepository metaSettingRepository;
    private final ObjectMapper objectMapper;

    private static final String BACKUP_DIR_PATH = "backups";

    @GetMapping({"/api/v1/version", "/api/version"})
    public ResponseEntity<Map<String, Object>> getVersion() {
        Map<String, Object> map = new HashMap<>();
        map.put("current", "1.10.31");
        map.put("ok", true);
        map.put("architecture", "microservices");
        return ResponseEntity.ok(map);
    }

    @GetMapping({"/api/v1/check-update", "/api/check-update"})
    public ResponseEntity<Map<String, Object>> checkUpdate() {
        Map<String, Object> map = new HashMap<>();
        map.put("current", "1.10.31");
        map.put("latest", "1.10.31");
        map.put("updateAvailable", false);
        return ResponseEntity.ok(map);
    }

    @GetMapping({"/api/v1/export", "/api/export"})
    public ResponseEntity<Map<String, Object>> exportAll() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("bills", invoiceService.getAllInvoices());
        data.put("profile", businessProfileService.getDefaultProfile());
        data.put("profiles", businessProfileService.getAllProfiles());
        data.put("clients", clientService.getAllClients());
        data.put("suppliers", supplierService.getAllSuppliers());
        data.put("termsTemplates", termsTemplateService.getAllTermsTemplates());
        data.put("expenses", expenseService.getAllExpenses());
        data.put("purchases", purchaseService.getAllPurchases());
        data.put("receipts", receiptService.getAllReceipts());
        data.put("recurring", recurringInvoiceService.getAllRecurringInvoices());
        data.put("products", Collections.emptyList()); // Inventory service manages products

        Map<String, Object> metaMap = new LinkedHashMap<>();
        for (MetaSetting s : metaSettingRepository.findAll()) {
            try {
                Object val = s.getValueJson() != null ? objectMapper.readValue(s.getValueJson(), Object.class) : null;
                metaMap.put(s.getKey(), val);
            } catch (Exception e) {
                metaMap.put(s.getKey(), s.getValueJson());
            }
        }
        data.put("meta", metaMap);
        data.put("exportedAt", Instant.now().toString());
        data.put("__freegstbill_backup", true);

        return ResponseEntity.ok(data);
    }

    @PostMapping({"/api/v1/import", "/api/import"})
    @Transactional
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> importAll(@RequestBody Map<String, Object> data) {
        int billCount = 0;
        int clientCount = 0;
        int supplierCount = 0;
        int expenseCount = 0;
        int purchaseCount = 0;
        int receiptCount = 0;
        int recurringCount = 0;
        int templateCount = 0;
        int profileCount = 0;

        if (data.containsKey("bills") && data.get("bills") instanceof List<?> list) {
            for (Object item : list) {
                try {
                    InvoiceDTO dto = objectMapper.convertValue(item, InvoiceDTO.class);
                    invoiceService.saveInvoice(dto);
                    billCount++;
                } catch (Exception e) {
                    log.warn("Failed to import invoice: {}", item, e);
                }
            }
        }

        if (data.containsKey("clients") && data.get("clients") instanceof List<?> list) {
            for (Object item : list) {
                try {
                    ClientDTO dto = objectMapper.convertValue(item, ClientDTO.class);
                    clientService.saveClient(dto);
                    clientCount++;
                } catch (Exception e) {
                    log.warn("Failed to import client: {}", item, e);
                }
            }
        }

        if (data.containsKey("suppliers") && data.get("suppliers") instanceof List<?> list) {
            for (Object item : list) {
                try {
                    SupplierDTO dto = objectMapper.convertValue(item, SupplierDTO.class);
                    supplierService.saveSupplier(dto);
                    supplierCount++;
                } catch (Exception e) {
                    log.warn("Failed to import supplier: {}", item, e);
                }
            }
        }

        if (data.containsKey("expenses") && data.get("expenses") instanceof List<?> list) {
            for (Object item : list) {
                try {
                    ExpenseDTO dto = objectMapper.convertValue(item, ExpenseDTO.class);
                    expenseService.saveExpense(dto);
                    expenseCount++;
                } catch (Exception e) {
                    log.warn("Failed to import expense: {}", item, e);
                }
            }
        }

        if (data.containsKey("purchases") && data.get("purchases") instanceof List<?> list) {
            for (Object item : list) {
                try {
                    PurchaseDTO dto = objectMapper.convertValue(item, PurchaseDTO.class);
                    purchaseService.savePurchase(dto);
                    purchaseCount++;
                } catch (Exception e) {
                    log.warn("Failed to import purchase: {}", item, e);
                }
            }
        }

        if (data.containsKey("receipts") && data.get("receipts") instanceof List<?> list) {
            for (Object item : list) {
                try {
                    ReceiptDTO dto = objectMapper.convertValue(item, ReceiptDTO.class);
                    receiptService.saveReceipt(dto);
                    receiptCount++;
                } catch (Exception e) {
                    log.warn("Failed to import receipt: {}", item, e);
                }
            }
        }

        if (data.containsKey("recurring") && data.get("recurring") instanceof List<?> list) {
            for (Object item : list) {
                try {
                    RecurringInvoiceDTO dto = objectMapper.convertValue(item, RecurringInvoiceDTO.class);
                    recurringInvoiceService.saveRecurringInvoice(dto);
                    recurringCount++;
                } catch (Exception e) {
                    log.warn("Failed to import recurring: {}", item, e);
                }
            }
        }

        if (data.containsKey("termsTemplates") && data.get("termsTemplates") instanceof List<?> list) {
            for (Object item : list) {
                try {
                    TermsTemplateDTO dto = objectMapper.convertValue(item, TermsTemplateDTO.class);
                    termsTemplateService.saveTermsTemplate(dto);
                    templateCount++;
                } catch (Exception e) {
                    log.warn("Failed to import template: {}", item, e);
                }
            }
        }

        if (data.containsKey("profile") && data.get("profile") instanceof Map<?, ?> prof) {
            try {
                BusinessProfileDTO dto = objectMapper.convertValue(prof, BusinessProfileDTO.class);
                businessProfileService.saveProfile(dto);
                profileCount++;
            } catch (Exception e) {
                log.warn("Failed to import profile: {}", prof, e);
            }
        }

        if (data.containsKey("profiles") && data.get("profiles") instanceof List<?> list) {
            for (Object item : list) {
                try {
                    BusinessProfileDTO dto = objectMapper.convertValue(item, BusinessProfileDTO.class);
                    businessProfileService.saveSpecificProfile(dto);
                    profileCount++;
                } catch (Exception e) {
                    log.warn("Failed to import specific profile: {}", item, e);
                }
            }
        }

        if (data.containsKey("meta") && data.get("meta") instanceof Map<?, ?> metaMap) {
            for (Map.Entry<?, ?> entry : metaMap.entrySet()) {
                String k = String.valueOf(entry.getKey());
                try {
                    String v = objectMapper.writeValueAsString(entry.getValue());
                    MetaSetting ms = metaSettingRepository.findById(k).orElse(MetaSetting.builder().key(k).build());
                    ms.setValueJson(v);
                    metaSettingRepository.save(ms);
                } catch (Exception e) {
                    log.warn("Failed to import meta setting: {}", k, e);
                }
            }
        }

        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("billCount", billCount);
        counts.put("clientCount", clientCount);
        counts.put("supplierCount", supplierCount);
        counts.put("expenseCount", expenseCount);
        counts.put("purchaseCount", purchaseCount);
        counts.put("receiptCount", receiptCount);
        counts.put("recurringCount", recurringCount);
        counts.put("templateCount", templateCount);
        counts.put("profileCount", profileCount);
        counts.put("hasProfile", profileCount > 0);
        return ResponseEntity.ok(counts);
    }

    @GetMapping({"/api/v1/backups", "/api/backups"})
    public ResponseEntity<List<Map<String, Object>>> getBackupsList() {
        File dir = new File(BACKUP_DIR_PATH);
        if (!dir.exists()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        File[] files = dir.listFiles((d, name) -> name.endsWith(".json"));
        if (files == null) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        List<Map<String, Object>> result = new ArrayList<>();
        Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));

        for (File f : files) {
            Map<String, Object> item = new HashMap<>();
            String name = f.getName().replace(".json", "");
            item.put("date", name);
            item.put("size", (f.length() / 1024) + " KB");
            item.put("filename", f.getName());
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping({"/api/v1/backups/now", "/api/backups/now"})
    public ResponseEntity<Map<String, Object>> triggerBackup() {
        try {
            File dir = new File(BACKUP_DIR_PATH);
            if (!dir.exists()) {
                dir.mkdirs();
            }

            String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            File backupFile = new File(dir, dateStr + ".json");

            Map<String, Object> data = exportAll().getBody();
            String json = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(data);
            Files.writeString(backupFile.toPath(), json, StandardCharsets.UTF_8);

            Map<String, Object> res = new HashMap<>();
            res.put("success", true);
            res.put("date", dateStr);
            return ResponseEntity.ok(res);
        } catch (Exception e) {
            log.error("Failed to trigger backup", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping({"/api/v1/backups/{date}/restore", "/api/backups/{date}/restore"})
    public ResponseEntity<Map<String, Object>> restoreBackup(@PathVariable String date) {
        try {
            File file = new File(BACKUP_DIR_PATH, date + ".json");
            if (!file.exists()) {
                return ResponseEntity.status(404).body(Map.of("error", "Backup file not found"));
            }
            String json = Files.readString(file.toPath(), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(json, Map.class);
            return importAll(data);
        } catch (Exception e) {
            log.error("Failed to restore backup: {}", date, e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping({"/api/v1/backups/{date}", "/api/backups/{date}"})
    public ResponseEntity<Map<String, Object>> deleteBackup(@PathVariable String date) {
        File file = new File(BACKUP_DIR_PATH, date + ".json");
        if (file.exists()) {
            file.delete();
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    @PostMapping({"/api/v1/save-pdf", "/api/save-pdf"})
    public ResponseEntity<Map<String, Object>> savePdf() {
        Map<String, Object> res = new HashMap<>();
        res.put("saved", true);
        res.put("relPath", "Saved Invoices");
        return ResponseEntity.ok(res);
    }
}
