package io.camelviewer.server;

import com.sun.net.httpserver.HttpExchange;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Server-Sent Events: tells open browser tabs to refetch the graph when route files change. */
public final class SseHub implements AutoCloseable {

    private record Client(OutputStream out, CountDownLatch closed) {}

    private final List<Client> clients = new CopyOnWriteArrayList<>();
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "sse-heartbeat");
        t.setDaemon(true);
        return t;
    });

    public SseHub() {
        heartbeat.scheduleAtFixedRate(() -> send(": ping\n\n"), 15, 15, TimeUnit.SECONDS);
    }

    /** Holds the request thread until the browser disconnects. */
    public void handle(HttpExchange ex) throws IOException {
        ex.getResponseHeaders().add("Content-Type", "text/event-stream; charset=utf-8");
        ex.getResponseHeaders().add("Cache-Control", "no-cache");
        ex.getResponseHeaders().add("Connection", "keep-alive");
        ex.sendResponseHeaders(200, 0);
        OutputStream out = ex.getResponseBody();
        Client c = new Client(out, new CountDownLatch(1));
        out.write("retry: 2000\n\n".getBytes(StandardCharsets.UTF_8));
        out.flush();
        clients.add(c);
        try {
            c.closed().await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            clients.remove(c);
            ex.close();
        }
    }

    public void broadcastChanged() {
        send("event: changed\ndata: {}\n\n");
    }

    private void send(String payload) {
        byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
        for (Client c : clients) {
            try {
                synchronized (c) {
                    c.out().write(bytes);
                    c.out().flush();
                }
            } catch (IOException e) {
                clients.remove(c);
                c.closed().countDown();
            }
        }
    }

    @Override
    public void close() {
        heartbeat.shutdownNow();
        for (Client c : clients) c.closed().countDown();
    }
}
