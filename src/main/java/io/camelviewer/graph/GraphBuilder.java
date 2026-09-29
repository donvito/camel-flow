package io.camelviewer.graph;

import io.camelviewer.model.Graph;
import io.camelviewer.model.Graph.Branch;
import io.camelviewer.model.Graph.StepNode;
import io.camelviewer.model.Graph.StepSummary;
import io.camelviewer.parse.CamelYamlParser;
import io.camelviewer.parse.EndpointRef;
import io.camelviewer.parse.Parsed;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/** Joins parsed files into the route-level graph: which routes call each other and which systems they use. */
public final class GraphBuilder {

    private static final int SUMMARY_LIMIT = 14;

    private final CamelYamlParser parser;

    public GraphBuilder(CamelYamlParser parser) {
        this.parser = parser;
    }

    public Graph build(String rootDir, List<Parsed.File> files) {
        List<String> warnings = new ArrayList<>();
        List<Parsed.Route> flows = new ArrayList<>();
        for (Parsed.File f : files) {
            flows.addAll(f.routes());
        }
        // templatedRoute → concrete instance of its template
        Map<String, Parsed.Route> templates = new HashMap<>();
        for (Parsed.Route r : flows) {
            if (r.template() && r.raw() != null) templates.put(r.id(), r);
        }
        for (Parsed.File f : files) {
            for (Parsed.TemplatedRoute tr : f.templatedRoutes()) {
                Parsed.Route template = templates.get(tr.templateRef());
                Parsed.Route instance = template == null ? null : parser.instantiate(template, tr);
                if (instance == null) {
                    warnings.add(f.path() + ": templatedRoute references unknown template '" + tr.templateRef() + "'");
                } else {
                    flows.add(instance);
                }
            }
        }

        // Stable, unique node ids
        Map<Parsed.Route, String> nodeIds = new LinkedHashMap<>();
        Set<String> used = new HashSet<>();
        for (Parsed.Route r : flows) {
            String base = "route:" + r.id();
            String id = base;
            for (int i = 2; !used.add(id); i++) id = base + "#" + i;
            if (!id.equals(base)) warnings.add("duplicate route id '" + r.id() + "' (" + r.file() + ")");
            nodeIds.put(r, id);
        }

        // Which routes can be reached through which link key
        Map<String, List<String>> consumers = new HashMap<>();
        Map<String, Parsed.Route> byNodeId = new HashMap<>();
        for (Parsed.Route r : flows) {
            String nid = nodeIds.get(r);
            byNodeId.put(nid, r);
            if (r.from() != null) {
                String key = Endpoints.linkKey(r.from());
                if (key != null) consumers.computeIfAbsent(key, k -> new ArrayList<>()).add(nid);
            }
            for (String k : r.extraConsumes()) consumers.computeIfAbsent(k, x -> new ArrayList<>()).add(nid);
        }
        Set<String> producedKeys = new HashSet<>();
        for (Parsed.Route r : flows) {
            for (EndpointRef p : r.producers()) {
                String key = Endpoints.linkKey(p);
                if (key != null) producedKeys.add(key);
            }
        }

        Map<String, SystemAcc> systems = new LinkedHashMap<>();
        Map<String, Graph.Link> links = new LinkedHashMap<>();
        Map<String, Map<String, Set<String>>> routeSystems = new HashMap<>(); // nid → category → system ids

        // APIs (rest DSL)
        List<Graph.Api> apis = new ArrayList<>();
        Set<String> apiIds = new HashSet<>();
        for (Parsed.File f : files) {
            for (Parsed.Api a : f.apis()) {
                String id = "api:" + a.method() + " " + a.path();
                for (int i = 2; !apiIds.add(id); i++) id = "api:" + a.method() + " " + a.path() + "#" + i;
                apis.add(new Graph.Api(id, a.method(), a.path(), a.description(), a.file(), a.toUri()));
                if (a.toUri() != null) {
                    EndpointRef target = EndpointRef.of(a.toUri(), Map.of(), "to", false, false);
                    String key = Endpoints.linkKey(target);
                    List<String> cs = key == null ? List.of() : consumers.getOrDefault(key, List.of());
                    if (cs.isEmpty()) {
                        warnings.add("API " + a.method() + " " + a.path() + " → " + a.toUri() + ": no route consumes it");
                    }
                    for (String c : cs) {
                        addLink(links, id, c, "api", "", key);
                    }
                }
            }
        }

        // Producers: route → route, or route → system
        for (Parsed.Route r : flows) {
            String nid = nodeIds.get(r);
            for (EndpointRef p : r.producers()) {
                ComponentCatalog.Entry entry = ComponentCatalog.lookup(p.scheme());
                String key = Endpoints.linkKey(p);
                List<String> targets = key == null ? List.of() : consumers.getOrDefault(key, List.of());
                if (!targets.isEmpty()) {
                    for (String t : targets) {
                        if (t.equals(nid)) continue;
                        addLink(links, nid, t, linkKind(entry), linkLabel(entry, p), key);
                    }
                    continue;
                }
                SystemAcc s = system(systems, p, entry, key, r.id());
                track(routeSystems, nid, s);
                addLink(links, nid, s.id, "uses", usesLabel(p, entry), key);
            }
        }

        // Consumers: system → route when nothing inside the project feeds the route
        for (Parsed.Route r : flows) {
            EndpointRef f = r.from();
            if (f == null) continue;
            String nid = nodeIds.get(r);
            ComponentCatalog.Entry entry = ComponentCatalog.lookup(f.scheme());
            if (entry.trigger()) continue; // shown as the route's trigger badge
            String key = Endpoints.linkKey(f);
            if (key != null && (producedKeys.contains(key) || isInternalFamily(entry))) continue;
            if (key != null && hasApiFor(links, nid)) continue;
            SystemAcc s = system(systems, f, entry, key, r.id());
            track(routeSystems, nid, s);
            addLink(links, s.id, nid, "triggers", "triggers", key);
        }

        // Title lookup for plain-language summaries
        Map<String, String> titleByKey = new HashMap<>();
        Map<String, String> titles = new HashMap<>();
        for (Parsed.Route r : flows) {
            titles.put(nodeIds.get(r), title(r));
        }
        consumers.forEach((k, v) -> titleByKey.put(k, titles.get(v.get(0))));

        List<Graph.Route> routes = new ArrayList<>();
        for (Parsed.Route r : flows) {
            String nid = nodeIds.get(r);
            Map<String, Set<String>> cats = routeSystems.getOrDefault(nid, Map.of());
            Map<String, Integer> counts = new TreeMap<>();
            int systemCount = 0;
            for (Map.Entry<String, Set<String>> e : cats.entrySet()) {
                if (e.getKey().equals("internal")) continue;
                counts.put(e.getKey(), e.getValue().size());
                systemCount += e.getValue().size();
            }
            Graph.Trigger trigger = null;
            if (r.from() != null) {
                ComponentCatalog.Entry entry = ComponentCatalog.lookup(r.from().scheme());
                trigger = new Graph.Trigger(Endpoints.triggerLabel(r.from()), entry.category(), r.from().displayUri(),
                        r.from().scheme());
            }
            List<StepSummary> summary = new ArrayList<>();
            summarize(r.tree().children(), summary, titleByKey);
            List<String> produces = new ArrayList<>(new LinkedHashSet<>(r.producers().stream()
                    .map(EndpointRef::displayUri).filter(u -> !u.isEmpty()).toList()));
            List<String> consumes = r.from() == null ? List.of() : List.of(r.from().displayUri());
            List<String> rw = new ArrayList<>(r.warnings());
            for (String w : r.warnings()) warnings.add("route '" + r.id() + "': " + w);
            routes.add(new Graph.Route(nid, r.id(), titles.get(nid), r.description(), r.note(), r.file(), r.template(),
                    r.kind(), trigger, summary, systemCount, counts, r.from() == null ? null : r.from().displayUri(),
                    produces, consumes, new int[]{r.startLine(), r.endLine()}, r.yaml(), r.tree(), r.stepCount(), rw));
        }

        List<Graph.FileStatus> fileStatuses = new ArrayList<>();
        for (Parsed.File f : files) {
            if (!f.camel() && f.error() == null) continue;
            int count = f.routes().size() + f.templatedRoutes().size() + f.apis().size(); // flows + REST endpoints
            fileStatuses.add(new Graph.FileStatus(f.path(), count, f.error(), f.uploaded(),
                    f.ignored().isEmpty() ? null : List.copyOf(new LinkedHashSet<>(f.ignored()))));
        }

        List<Graph.SystemNode> systemNodes = systems.values().stream()
                .map(s -> new Graph.SystemNode(s.id, s.label, s.detail, s.category, s.scheme, List.copyOf(s.uris),
                        s.internal, s.dynamic))
                .toList();

        return new Graph(Instant.now().toString(), rootDir, fileStatuses, routes, systemNodes, apis,
                List.copyOf(links.values()), warnings);
    }

