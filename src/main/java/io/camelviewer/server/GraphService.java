package io.camelviewer.server;

import io.camelviewer.graph.GraphBuilder;
import io.camelviewer.model.Graph;
import io.camelviewer.parse.CamelYamlParser;
import io.camelviewer.parse.Parsed;
import io.camelviewer.watch.RouteDirectoryWatcher;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads the route folder (if one was given) plus files opened or dropped in the browser, and caches
 * the resulting graph until something changes.
 */
public final class GraphService {

    private final Path root;
    private final CamelYamlParser parser = new CamelYamlParser();
    private final GraphBuilder builder = new GraphBuilder(parser);
    private final Map<String, String> uploads = new LinkedHashMap<>();
    private Graph cached;

    /** @param root folder or single YAML file to watch, or null to start empty */
    public GraphService(Path root) {
        this.root = root;
    }

    /** The watched folder or file, or null when none was given. */
    public Path root() {
        return root;
    }

    /** Display form of the root for the UI ("" when there is none). */
    public String rootDisplay() {
        return root == null ? "" : root.toAbsolutePath().normalize().toString();
    }

    public synchronized Graph graph() {
        if (cached == null) {
            cached = build();
        }
        return cached;
    }

    public synchronized void invalidate() {
        cached = null;
    }

    public synchronized void upload(String name, String content) {
        uploads.put(name, content);
        cached = null;
    }

    /** Closes one opened/dropped file; returns false if it was not open. */
    public synchronized boolean removeUpload(String name) {
        boolean removed = uploads.remove(name) != null;
        if (removed) cached = null;
        return removed;
    }

    public synchronized void clearUploads() {
        uploads.clear();
        cached = null;
    }

    /**
     * Source text of a file listed in the graph (dropped files included), or null. Only files the
     * viewer itself loaded can be read, so this cannot be used to browse the disk.
     */
    public synchronized String source(String path) {
        if (uploads.containsKey(path)) {
            return uploads.get(path);
        }
        if (root == null) return null;
        boolean listed = graph().files().stream().anyMatch(f -> f.path().equals(path) && !f.uploaded());
        if (!listed) return null;
        Path base = (Files.isRegularFile(root) ? root.getParent() : root).toAbsolutePath().normalize();
        Path file = base.resolve(path).normalize();
        if (!file.startsWith(base)) return null;
        try {
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    private Graph build() {
        List<Parsed.File> files = new ArrayList<>();
        if (root != null) {
            Path base = Files.isRegularFile(root) ? root.getParent() : root;
            for (Path p : RouteDirectoryWatcher.listYamlFiles(root)) {
                String display = base == null ? p.toString() : base.relativize(p).toString().replace('\\', '/');
                try {
                    files.add(parser.parse(display, Files.readString(p, StandardCharsets.UTF_8), false));
                } catch (IOException | RuntimeException e) {
                    files.add(new Parsed.File(display, false, true, List.of(), List.of(), List.of(), List.of(),
                            "Cannot read file: " + e.getMessage()));
                }
            }
        }
        for (Map.Entry<String, String> u : uploads.entrySet()) {
            try {
                files.add(parser.parse(u.getKey(), u.getValue(), true));
            } catch (RuntimeException e) {
                files.add(new Parsed.File(u.getKey(), true, true, List.of(), List.of(), List.of(), List.of(),
                        "Cannot parse: " + e.getMessage()));
            }
        }
        return builder.build(rootDisplay(), files);
    }
}
