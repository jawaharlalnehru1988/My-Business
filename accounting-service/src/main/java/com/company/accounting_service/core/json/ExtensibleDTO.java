package com.company.accounting_service.core.json;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Base class for DTOs that must round-trip fields the backend does not model
 * explicitly. Jackson normally drops unknown JSON properties silently; with
 * this base class they are captured into {@link #extraFields()}, persisted as
 * JSON on the entity ({@code extra_json} column) and emitted again on read.
 *
 * This keeps the API lossless while the frontend evolves faster than the
 * relational schema. Fields that become important for querying/reporting
 * should be promoted to real columns over time.
 */
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

    /** Mutable view used by services when mapping to/from entities. */
    public Map<String, Object> extraFields() {
        return extraFields;
    }
}