    // ---------------------------------------------------------------- helpers

    private static final class SystemAcc {
        String id, label, detail, category, scheme;
        boolean internal, dynamic;
        final Set<String> uris = new LinkedHashSet<>();
    }

    private static SystemAcc system(Map<String, SystemAcc> systems, EndpointRef ep, ComponentCatalog.Entry entry,
                                    String key, String routeId) {
        String detail = Endpoints.detail(ep);
        if (ep.dynamic() && detail.contains("${")) detail = "dynamic address";
        boolean dynamicUnknown = ep.dynamic() && ep.scheme().isEmpty();
        boolean unresolved = key != null && isInternalFamily(entry);
        String id;
        if (dynamicUnknown) {
            id = "sys:dynamic:" + routeId + ":" + ep.eip();
        } else if (key != null) {
            id = "sys:" + key;
        } else {
            id = "sys:" + entry.name().toLowerCase(Locale.ROOT) + ":" + detail.toLowerCase(Locale.ROOT);
        }
        SystemAcc s = systems.get(id);
        if (s == null) {
            s = new SystemAcc();
            s.id = id;
            s.scheme = ep.scheme();
            if (dynamicUnknown) {
                s.label = "Dynamic destination";
                s.detail = ep.eip();
                s.category = "dynamic";
                s.internal = true;
                s.dynamic = true;
            } else if (unresolved) {
                s.label = ep.scheme() + ":" + detail;
                s.detail = "no route found";
                s.category = "unresolved";
                s.internal = false;
            } else {
                s.label = entry.name();
                s.detail = detail;
                s.category = entry.category();
                s.internal = entry.internal();
                s.dynamic = ep.dynamic();
            }
            systems.put(id, s);
        }
        if (!ep.uri().isEmpty()) s.uris.add(ep.displayUri());
        return s;
    }

