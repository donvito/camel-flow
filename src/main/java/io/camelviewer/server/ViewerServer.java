package io.camelviewer.server;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.BindException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Tiny HTTP server on the JDK's built-in {@link HttpServer}: JSON API, SSE and the bundled React app. */
public final class ViewerServer implements AutoCloseable {

    private static final int MAX_UPLOAD = 5 * 1024 * 1024;

    private final GraphService graphs;
    private final SseHub sse;
    private final String defaultView;
    private final String version;
    private final ObjectMapper json = new ObjectMapper();
    private HttpServer server;
    private ExecutorService executor;

    public ViewerServer(GraphService graphs, SseHub sse, String defaultView, String version) {
        this.graphs = graphs;
        this.sse = sse;
        this.defaultView = defaultView;
        this.version = version;
    }

    /** Starts on the first free port from {@code port} upwards; returns the port used. */
    public int start(String host, int port) throws IOException {
        IOException last = null;
        for (int p = port; p < port + 20; p++) {
            try {
                server = HttpServer.create(new InetSocketAddress(host, p), 0);
                break;
            } catch (BindException e) {
                last = e;
            }
        }
        if (server == null) throw last;
        executor = Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "http");
            t.setDaemon(true);
            return t;
        });
        server.setExecutor(executor);
        server.createContext("/api/graph", ex -> safe(ex, () -> sendJson(ex, 200, graphs.graph())));
        server.createContext("/api/config", ex -> safe(ex, () -> {
            Map<String, Object> cfg = new LinkedHashMap<>();
            cfg.put("defaultView", defaultView);
            cfg.put("rootDir", graphs.rootDisplay());
            cfg.put("version", version);
            sendJson(ex, 200, cfg);
        }));
        server.createContext("/api/source", ex -> safe(ex, () -> {
            String path = queryParam(ex, "path");
            String text = path == null ? null : graphs.source(path);
            if (text == null) {
                send(ex, 404, "text/plain; charset=utf-8", "not found".getBytes(StandardCharsets.UTF_8));
            } else {
                ex.getResponseHeaders().add("Cache-Control", "no-store");
                send(ex, 200, "text/plain; charset=utf-8", text.getBytes(StandardCharsets.UTF_8));
            }
        }));
        server.createContext("/api/events", ex -> safe(ex, () -> sse.handle(ex)));
        server.createContext("/api/upload", ex -> safe(ex, () -> upload(ex)));
        server.createContext("/", ex -> safe(ex, () -> staticFile(ex)));
        server.start();
        return server.getAddress().getPort();
    }

    private void upload(HttpExchange ex) throws IOException {
        switch (ex.getRequestMethod()) {
            case "POST" -> {
                String name = queryParam(ex, "name");
                if (name == null || name.isBlank()) name = "uploaded.yaml";
                byte[] body = readLimited(ex.getRequestBody());
                if (body == null) {
                    sendJson(ex, 413, Map.of("error", "file too large"));
                    return;
                }
                graphs.upload("uploaded/" + name.replaceAll("[\\\\/]", "_"), new String(body, StandardCharsets.UTF_8));
                sse.broadcastChanged();
                sendJson(ex, 200, Map.of("ok", true));
            }
            case "DELETE" -> {
                // ?path=uploaded/x.yaml closes one file; without it, all opened files are closed
                String path = queryParam(ex, "path");
                if (path != null && !path.isBlank()) {
                    if (!graphs.removeUpload(path)) {
                        sendJson(ex, 404, Map.of("error", "not an opened file: " + path));
                        return;
                    }
                } else {
                    graphs.clearUploads();
                }
                sse.broadcastChanged();
                sendJson(ex, 200, Map.of("ok", true));
            }
            default -> sendJson(ex, 405, Map.of("error", "method not allowed"));
        }
    }

    private void staticFile(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        if (path.contains("..")) {
            send(ex, 400, "text/plain", "bad path".getBytes(StandardCharsets.UTF_8));
            return;
        }
        if (path.equals("/") || path.isEmpty()) path = "/index.html";
        byte[] data = resource("/webapp" + path);
        boolean index = false;
        if (data == null) {
            // SPA fallback: unknown paths get the app shell, missing assets get 404
            if (path.startsWith("/assets/")) {
                send(ex, 404, "text/plain", "not found".getBytes(StandardCharsets.UTF_8));
                return;
            }
            data = resource("/webapp/index.html");
            index = true;
            path = "/index.html";
        }
        if (data == null) {
            send(ex, 500, "text/html", ("<h1>Frontend not bundled</h1><p>Build with <code>mvn package</code>"
                    + " (not <code>-Dskip.frontend</code>), or run <code>npm run dev</code> in <code>frontend/</code>.</p>")
                    .getBytes(StandardCharsets.UTF_8));
            return;
        }
        String cache = path.startsWith("/assets/") && !index ? "public, max-age=31536000, immutable" : "no-cache";
        ex.getResponseHeaders().add("Cache-Control", cache);
        send(ex, 200, contentType(path), data);
    }

    private static byte[] resource(String name) throws IOException {
        try (InputStream in = ViewerServer.class.getResourceAsStream(name)) {
            return in == null ? null : in.readAllBytes();
        }
    }

    private static String contentType(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html; charset=utf-8";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript; charset=utf-8";
        if (p.endsWith(".css")) return "text/css; charset=utf-8";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".ico")) return "image/x-icon";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private void sendJson(HttpExchange ex, int status, Object body) throws IOException {
        ex.getResponseHeaders().add("Cache-Control", "no-store");
        send(ex, status, "application/json; charset=utf-8", json.writeValueAsBytes(body));
    }

    private static void send(HttpExchange ex, int status, String type, byte[] data) throws IOException {
        ex.getResponseHeaders().set("Content-Type", type);
        if (ex.getRequestMethod().equals("HEAD")) {
            ex.sendResponseHeaders(status, -1);
            ex.close();
            return;
        }
        ex.sendResponseHeaders(status, data.length == 0 ? -1 : data.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(data);
        }
    }

    private static byte[] readLimited(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        int n;
        while ((n = in.read(chunk)) > 0) {
            buf.write(chunk, 0, n);
            if (buf.size() > MAX_UPLOAD) return null;
        }
        return buf.toByteArray();
    }

    private static String queryParam(HttpExchange ex, String name) {
        String q = ex.getRequestURI().getRawQuery();
        if (q == null) return null;
        for (String pair : q.split("&")) {
            int eq = pair.indexOf('=');
            String k = eq < 0 ? pair : pair.substring(0, eq);
            if (k.equals(name)) {
                return URLDecoder.decode(eq < 0 ? "" : pair.substring(eq + 1), StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private interface IoAction {
        void run() throws IOException;
    }

    private static void safe(HttpExchange ex, IoAction action) {
        try {
            action.run();
        } catch (Exception e) {
            System.err.println("[http] " + ex.getRequestURI() + ": " + e);
            try {
                byte[] msg = ("{\"error\":\"" + String.valueOf(e.getMessage()).replace("\"", "'") + "\"}")
                        .getBytes(StandardCharsets.UTF_8);
                ex.sendResponseHeaders(500, msg.length);
                ex.getResponseBody().write(msg);
            } catch (IOException ignored) {
                // response already started
            } finally {
                ex.close();
            }
        }
    }

    @Override
    public void close() {
        if (server != null) server.stop(0);
        if (executor != null) executor.shutdownNow();
    }
}
