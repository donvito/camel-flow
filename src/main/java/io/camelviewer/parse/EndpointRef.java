package io.camelviewer.parse;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import io.camelviewer.graph.ComponentCatalog;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * An endpoint referenced by a route, either consumed ({@code from}) or produced to ({@code to}, {@code toD}, ...).
 *
 * @param uri        the URI as written, including any query string
 * @param scheme     component scheme, lower-case ({@code kafka}, {@code direct}, ...); may be empty for fully dynamic URIs
 * @param path       the part after {@code scheme:}, without query and leading slashes
 * @param parameters query parameters merged with the YAML {@code parameters} map
 * @param dynamic    true when the URI is computed at runtime (simple expressions, recipientList, ...)
 * @param eip        the EIP that references it ({@code from}, {@code to}, {@code toD}, {@code wireTap}, ...)
 * @param consumer   true for {@code from} (the route consumes from this endpoint)
 */
public record EndpointRef(
        String uri,
        String scheme,
        String path,
        Map<String, Object> parameters,
        boolean dynamic,
        String eip,
        boolean consumer) {

    public static EndpointRef of(String rawUri, Map<String, Object> yamlParams, String eip, boolean consumer, boolean forceDynamic) {
        String raw = rawUri == null ? "" : rawUri.trim();
        // Only toD/wireTap/enrich evaluate ${...}; in a plain "to" it is component syntax (e.g. sql ":#${header.id}")
        boolean dynamic = forceDynamic;
        String scheme = "";
        String rest = raw;
        int colon = raw.indexOf(':');
        if (colon > 0 && raw.substring(0, colon).matches("[A-Za-z][A-Za-z0-9+.-]*")) {
            scheme = raw.substring(0, colon).toLowerCase(Locale.ROOT);
            rest = raw.substring(colon + 1);
        } else if (colon < 0 && raw.matches("[A-Za-z][A-Za-z0-9+.-]*")) {
            // "uri: kafka" with everything in parameters (a style some tools emit)
            scheme = raw.toLowerCase(Locale.ROOT);
            rest = "";
        }
        String query = null;
        int q = rest.indexOf('?');
        if (q >= 0) {
            query = rest.substring(q + 1);
            rest = rest.substring(0, q);
        }
        while (rest.startsWith("/") && !scheme.equals("file") && !scheme.equals("platform-http") && !scheme.startsWith("rest")) {
            rest = rest.substring(1);
        }
        if (scheme.equals("file") && rest.startsWith("//")) {
            rest = rest.substring(2);
        }
        Map<String, Object> params = new LinkedHashMap<>();
        if (query != null && !query.isEmpty()) {
            for (String pair : query.split("&")) {
                if (pair.isEmpty()) continue;
                int eq = pair.indexOf('=');
                String k = eq < 0 ? pair : pair.substring(0, eq);
                String v = eq < 0 ? "" : pair.substring(eq + 1);
                params.put(decode(k), decode(v));
            }
        }
        if (yamlParams != null) {
            params.putAll(yamlParams);
        }
        // Kaoto and the YAML DSL allow the URI path as parameters ("uri: direct" + "name: x");
        // fold them back into the path so it reads "direct:x" and links like any other form.
        if (rest.isEmpty() && !scheme.isEmpty()) {
            List<String> parts = new ArrayList<>();
            for (String p : ComponentCatalog.pathParams(scheme)) {
                Object v = params.get(p);
                if (v != null && !String.valueOf(v).isBlank()) {
                    parts.add(String.valueOf(v));
                    params.remove(p);
                }
            }
            if (!parts.isEmpty()) {
                rest = String.join(":", parts);
                raw = scheme + ":" + rest + (query == null || query.isEmpty() ? "" : "?" + query);
            }
        }
        return new EndpointRef(raw, scheme, rest, params, dynamic, eip, consumer);
    }

    /** A parameter as string, or null. */
    public String param(String name) {
        Object v = parameters.get(name);
        return v == null ? null : String.valueOf(v);
    }

    /** The URI including YAML parameters, for display in the technical view. */
    public String displayUri() {
        if (parameters.isEmpty() || scheme.isEmpty()) {
            return uri;
        }
        StringBuilder sb = new StringBuilder(scheme).append(':').append(path);
        char sep = '?';
        for (Map.Entry<String, Object> e : parameters.entrySet()) {
            sb.append(sep).append(e.getKey()).append('=').append(e.getValue());
            sep = '&';
        }
        return sb.toString();
    }

    private static String decode(String s) {
        try {
            return URLDecoder.decode(s, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return s;
        }
    }
}
