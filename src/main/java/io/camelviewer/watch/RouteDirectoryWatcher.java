package io.camelviewer.watch;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * Watches a directory tree for YAML changes by polling file metadata.
 *
 * <p>Polling instead of {@link java.nio.file.WatchService}: on macOS the JDK watch service is itself
 * a slow poller (seconds), and route folders are small, so a sub-second metadata scan is both simpler
 * and faster to react.
 */
public final class RouteDirectoryWatcher implements AutoCloseable {

    private static final long POLL_MS = 500;

    private final Path root;
    private final Runnable onChange;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "route-watcher");
        t.setDaemon(true);
        return t;
    });
    private Map<Path, String> snapshot;

    public RouteDirectoryWatcher(Path root, Runnable onChange) {
        this.root = root;
        this.onChange = onChange;
    }

    public void start() {
        snapshot = scan();
        scheduler.scheduleWithFixedDelay(this::poll, POLL_MS, POLL_MS, TimeUnit.MILLISECONDS);
    }

    private void poll() {
        try {
            Map<Path, String> now = scan();
            if (!Objects.equals(now, snapshot)) {
                snapshot = now;
                onChange.run();
            }
        } catch (RuntimeException e) {
            System.err.println("[watcher] " + e.getMessage());
        }
    }

    private Map<Path, String> scan() {
        Map<Path, String> result = new HashMap<>();
        for (Path p : listYamlFiles(root)) {
            try {
                result.put(p, Files.getLastModifiedTime(p).toMillis() + ":" + Files.size(p));
            } catch (IOException ignored) {
                // file vanished between listing and stat; the next poll settles it
            }
        }
        return result;
    }

    /** All *.yaml / *.yml files below root, skipping build output, dependencies and hidden folders. */
    public static java.util.List<Path> listYamlFiles(Path root) {
        if (Files.isRegularFile(root)) {
            return java.util.List.of(root);
        }
        try (Stream<Path> s = Files.walk(root, 12)) {
            return s.filter(Files::isRegularFile)
                    .filter(p -> {
                        String n = p.getFileName().toString().toLowerCase();
                        return n.endsWith(".yaml") || n.endsWith(".yml");
                    })
                    .filter(p -> !isSkipped(root.relativize(p)))
                    .sorted()
                    .toList();
        } catch (IOException e) {
            return java.util.List.of();
        }
    }

    private static boolean isSkipped(Path relative) {
        for (Path part : relative) {
            String n = part.toString();
            if (n.startsWith(".") || n.equals("node_modules") || n.equals("target") || n.equals("build")) {
                return true;
            }
        }
        return false;
    }

    @Override
    public void close() {
        scheduler.shutdownNow();
    }
}
