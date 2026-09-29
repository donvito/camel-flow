package io.camelviewer;

import io.camelviewer.server.GraphService;
import io.camelviewer.server.SseHub;
import io.camelviewer.server.ViewerServer;
import io.camelviewer.watch.RouteDirectoryWatcher;

import java.awt.Desktop;
import java.awt.GraphicsEnvironment;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;

/**
 * {@code java -jar camel-workflow-viewer.jar [dir|file] [--port 8080] [--host 127.0.0.1] [--view executive|technical] [--no-open]}
 * Without a folder the viewer starts empty and files are opened or dropped in the browser.
 */
public final class Main {

    private static final String USAGE = """
            Camel Workflow Viewer — high-level diagrams of Apache Camel YAML routes

            Usage: java -jar camel-workflow-viewer.jar [folder-or-file] [options]

              folder-or-file      Camel YAML routes to show and watch for changes (sub-folders included).
                                  Optional: without it the viewer starts empty; open or drop
                                  YAML files in the browser instead.
            Options:
              --port <n>          HTTP port (default 8080; the next free port is used if busy)
              --host <addr>       Bind address (default 127.0.0.1; use 0.0.0.0 to share on your network)
              --view <mode>       Default view: executive (default) or technical
              --no-open           Do not open a browser window
              -h, --help          Show this help
            """;

    private Main() {}

    public static void main(String[] args) throws Exception {
        String dir = null;
        int port = 8080;
        String host = "127.0.0.1";
        String view = "executive";
        boolean open = true;
        for (int i = 0; i < args.length; i++) {
            String a = args[i];
            switch (a) {
                case "-h", "--help" -> {
                    System.out.println(USAGE);
                    return;
                }
                case "--port" -> port = Integer.parseInt(value(args, ++i, a));
                case "--host" -> host = value(args, ++i, a);
                case "--view" -> view = value(args, ++i, a).toLowerCase(Locale.ROOT);
                case "--no-open" -> open = false;
                default -> {
                    if (a.startsWith("--port=")) port = Integer.parseInt(a.substring(7));
                    else if (a.startsWith("--view=")) view = a.substring(7).toLowerCase(Locale.ROOT);
                    else if (a.startsWith("--host=")) host = a.substring(7);
                    else if (a.startsWith("-")) fail("Unknown option " + a);
                    else dir = a;
                }
            }
        }
        if (!view.equals("executive") && !view.equals("technical")) {
            fail("--view must be 'executive' or 'technical'");
        }
        Path root = null;
        if (dir != null) {
            root = Path.of(dir).toAbsolutePath().normalize();
            if (!Files.exists(root)) {
                fail("Not found: " + root);
            }
        }

        GraphService graphs = new GraphService(root);
        SseHub sse = new SseHub();
        ViewerServer server = new ViewerServer(graphs, sse, view, version());
        int actualPort = server.start(host, port);
        RouteDirectoryWatcher watcher = null;
        if (root != null) {
            watcher = new RouteDirectoryWatcher(root, () -> {
                graphs.invalidate();
                sse.broadcastChanged();
                System.out.println("↻ routes changed, diagram refreshed");
            });
            watcher.start();
        }

        var g = graphs.graph();
        String shownHost = host.equals("0.0.0.0") ? "localhost" : host;
        String url = "http://" + shownHost + ":" + actualPort + "/";
        System.out.println("Camel Workflow Viewer " + version());
        if (root != null) {
            System.out.println("  Routes folder : " + root);
            System.out.println("  Found         : " + g.routes().size() + " routes in " + g.files().size() + " files"
                    + (g.apis().isEmpty() ? "" : ", " + g.apis().size() + " REST endpoints"));
        } else {
            System.out.println("  Routes folder : none — open or drop Camel YAML files in the browser");
        }
        g.files().stream().filter(f -> f.error() != null)
                .forEach(f -> System.out.println("  ! " + f.path() + ": " + f.error().lines().findFirst().orElse("")));
        System.out.println("  Open          : " + url);
        System.out.println("Press Ctrl+C to stop.");

        if (open) openBrowser(url);

        CountDownLatch stop = new CountDownLatch(1);
        RouteDirectoryWatcher watching = watcher;
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            if (watching != null) watching.close();
            sse.close();
            server.close();
            stop.countDown();
        }));
        stop.await();
    }

    private static void openBrowser(String url) {
        try {
            if (!GraphicsEnvironment.isHeadless() && Desktop.isDesktopSupported()
                    && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(URI.create(url));
                return;
            }
            String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
            if (os.contains("mac")) new ProcessBuilder("open", url).start();
            else if (os.contains("win")) new ProcessBuilder("rundll32", "url.dll,FileProtocolHandler", url).start();
            else new ProcessBuilder("xdg-open", url).start();
        } catch (Exception e) {
            // no browser available (e.g. a server); the URL is printed above
        }
    }

    private static String value(String[] args, int i, String option) {
        if (i >= args.length) fail(option + " needs a value");
        return args[i];
    }

    private static void fail(String msg) {
        System.err.println(msg);
        System.err.println();
        System.err.println(USAGE);
        System.exit(2);
    }

    private static String version() {
        String v = Main.class.getPackage().getImplementationVersion();
        return v == null ? "dev" : v;
    }
}
