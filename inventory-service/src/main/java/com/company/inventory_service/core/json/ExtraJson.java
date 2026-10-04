package com.company.inventory_service.core.json;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public final class ExtraJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<LinkedHashMap<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private ExtraJson() {}

    public static String write(Map<String, Object> extra) {
        if (extra == null || extra.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(extra);
        } catch (Exception e) {
            throw new IllegalArgumentException("Could not serialise extra fields", e);
        }
    }

    public static Map<String, Object> read(String json) {
        if (json == null || json.isBlank()) return Collections.emptyMap();
        try {
            return MAPPER.readValue(json, MAP_TYPE);
        } catch (Exception e) {
            throw new IllegalStateException("Stored extra_json is not valid JSON", e);
        }
    }
}