    private static boolean isInternalFamily(ComponentCatalog.Entry entry) {
        return entry.linkFamily() != null && "internal".equals(entry.category());
    }

    private static boolean hasApiFor(Map<String, Graph.Link> links, String nid) {
        for (Graph.Link l : links.values()) {
            if (l.target().equals(nid) && l.kind().equals("api")) return true;
        }
        return false;
    }

    private static void track(Map<String, Map<String, Set<String>>> routeSystems, String nid, SystemAcc s) {
        routeSystems.computeIfAbsent(nid, k -> new TreeMap<>())
                .computeIfAbsent(s.internal ? "internal" : s.category, k -> new LinkedHashSet<>())
                .add(s.id);
    }

    private static void addLink(Map<String, Graph.Link> links, String source, String target, String kind, String label,
                                String key) {
        String id = source + "->" + target + "|" + (key == null ? kind : key);
        links.putIfAbsent(id, new Graph.Link(id, source, target, kind, label, key));
    }

    private static String linkKind(ComponentCatalog.Entry entry) {
        if (entry.linkKind() == null) return "uses";
        return switch (entry.linkKind()) {
            case CALL -> "call";
            case ASYNC -> "async";
            case EVENT -> "event";
        };
    }

    private static String linkLabel(ComponentCatalog.Entry entry, EndpointRef p) {
        if (entry.linkKind() == null) return "";
        return switch (entry.linkKind()) {
            case CALL -> p.eip().equals("wireTap") ? "sends a copy" : "calls";
            case ASYNC -> "hands off";
            case EVENT -> entry.name() + " · " + Endpoints.detail(p);
        };
    }

    private static String usesLabel(EndpointRef p, ComponentCatalog.Entry entry) {
        String eip = p.eip();
        if (eip.equals("poll") || eip.equals("pollEnrich") || eip.equals("enrich")) return "reads";
        if (eip.equals("wireTap")) return "copies to";
        return switch (entry.category()) {
            case "ai" -> "asks";
            case "messaging" -> "publishes";
            case "database" -> Endpoints.isRead(p) ? "reads" : "stores";
            case "email" -> "emails";
            case "saas" -> "notifies";
            case "file" -> "writes";
            case "http" -> "calls";
            default -> "uses";
        };
    }

    private static String title(Parsed.Route r) {
        if (r.description() != null && !r.description().isBlank()) return r.description();
        if (r.generatedId() && r.from() != null) {
            ComponentCatalog.Entry e = ComponentCatalog.lookup(r.from().scheme());
            if (isInternalFamily(e) && !r.from().path().isEmpty()) return StepLabels.humanizeId(r.from().path());
        }
        return StepLabels.humanizeId(r.id());
    }

    private static void summarize(List<StepNode> steps, List<StepSummary> out, Map<String, String> titleByKey) {
        for (StepNode s : steps) {
            if (out.size() >= SUMMARY_LIMIT) return;
            if (s.disabled()) continue;
            boolean isEndpoint = s.uri() != null || s.system() != null;
            if (isEndpoint) {
                if (!s.internal() || s.linkKey() != null) {
                    String label = s.label();
                    if (s.linkKey() != null && titleByKey.containsKey(s.linkKey()) && s.description() == null
                            && "internal".equals(s.category())) {
                        String verb = s.linkKey().startsWith("seda:") || s.linkKey().startsWith("vm:")
                                || s.linkKey().startsWith("disruptor") ? "Hands off to " : "Calls ";
                        label = verb + titleByKey.get(s.linkKey());
                    }
                    out.add(new StepSummary(label, s.category()));
                }
            } else if (!StepLabels.isNoise(s.kind()) || s.description() != null) {
                out.add(new StepSummary(s.label(), "eip"));
            }
            if (s.children() != null) summarize(s.children(), out, titleByKey);
            if (s.branches() != null) {
                for (Branch b : s.branches()) summarize(b.steps(), out, titleByKey);
            }
        }
    }
}
