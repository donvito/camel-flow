package io.camelviewer.parse;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import io.camelviewer.graph.ComponentCatalog;
import io.camelviewer.graph.Endpoints;
import io.camelviewer.graph.StepLabels;
import io.camelviewer.model.Graph.Branch;
import io.camelviewer.model.Graph.StepNode;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses Camel YAML DSL files (plain route lists, Kubernetes {@code Integration}, {@code Pipe},
 * {@code KameletBinding} and {@code Kamelet} resources) into {@link Parsed} models.
 *
 * <p>The parser is deliberately tolerant: it never needs the Camel runtime and unknown keys are
 * skipped, so files written for any Camel 4.x version (or edited by Kaoto) still render.
 */
public final class CamelYamlParser {

    private static final CamelYamlKeys KEYS = CamelYamlKeys.get();

    /** EIPs whose {@code ref}/{@code method} properties are bean references, not expression languages. */
    private static final Set<String> NO_EXPRESSION = Set.of("bean", "process", "policy", "transacted", "throwException");

    /** Top-level elements that are configuration rather than flows. */
    private static final Set<String> CONFIG_ELEMENTS = Set.of(
            "beans", "dataFormats", "errorHandler", "intercept", "interceptFrom", "interceptSendToEndpoint",
            "onCompletion", "onException", "routeConfiguration", "sslContextParameters", "restConfiguration",
            "transformers", "validators", "semantic");

    private static final Set<String> K8S_KINDS = Set.of("Integration", "Pipe", "KameletBinding", "Kamelet");

    private final YAMLFactory factory = new YAMLFactory();
    private final ObjectMapper mapper = new ObjectMapper(factory);
    private static final ObjectMapper JSON = new ObjectMapper();

    /** A top-level node with its 1-based source line range. */
    private record Item(JsonNode node, int startLine, int endLine) {}

    public Parsed.File parse(String path, String content, boolean uploaded) {
        String[] lines = content.split("\\R", -1);
        List<Item> listItems = new ArrayList<>();
        List<Item> documents = new ArrayList<>();
        try {
            readItems(content, lines, listItems, documents);
        } catch (IOException e) {
            return new Parsed.File(path, uploaded, looksLikeCamel(content), List.of(), List.of(), List.of(), List.of(),
                    shortError(e));
        }

        FileBuilder fb = new FileBuilder(path, lines);
        for (Item item : listItems) {
            fb.topLevelItem(item);
        }
        for (Item doc : documents) {
            fb.document(doc);
        }
        boolean camel = !fb.routes.isEmpty() || !fb.apis.isEmpty() || !fb.templated.isEmpty() || fb.sawCamelConfig;
        return new Parsed.File(path, uploaded, camel, fb.routes, fb.apis, fb.templated, fb.ignored, null);
    }

