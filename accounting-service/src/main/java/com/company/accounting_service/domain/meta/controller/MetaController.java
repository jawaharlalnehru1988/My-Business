package com.company.accounting_service.domain.meta.controller;

import com.company.accounting_service.domain.meta.entity.MetaSetting;
import com.company.accounting_service.domain.meta.repository.MetaSettingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
@RequiredArgsConstructor
@Slf4j
public class MetaController {

    private final MetaSettingRepository metaRepository;
    private final ObjectMapper objectMapper;

    @GetMapping({"/api/v1/meta/{key}", "/api/meta/{key}"})
    public ResponseEntity<Map<String, Object>> getMeta(@PathVariable String key) {
        return metaRepository.findById(key)
                .map(setting -> {
                    try {
                        Object val = setting.getValueJson() != null 
                                ? objectMapper.readValue(setting.getValueJson(), Object.class) 
                                : null;
                        return ResponseEntity.ok(Map.of("value", (Object) val));
                    } catch (Exception e) {
                        return ResponseEntity.ok(Map.of("value", (Object) setting.getValueJson()));
                    }
                })
                .orElseGet(() -> ResponseEntity.ok(new HashMap<String, Object>() {{ put("value", null); }}));
    }

    @GetMapping({"/api/v1/meta", "/api/meta"})
    public ResponseEntity<Map<String, Object>> getAllMeta() {
        List<MetaSetting> list = metaRepository.findAll();
        Map<String, Object> result = new HashMap<>();
        for (MetaSetting s : list) {
            try {
                Object val = s.getValueJson() != null 
                        ? objectMapper.readValue(s.getValueJson(), Object.class) 
                        : null;
                result.put(s.getKey(), val);
            } catch (Exception e) {
                result.put(s.getKey(), s.getValueJson());
            }
        }
        return ResponseEntity.ok(result);
    }

    @PostMapping({"/api/v1/meta/{key}", "/api/meta/{key}"})
    @Transactional
    public ResponseEntity<Map<String, Object>> setMeta(@PathVariable String key, @RequestBody(required = false) Map<String, Object> body) {
        Object valToStore = body != null && body.containsKey("value") ? body.get("value") : body;
        String jsonStr = null;
        try {
            if (valToStore != null) {
                jsonStr = objectMapper.writeValueAsString(valToStore);
            }
        } catch (Exception e) {
            log.error("Failed to serialize meta value for key: {}", key, e);
            jsonStr = String.valueOf(valToStore);
        }

        MetaSetting setting = metaRepository.findById(key)
                .orElse(MetaSetting.builder().key(key).build());
        setting.setValueJson(jsonStr);
        metaRepository.save(setting);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        return ResponseEntity.ok(res);
    }

    @PostMapping({"/api/v1/meta/{key}/increment", "/api/meta/{key}/increment"})
    @Transactional
    public synchronized ResponseEntity<Map<String, Object>> incrementMeta(@PathVariable String key) {
        MetaSetting setting = metaRepository.findById(key)
                .orElse(MetaSetting.builder().key(key).build());

        long current = 0L;
        if (setting.getValueJson() != null) {
            try {
                Object parsed = objectMapper.readValue(setting.getValueJson(), Object.class);
                if (parsed instanceof Number num) {
                    current = num.longValue();
                } else if (parsed != null) {
                    current = Long.parseLong(parsed.toString().trim());
                }
            } catch (Exception ignored) {
                try {
                    current = Long.parseLong(setting.getValueJson().trim());
                } catch (Exception ignored2) {}
            }
        }

        long next = current + 1;
        try {
            setting.setValueJson(objectMapper.writeValueAsString(next));
        } catch (Exception e) {
            setting.setValueJson(String.valueOf(next));
        }
        metaRepository.save(setting);

        Map<String, Object> res = new HashMap<>();
        res.put("value", next);
        return ResponseEntity.ok(res);
    }
}
