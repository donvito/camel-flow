package io.camelviewer.parse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.util.Set;
import java.util.TreeSet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies camel-yaml-keys.json against the official Camel YAML DSL schema kept in
 * src/test/resources/schema. When the schema is updated with a newer Camel version, this test
 * lists exactly what the parser needs to learn.
 */
class CamelYamlKeysSyncTest {

    @Test
    void keysMatchSchema() throws Exception {
        JsonNode schema;
        try (InputStream in = getClass().getResourceAsStream("/schema/camelYamlDsl.json")) {
            schema = new ObjectMapper().readTree(in);
        }
        JsonNode items = schema.path("items");
        JsonNode defs = items.path("definitions");
        CamelYamlKeys keys = CamelYamlKeys.get();

        Set<String> topLevel = new TreeSet<>();
        items.path("properties").fieldNames().forEachRemaining(topLevel::add);
        assertEquals(topLevel, new TreeSet<>(keys.topLevel()), "top-level elements");

        JsonNode eipDefs = defs.path("org.apache.camel.model.ProcessorDefinition").path("properties");
        Set<String> eips = new TreeSet<>();
        Set<String> containers = new TreeSet<>();
        Set<String> uriEips = new TreeSet<>();
        eipDefs.fields().forEachRemaining(e -> {
            eips.add(e.getKey());
            String ref = e.getValue().path("$ref").asText();
            JsonNode def = defs.path(ref.substring(ref.lastIndexOf('/') + 1));
            if (hasProperty(def, "steps")) containers.add(e.getKey());
            if (hasProperty(def, "uri")) uriEips.add(e.getKey());
        });
        assertEquals(eips, new TreeSet<>(keys.eips()), "EIPs");
        assertEquals(containers, new TreeSet<>(keys.stepContainers()), "EIPs with nested steps");
        assertEquals(uriEips, new TreeSet<>(keys.uriEips()), "EIPs with an endpoint uri");

        Set<String> languages = new TreeSet<>();
        defs.path("org.apache.camel.model.ExpressionSubElementDefinition").path("properties")
                .fieldNames().forEachRemaining(languages::add);
        assertEquals(languages, new TreeSet<>(keys.languages()), "expression languages");

        // Every EIP with an endpoint uri must be handled by the parser's endpoint extraction
        for (String eip : uriEips) {
            assertTrue(Set.of("to", "toD", "poll", "wireTap").contains(eip), "parser does not extract uri from " + eip);
        }
    }

    private static boolean hasProperty(JsonNode def, String name) {
        if (def.path("properties").has(name)) return true;
        for (JsonNode alt : def.path("oneOf")) {
            if (alt.path("properties").has(name)) return true;
        }
        return false;
    }
}