    /**
     * Re-parses a route template with its {@code {{placeholders}}} replaced by the values of a
     * {@code templatedRoute}, so the instance shows its real endpoints and links.
     */
    public Parsed.Route instantiate(Parsed.Route template, Parsed.TemplatedRoute tr) {
        Map<String, String> values = new LinkedHashMap<>(template.templateDefaults());
        values.putAll(tr.parameters());
        String json;
        try {
            json = JSON.writeValueAsString(template.raw());
            for (Map.Entry<String, String> e : values.entrySet()) {
                if (e.getValue() == null) continue;
                String quoted = JSON.writeValueAsString(e.getValue());
                String inner = quoted.substring(1, quoted.length() - 1);
                json = json.replaceAll("\\{\\{\\s*" + Pattern.quote(e.getKey()) + "\\s*}}", Matcher.quoteReplacement(inner));
            }
            JsonNode body = JSON.readTree(json);
            String[] lines = tr.yaml() == null ? new String[0] : tr.yaml().split("\\R", -1);
            FileBuilder fb = new FileBuilder(tr.file(), lines);
            String id = tr.routeId() != null ? tr.routeId() : template.id() + "-instance";
            JsonNode from = body.has("route") ? body.path("route").path("from") : body.path("from");
            Parsed.Route r = fb.flow(id, false, template.description(), text(body, "note"), "templatedRoute", false,
                    from, tr.startLine(), tr.endLine(), null, Map.of());
            return new Parsed.Route(r.id(), r.generatedId(), r.description(), r.note(), tr.file(), r.kind(), false,
                    r.from(), r.tree(), r.producers(), r.extraConsumes(), tr.startLine(), tr.endLine(), tr.yaml(),
                    r.stepCount(), r.warnings(), null, Map.of());
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    // ---------------------------------------------------------------- reading

    private void readItems(String content, String[] lines, List<Item> listItems, List<Item> documents) throws IOException {
        try (JsonParser p = factory.createParser(content)) {
            JsonToken t;
            while ((t = p.nextToken()) != null) {
                int docStart = p.currentTokenLocation().getLineNr();
                if (t == JsonToken.START_ARRAY) {
                    List<JsonNode> nodes = new ArrayList<>();
                    List<Integer> starts = new ArrayList<>();
                    while ((t = p.nextToken()) != null && t != JsonToken.END_ARRAY) {
                        int line = p.currentTokenLocation().getLineNr();
                        if (t == JsonToken.START_OBJECT) {
                            nodes.add(mapper.readTree(p));
                            starts.add(line);
                        } else {
                            p.skipChildren();
                        }
                    }
                    int arrayEnd = t == null ? lines.length : Math.min(lines.length, p.currentTokenLocation().getLineNr());
                    for (int i = 0; i < nodes.size(); i++) {
                        int start = starts.get(i);
                        int nextStart = i + 1 < nodes.size() ? starts.get(i + 1) - 1 : arrayEnd;
                        listItems.add(new Item(nodes.get(i), start, trimEnd(lines, start, nextStart)));
                    }
                } else if (t == JsonToken.START_OBJECT) {
                    JsonNode n = mapper.readTree(p);
                    int end = Math.min(lines.length, p.currentLocation().getLineNr());
                    documents.add(new Item(n, docStart, trimEnd(lines, docStart, end)));
                } else {
                    p.skipChildren();
                }
            }
        }
    }

    /** Moves the end line up past blank lines, comments and document markers. */
    private static int trimEnd(String[] lines, int start, int end) {
        int e = Math.min(end, lines.length);
        while (e > start) {
            String l = lines[e - 1].trim();
            if (l.isEmpty() || l.startsWith("#") || l.equals("---") || l.equals("...")) {
                e--;
            } else {
                break;
            }
        }
        return Math.max(e, start);
    }

    private static String snippet(String[] lines, int start, int end) {
        if (start < 1 || lines.length == 0) return null;
        StringBuilder sb = new StringBuilder();
        for (int i = start; i <= Math.min(end, lines.length); i++) {
            sb.append(lines[i - 1]).append('\n');
        }
        return sb.toString();
    }

    private static boolean looksLikeCamel(String content) {
        return content.contains("from:") || content.contains("route:") || content.contains("routeTemplate:")
                || content.contains("rest:") || content.contains("camel.apache.org");
    }

    private static String shortError(IOException e) {
        String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        int cut = msg.indexOf("\n at [Source");
        if (cut > 0) msg = msg.substring(0, cut);
        return msg.length() > 600 ? msg.substring(0, 600) + "…" : msg;
    }

    // ---------------------------------------------------------------- per-file state

    private final class FileBuilder {
        final String path;
        final String[] lines;
        final List<Parsed.Route> routes = new ArrayList<>();
        final List<Parsed.Api> apis = new ArrayList<>();
        final List<Parsed.TemplatedRoute> templated = new ArrayList<>();
        final List<String> ignored = new ArrayList<>();
        boolean sawCamelConfig;
        int anonymous;

        // per-flow accumulators
        List<EndpointRef> producers;
        List<String> warnings;
        int stepCount;

        FileBuilder(String path, String[] lines) {
            this.path = path;
            this.lines = lines;
        }

        void topLevelItem(Item item) {
            Iterator<Map.Entry<String, JsonNode>> it = item.node().fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                String key = e.getKey();
                JsonNode body = e.getValue();
                switch (key) {
                    case "route" -> routes.add(route(body, item));
                    case "from" -> routes.add(flow(null, true, text(body, "description"), text(body, "note"), "route",
                            false, body, item.startLine(), item.endLine(), null, Map.of()));
                    case "routeTemplate" -> routes.add(routeTemplate(body, item));
                    case "templatedRoute" -> templated.add(new Parsed.TemplatedRoute(
                            text(body, "routeTemplateRef"), text(body, "routeId"), nameValues(body.path("parameters")),
                            path, item.startLine(), item.endLine(), snippet(lines, item.startLine(), item.endLine())));
                    case "rest" -> rest(body);
                    default -> {
                        if (CONFIG_ELEMENTS.contains(key)) {
                            sawCamelConfig = true;
                            ignored.add(key);
                        } else if (!KEYS.topLevel().contains(key)) {
                            ignored.add(key);
                        }
                    }
                }
            }
        }

        void document(Item doc) {
            JsonNode n = doc.node();
            String kind = text(n, "kind");
            if (kind == null || !K8S_KINDS.contains(kind)) {
                return; // some other YAML (application.yaml, docker-compose, ...)
            }
            String name = text(n.path("metadata"), "name");
            JsonNode spec = n.path("spec");
            switch (kind) {
                case "Integration" -> {
                    for (JsonNode flow : spec.path("flows")) {
                        topLevelItem(new Item(flow, doc.startLine(), doc.endLine()));
                    }
                }
                case "Pipe", "KameletBinding" -> routes.add(pipe(name, n, doc));
                case "Kamelet" -> {
                    JsonNode template = spec.has("template") ? spec.path("template") : spec.path("flow");
                    JsonNode from = template.has("from") ? template.path("from") : template.path("route").path("from");
                    String title = text(spec.path("definition"), "title");
                    String description = text(spec.path("definition"), "description");
                    Map<String, String> defaults = new LinkedHashMap<>();
                    spec.path("definition").path("properties").fields().forEachRemaining(p -> {
                        if (p.getValue().has("default")) defaults.put(p.getKey(), p.getValue().path("default").asText());
                    });
                    Parsed.Route r = flow(name, false, title != null ? title : description, description, "kamelet",
                            true, from, doc.startLine(), doc.endLine(), template, defaults);
                    routes.add(r);
                }
                default -> { }
            }
        }

        Parsed.Route route(JsonNode body, Item item) {
            return flow(text(body, "id"), false, text(body, "description"), text(body, "note"), "route", false,
                    body.path("from"), item.startLine(), item.endLine(), null, Map.of());
        }

        Parsed.Route routeTemplate(JsonNode body, Item item) {
            JsonNode from = body.has("route") ? body.path("route").path("from") : body.path("from");
            Map<String, String> defaults = new LinkedHashMap<>();
            for (JsonNode p : body.path("parameters")) {
                if (p.has("defaultValue")) defaults.put(text(p, "name"), text(p, "defaultValue"));
            }
            String description = text(body, "description");
            if (description == null) description = text(body.path("route"), "description");
            return flow(text(body, "id"), false, description, text(body, "note"), "routeTemplate", true, from,
                    item.startLine(), item.endLine(), body, defaults);
        }

        Parsed.Route pipe(String name, JsonNode n, Item doc) {
            beginFlow();
            JsonNode spec = n.path("spec");
            EndpointRef from = pipeEndpoint(spec.path("source"), "from", true);
            List<StepNode> steps = new ArrayList<>();
            for (JsonNode s : spec.path("steps")) {
                EndpointRef ep = pipeEndpoint(s, "kamelet", false);
                if (ep != null) {
                    producers.add(ep);
                    steps.add(endpointStep("kamelet".equals(ep.scheme()) ? "kamelet" : "to", ep, null, null, null, false));
                }
            }
            EndpointRef sink = pipeEndpoint(spec.path("sink"), "to", false);
            if (sink != null) {
                producers.add(sink);
                steps.add(endpointStep("to", sink, null, null, null, false));
            }
            String description = text(n.path("metadata").path("annotations"), "description");
            StepNode tree = fromStep(from, steps);
            return new Parsed.Route(name != null ? name : "pipe-" + (++anonymous), name == null, description, null, path,
                    "pipe", false, from, tree, producers, List.of(), doc.startLine(), doc.endLine(),
                    snippet(lines, doc.startLine(), doc.endLine()), stepCount, warnings, null, Map.of());
        }

        EndpointRef pipeEndpoint(JsonNode node, String eip, boolean consumer) {
            if (node == null || node.isMissingNode() || node.isNull()) return null;
            Map<String, Object> props = toMap(node.path("properties"));
            if (node.hasNonNull("uri")) {
                return EndpointRef.of(node.path("uri").asText(), props, eip, consumer, false);
            }
            JsonNode ref = node.path("ref");
            String refKind = text(ref, "kind");
            String refName = text(ref, "name");
            if (refName == null) return null;
            String uri = switch (refKind == null ? "" : refKind) {
                case "Kamelet" -> "kamelet:" + refName;
                case "KafkaTopic" -> "kafka:" + refName;
                case "Broker" -> "knative:event/" + refName;
                case "Channel", "InMemoryChannel" -> "knative:channel/" + refName;
                case "Service" -> "knative:endpoint/" + refName;
                default -> (refKind == null ? "ref" : refKind.toLowerCase(Locale.ROOT)) + ":" + refName;
            };
            return EndpointRef.of(uri, props, eip, consumer, false);
        }

        void rest(JsonNode body) {
            String base = text(body, "path");
            String restId = text(body, "id");
            if (body.has("openApi")) {
                JsonNode oa = body.path("openApi");
                String spec = text(oa, "specification");
                apis.add(new Parsed.Api(restId != null ? restId : "openapi-" + apis.size(), "OPENAPI",
                        spec == null ? "OpenAPI contract" : spec, text(oa, "description"), null, path));
            }
            for (String verb : KEYS.restVerbs()) {
                JsonNode v = body.path(verb);
                List<JsonNode> ops = new ArrayList<>();
                if (v.isArray()) v.forEach(ops::add);
                else if (v.isObject()) ops.add(v);
                for (JsonNode op : ops) {
                    String full = joinPath(base, text(op, "path"));
                    JsonNode to = op.path("to");
                    String toUri = to.isTextual() ? to.asText() : text(to, "uri");
                    String id = text(op, "id");
                    if (id == null) id = verb.toUpperCase(Locale.ROOT) + " " + full;
                    apis.add(new Parsed.Api(id, verb.toUpperCase(Locale.ROOT), full, text(op, "description"), toUri, path));
                }
            }
        }

        void beginFlow() {
            producers = new ArrayList<>();
            warnings = new ArrayList<>();
            stepCount = 0;
        }

        Parsed.Route flow(String id, boolean legacyFrom, String description, String note, String kind, boolean template,
                          JsonNode fromNode, int startLine, int endLine, JsonNode raw, Map<String, String> defaults) {
            beginFlow();
            boolean generated = id == null || id.isBlank();
            String routeId = generated ? baseName(path) + "#" + (++anonymous) : id;
            if (legacyFrom && fromNode.hasNonNull("id")) {
                routeId = fromNode.path("id").asText();
                generated = false;
            }
            EndpointRef from = null;
            List<String> extraConsumes = new ArrayList<>();
            if (fromNode != null && !fromNode.isMissingNode()) {
                String uri = text(fromNode, "uri");
                if (uri == null) {
                    warnings.add("route '" + routeId + "': 'from' has no uri");
                } else {
                    from = EndpointRef.of(uri, toMap(fromNode.path("parameters")), "from", true, false);
                }
            } else {
                warnings.add("route '" + routeId + "': missing 'from'");
            }
            if (template) {
                // Templates and Kamelets are reachable through the kamelet component by their id.
                extraConsumes.add("kamelet:" + routeId);
                if (from != null && "kamelet".equals(from.scheme()) && "source".equals(from.path())) {
                    from = EndpointRef.of("kamelet:" + routeId, from.parameters(), "from", true, false);
                    extraConsumes.clear();
                }
            }
            if (description == null && fromNode != null) {
                description = text(fromNode, "description");
            }
            List<StepNode> steps = fromNode == null ? List.of() : steps(fromNode.path("steps"));
            if (template) {
                producers.removeIf(p -> "kamelet".equals(p.scheme()) && "sink".equals(p.path()));
            }
            StepNode tree = fromStep(from, steps);
            return new Parsed.Route(routeId, generated, description, note, path, kind, template, from, tree,
                    producers, extraConsumes, startLine, endLine, snippet(lines, startLine, endLine), stepCount,
                    warnings, raw, defaults);
        }

        StepNode fromStep(EndpointRef from, List<StepNode> steps) {
            if (from == null) {
                return new StepNode("from", "Starts", null, null, null, null, null, null, null, null, null,
                        false, false, false, null, List.of(), steps);
            }
            ComponentCatalog.Entry entry = ComponentCatalog.lookup(from.scheme());
            return new StepNode("from", Endpoints.triggerLabel(from), null, null, null, from.displayUri(),
                    from.parameters(), null, entry.category(), from.scheme(), systemLabel(from, entry), from.dynamic(),
                    false, entry.internal(), Endpoints.linkKey(from), List.of(), steps);
        }

        List<StepNode> steps(JsonNode arr) {
            List<StepNode> out = new ArrayList<>();
            if (arr == null || !arr.isArray()) return out;
            for (JsonNode s : arr) {
                StepNode n = step(s);
                if (n != null) out.add(n);
            }
            return out;
        }

        StepNode step(JsonNode item) {
            String eip;
            JsonNode v;
            if (item.isTextual()) {
                eip = item.asText();
                v = JsonNodeFactory.instance.nullNode();
            } else if (item.isObject() && item.size() > 0) {
                Map.Entry<String, JsonNode> first = item.fields().next();
                eip = first.getKey();
                v = first.getValue();
            } else {
                return null;
            }
            stepCount++;
            String id = text(v, "id");
            String description = text(v, "description");
            String note = text(v, "note");
            boolean disabled = v.path("disabled").asBoolean(false);
            String expression = NO_EXPRESSION.contains(eip) ? null : expression(v);

            // Endpoint-producing EIPs
            List<EndpointRef> eps = endpoints(eip, v, expression);
            if (eps.size() == 1 && !List.of("recipientList").contains(eip)) {
                EndpointRef ep = eps.get(0);
                if (!disabled) producers.add(ep);
                List<StepNode> children = v.isObject() ? steps(v.path("steps")) : List.of();
                return endpointStep(eip, ep, id, description, note, disabled, expression, children);
            }

            List<Branch> branches = new ArrayList<>();
            List<StepNode> children = new ArrayList<>();
            switch (eip) {
                case "choice" -> {
                    for (JsonNode w : v.path("when")) {
                        String label = text(w, "description");
                        branches.add(new Branch(label != null ? label : "when", expression(w), steps(w.path("steps"))));
                    }
                    if (v.has("otherwise")) {
                        JsonNode o = v.path("otherwise");
                        String label = text(o, "description");
                        branches.add(new Branch(label != null ? label : "otherwise", null, steps(o.path("steps"))));
                    }
                }
                case "doTry" -> {
                    branches.add(new Branch("try", null, steps(v.path("steps"))));
                    for (JsonNode c : v.path("doCatch")) {
                        List<String> names = new ArrayList<>();
                        for (JsonNode ex : c.path("exception")) {
                            String n = ex.asText();
                            names.add(n.substring(n.lastIndexOf('.') + 1));
                        }
                        String label = "catch" + (names.isEmpty() ? "" : " " + String.join(", ", names));
                        branches.add(new Branch(label, expression(c.path("onWhen")), steps(c.path("steps"))));
                    }
                    if (v.has("doFinally")) {
                        branches.add(new Branch("finally", null, steps(v.path("doFinally").path("steps"))));
                    }
                }
                case "circuitBreaker" -> {
                    branches.add(new Branch("normal", null, steps(v.path("steps"))));
                    if (v.has("onFallback")) {
                        branches.add(new Branch("fallback", null, steps(v.path("onFallback").path("steps"))));
                    }
                }
                case "multicast", "loadBalance" -> {
                    int i = 1;
                    for (JsonNode s : v.path("steps")) {
                        StepNode n = step(s);
                        if (n != null) branches.add(new Branch(eip.equals("multicast") ? "parallel " + i++ : "option " + i++, null, List.of(n)));
                    }
                }
                case "recipientList" -> {
                    int i = 1;
                    for (EndpointRef ep : eps) {
                        if (!disabled) producers.add(ep);
                        branches.add(new Branch("recipient " + i++, null,
                                List.of(endpointStep("to", ep, null, null, null, disabled, null, List.of()))));
                    }
                }
                default -> {
                    if (v.isObject()) {
                        children.addAll(steps(v.path("steps")));
                        // Unknown future EIPs: treat any nested { steps: [...] } as a branch.
                        v.fields().forEachRemaining(f -> {
                            if (f.getKey().equals("steps")) return;
                            JsonNode fv = f.getValue();
                            if (fv.isObject() && fv.path("steps").isArray()) {
                                branches.add(new Branch(f.getKey(), expression(fv), steps(fv.path("steps"))));
                            } else if (fv.isArray()) {
                                for (JsonNode el : fv) {
                                    if (el.isObject() && el.path("steps").isArray()) {
                                        branches.add(new Branch(f.getKey(), expression(el), steps(el.path("steps"))));
                                    }
                                }
                            }
                        });
                    }
                }
            }
            if (!KEYS.eips().contains(eip)) {
                warnings.add("unknown step '" + eip + "'");
            }
            String label = description != null ? description : stepLabel(eip, v, expression);
            boolean internal = StepLabels.isNoise(eip);
            return new StepNode(eip, label, id, description, note, null, null, expression, "eip", null, null,
                    eps.stream().anyMatch(EndpointRef::dynamic), disabled, internal, null, branches, children);
        }

        StepNode endpointStep(String eip, EndpointRef ep, String id, String description, String note, boolean disabled) {
            return endpointStep(eip, ep, id, description, note, disabled, null, List.of());
        }

        StepNode endpointStep(String eip, EndpointRef ep, String id, String description, String note, boolean disabled,
                              String expression, List<StepNode> children) {
            ComponentCatalog.Entry entry = ComponentCatalog.lookup(ep.scheme());
            String label = description != null ? description : endpointLabel(eip, ep, entry);
            if (ep.dynamic()) {
                warnings.add("dynamic endpoint " + eip + " " + ep.uri());
            }
            return new StepNode(eip, label, id, description, note, ep.displayUri(), ep.parameters(), expression,
                    entry.category(), ep.scheme(), systemLabel(ep, entry), ep.dynamic(), disabled, entry.internal(),
                    Endpoints.linkKey(ep), List.of(), children);
        }

        /** Endpoints referenced by an EIP (empty for non-endpoint EIPs). */
        List<EndpointRef> endpoints(String eip, JsonNode v, String expression) {
            List<EndpointRef> out = new ArrayList<>();
            switch (eip) {
                case "to", "toD", "poll", "wireTap" -> {
                    String uri = v.isTextual() ? v.asText() : text(v, "uri");
                    if (uri != null) {
                        boolean dyn = (eip.equals("toD") || eip.equals("wireTap")) && uri.contains("${");
                        out.add(EndpointRef.of(uri, toMap(v.path("parameters")), eip, false, dyn));
                    }
                }
                case "kamelet" -> {
                    String name = v.isTextual() ? v.asText() : text(v, "name");
                    if (name != null) {
                        out.add(EndpointRef.of(name.startsWith("kamelet:") ? name : "kamelet:" + name,
                                toMap(v.path("parameters")), eip, false, false));
                    }
                }
                case "enrich", "pollEnrich" -> {
                    String[] lang = expressionParts(v);
                    if (lang != null && ("constant".equals(lang[0]) || "simple".equals(lang[0]))) {
                        out.add(EndpointRef.of(lang[1], Map.of(), eip, false, lang[1].contains("${")));
                    } else {
                        out.add(EndpointRef.of("", Map.of(), eip, false, true));
                    }
                }
                case "recipientList" -> {
                    String[] lang = expressionParts(v);
                    if (lang != null && "constant".equals(lang[0])) {
                        String delim = v.hasNonNull("delimiter") ? v.path("delimiter").asText() : ",";
                        for (String u : lang[1].split(Pattern.quote(delim))) {
                            if (!u.isBlank()) out.add(EndpointRef.of(u.trim(), Map.of(), eip, false, false));
                        }
                    } else {
                        out.add(EndpointRef.of("", Map.of(), eip, false, true));
                    }
                }
                case "routingSlip", "dynamicRouter" -> out.add(EndpointRef.of("", Map.of(), eip, false, true));
                default -> { }
            }
            return out;
        }

        String stepLabel(String eip, JsonNode v, String expression) {
            String base = StepLabels.label(eip);
            if (eip.equals("log") && v.isTextual()) return "Log: " + v.asText();
            return base;
        }

        String endpointLabel(String eip, EndpointRef ep, ComponentCatalog.Entry entry) {
            if (ep.dynamic() && ep.scheme().isEmpty()) {
                return switch (eip) {
                    case "routingSlip" -> "Follows a dynamic path";
                    case "dynamicRouter" -> "Routes dynamically";
                    case "recipientList" -> "Sends to a dynamic list";
                    default -> "Sends to a dynamic destination";
                };
            }
            String target = systemLabel(ep, entry);
            String verb = switch (eip) {
                case "wireTap" -> "Sends a copy to ";
                case "enrich" -> "Enriches with ";
                case "poll", "pollEnrich" -> "Fetches from ";
                case "kamelet" -> "Uses ";
                default -> switch (entry.category()) {
                    case "ai" -> "Asks ";
                    case "messaging" -> "Publishes to ";
                    case "database" -> "Updates ";
                    case "email" -> "Emails via ";
                    case "saas" -> "Notifies ";
                    case "file" -> "Stores in ";
                    case "internal" -> entry.linkKind() == ComponentCatalog.LinkKind.ASYNC ? "Hands off to " : "Calls ";
                    default -> "Calls ";
                };
            };
            if ("log".equals(ep.scheme())) return "Log";
            return verb + target;
        }

        /** Friendly name of the system an endpoint talks to, e.g. "Kafka · orders" or "OpenAI · gpt-4o". */
        String systemLabel(EndpointRef ep, ComponentCatalog.Entry entry) {
            String detail = Endpoints.detail(ep);
            if (ep.dynamic() && detail.contains("${")) detail = "dynamic address";
            if (entry.linkFamily() != null && entry.category().equals("internal")) {
                return detail.isEmpty() ? entry.name() : detail;
            }
            return detail.isEmpty() ? entry.name() : entry.name() + " · " + detail;
        }
    }

    // ---------------------------------------------------------------- expressions

    /** "simple: ${header.x} == 'y'" style summary of the expression held by a step, or null. */
    static String expression(JsonNode v) {
        String[] parts = expressionParts(v);
        if (parts == null) return null;
        String text = parts[1].replaceAll("\\s+", " ").trim();
        if (text.length() > 200) text = text.substring(0, 199) + "…";
        return parts[0] + ": " + text;
    }

    /** [language, text] of the expression held by a node, supporting all YAML DSL shorthand forms. */
    static String[] expressionParts(JsonNode v) {
        if (v == null || !v.isObject()) return null;
        if (v.has("expression") && v.path("expression").isObject()) {
            String[] inner = expressionParts(v.path("expression"));
            if (inner != null) return inner;
        }
        for (String lang : KEYS.languages()) {
            if (!v.has(lang)) continue;
            JsonNode l = v.path(lang);
            if (l.isTextual() || l.isNumber() || l.isBoolean()) return new String[]{lang, l.asText()};
            if (l.isObject()) {
                String t = text(l, "expression");
                if (t == null && lang.equals("method")) t = firstNonNull(text(l, "ref"), text(l, "beanType"), "") + "." + firstNonNull(text(l, "method"), "");
                if (t == null && lang.equals("tokenize")) t = text(l, "token");
                if (t == null && lang.equals("header")) t = text(l, "name");
                return new String[]{lang, t == null ? "" : t};
            }
        }
        return null;
    }

    // ---------------------------------------------------------------- helpers

    static String text(JsonNode n, String field) {
        if (n == null || !n.isObject()) return null;
        JsonNode v = n.get(field);
        return v == null || v.isNull() || v.isContainerNode() ? null : v.asText();
    }

    private static String firstNonNull(String... values) {
        for (String v : values) if (v != null) return v;
        return null;
    }

    private Map<String, Object> toMap(JsonNode n) {
        if (n == null || !n.isObject() || n.isEmpty()) return Map.of();
        Map<String, Object> m = new LinkedHashMap<>();
        n.fields().forEachRemaining(e -> {
            JsonNode v = e.getValue();
            m.put(e.getKey(), v.isValueNode() ? v.asText() : mapper.convertValue(v, Object.class));
        });
        return m;
    }

    private static Map<String, String> nameValues(JsonNode arr) {
        Map<String, String> m = new LinkedHashMap<>();
        if (arr.isArray()) {
            for (JsonNode p : arr) {
                String k = text(p, "name");
                if (k != null) m.put(k, text(p, "value"));
            }
        } else if (arr.isObject()) {
            arr.fields().forEachRemaining(e -> m.put(e.getKey(), e.getValue().asText()));
        }
        return m;
    }

    private static String joinPath(String base, String p) {
        String a = base == null ? "" : base.trim();
        String b = p == null ? "" : p.trim();
        if (!a.isEmpty() && !a.startsWith("/")) a = "/" + a;
        if (a.endsWith("/")) a = a.substring(0, a.length() - 1);
        if (!b.isEmpty() && !b.startsWith("/")) b = "/" + b;
        String r = a + b;
        return r.isEmpty() ? "/" : r;
    }

    private static String baseName(String path) {
        String n = path.replace('\\', '/');
        n = n.substring(n.lastIndexOf('/') + 1);
        int dot = n.indexOf('.');
        return dot > 0 ? n.substring(0, dot) : n;
    }
}
