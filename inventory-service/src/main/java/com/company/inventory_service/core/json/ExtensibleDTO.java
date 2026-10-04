package com.company.inventory_service.core.json;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;

import java.util.LinkedHashMap;
import java.util.Map;

public abstract class ExtensibleDTO {

    private final Map<String, Object> extraFields = new LinkedHashMap<>();

    @JsonAnySetter
    public void putExtraField(String name, Object value) {
        extraFields.put(name, value);
    }

    @JsonAnyGetter
    public Map<String, Object> anyExtraFields() {
        return extraFields;
    }

    public Map<String, Object> extraFields() {
        return extraFields;
    }
}
