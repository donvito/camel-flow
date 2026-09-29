package io.camelviewer.parse;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Key lists derived from the official Camel YAML DSL JSON schema ({@code camel-yaml-keys.json}).
 * Keeping them as data lets a test verify them against the schema when Camel adds new EIPs.
 */
public record CamelYamlKeys(
        Set<String> topLevel,
        Set<String> eips,
        Set<String> stepContainers,
        Set<String> uriEips,
        Set<String> expressionEips,
        Set<String> languages,
        Set<String> restVerbs) {

    private static final CamelYamlKeys INSTANCE = load();

    public static CamelYamlKeys get() {
        return INSTANCE;
    }

    private static CamelYamlKeys load() {
        try (InputStream in = CamelYamlKeys.class.getResourceAsStream("/camel-yaml-keys.json")) {
            if (in == null) {
                throw new IllegalStateException("camel-yaml-keys.json missing from classpath");
            }
            JsonNode n = new ObjectMapper().readTree(in);
            return new CamelYamlKeys(
                    set(n, "topLevel"), set(n, "eips"), set(n, "stepContainers"), set(n, "uriEips"),
                    set(n, "expressionEips"), set(n, "languages"), set(n, "restVerbs"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static Set<String> set(JsonNode root, String field) {
        Set<String> s = new LinkedHashSet<>();
        root.path(field).forEach(v -> s.add(v.asText()));
        return Set.copyOf(s);
    }
}
