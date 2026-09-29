package io.camelviewer.graph;

import io.camelviewer.parse.EndpointRef;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Derives link keys, short details and human labels from endpoint references. */
public final class Endpoints {

    private static final Pattern SQL_TABLE = Pattern.compile("(?i)\\b(?:from|into|update|table)\\s+([\\w.\"`]+)");
    private static final Pattern DURATION = Pattern.compile("(?i)(\\d+(?:\\.\\d+)?)\\s*(ms|milli|s|sec|m|min|h|hour|d|day)?");

    private Endpoints() {}

    /**
     * Key used to join a producer in one route to a consumer in another, e.g. {@code direct:intake} or
     * {@code jms:orders}. Null when the endpoint cannot link routes (external systems, dynamic URIs).
     */
    public static String linkKey(EndpointRef e) {
        ComponentCatalog.Entry entry = ComponentCatalog.lookup(e.scheme());
        if (entry.linkFamily() == null || e.dynamic()) {
            return null;
        }
        String path = linkPath(e);
        if (path == null || path.isBlank() || path.contains("${")) {
            return null;
        }
        return entry.linkFamily() + ":" + path;
    }

    private static String linkPath(EndpointRef e) {
        String path = e.path();
        switch (e.scheme()) {
            case "kafka":
                return firstNonBlank(path, e.param("topic"));
            case "direct", "direct-vm", "seda", "vm", "disruptor", "disruptor-vm":
                return firstNonBlank(path, e.param("name"));
            case "kamelet": {
                String p = firstNonBlank(path, e.param("templateId"));
                int slash = p == null ? -1 : p.indexOf('/');
                return slash > 0 ? p.substring(0, slash) : p;
            }
            case "jms", "sjms", "sjms2", "activemq", "activemq6", "amqp": {
                String p = firstNonBlank(path, e.param("destinationName"));
                if (p == null) return null;
                if (p.startsWith("queue:")) p = p.substring("queue:".length());
                if (p.startsWith("//")) p = p.substring(2);
                return p;
            }
            case "aws2-sqs":
                return firstNonBlank(path, e.param("queueNameOrArn"));
            case "google-pubsub":
                return firstNonBlank(path, joinNonBlank(":", e.param("projectId"), e.param("destinationName")));
            case "rabbitmq", "spring-rabbitmq":
                return firstNonBlank(path, e.param("exchangeName"));
            case "nats":
                return firstNonBlank(path, e.param("topic"));
            case "paho", "paho-mqtt5":
                return firstNonBlank(path, e.param("topic"));
            case "pulsar":
                return firstNonBlank(path, e.param("topic"));
            default:
                return path;
        }
    }

    /** Short, human detail for a system node: topic, host, table, bucket, channel... */
    public static String detail(EndpointRef e) {
        String d = rawDetail(e);
        return d == null ? "" : d;
    }

    private static String rawDetail(EndpointRef e) {
        String s = e.scheme();
        String path = e.path() == null ? "" : e.path();
        switch (s) {
            case "kafka":
                return firstNonBlank(path, e.param("topic"));
            case "jms", "sjms", "sjms2", "activemq", "activemq6", "amqp", "aws2-sqs", "google-pubsub",
                    "rabbitmq", "spring-rabbitmq", "nats", "paho", "paho-mqtt5", "pulsar", "azure-servicebus",
                    "aws2-sns", "azure-eventhubs": {
                String k = linkPath(e);
                return k == null ? path : k;
            }
            case "http", "https", "vertx-http", "netty-http", "ahc": {
                String p = path.replaceFirst("^[a-zA-Z]+://", "").replaceFirst("^/+", "");
                int slash = p.indexOf('/');
                return slash > 0 ? p.substring(0, slash) : p;
            }
            case "sql", "sql-stored", "jdbc", "spring-jdbc": {
                String q = firstNonBlank(e.param("query"), path);
                if (q == null) return "";
                Matcher m = SQL_TABLE.matcher(q);
                return m.find() ? m.group(1).replace("\"", "").replace("`", "") : "";
            }
            case "openai", "spring-ai-chat", "azure-openai", "aws-bedrock", "google-vertexai", "ibm-watsonx-ai":
                return firstNonBlank(e.param("model"), e.param("modelId"), path);
            case "slack":
                return path.startsWith("#") || path.startsWith("@") ? path : (path.isEmpty() ? "" : "#" + path);
            case "mail", "smtp", "smtps", "imap", "imaps", "pop3", "pop3s":
                return firstNonBlank(e.param("to"), path);
            case "rest": {
                String[] parts = path.split(":", 2);
                return parts.length == 2 ? parts[0].toUpperCase(Locale.ROOT) + " " + parts[1] : path;
            }
            case "mongodb":
                return firstNonBlank(e.param("collection"), e.param("database"), path);
            case "log", "bean", "class":
                return path;
            default:
                return truncate(path, 48);
        }
    }

    /** Label for the trigger badge on a route card (what starts the route). */
    public static String triggerLabel(EndpointRef e) {
        ComponentCatalog.Entry entry = ComponentCatalog.lookup(e.scheme());
        String path = e.path() == null ? "" : e.path();
        switch (e.scheme()) {
            case "timer": {
                if ("1".equals(e.param("repeatCount"))) return "Runs once at startup";
                String period = e.param("period");
                return "Every " + humanDuration(period == null ? "1000" : period);
            }
            case "scheduler": {
                String delay = firstNonBlank(e.param("delay"), "500");
                return "Every " + humanDuration(delay);
            }
            case "cron":
                return humanCron(firstNonBlank(e.param("schedule"), path));
            case "quartz":
                return humanCron(firstNonBlank(e.param("cron"), path));
            case "platform-http", "jetty", "undertow", "servlet", "netty-http", "vertx-http": {
                String method = e.param("httpMethodRestrict");
                String p = path.startsWith("/") ? path : "/" + path;
                if (e.scheme().equals("jetty") || e.scheme().equals("netty-http") || e.scheme().equals("vertx-http")) {
                    p = "/" + path.replaceFirst("^[a-z]+://[^/]+/?", "");
                }
                return "HTTP " + (method == null ? "" : method.toUpperCase(Locale.ROOT) + " ") + p;
            }
            case "rest": {
                String[] parts = path.split(":", 2);
                if (parts.length == 2) {
                    String p = parts[1].startsWith("/") ? parts[1] : "/" + parts[1];
                    return "HTTP " + parts[0].toUpperCase(Locale.ROOT) + " " + p;
                }
                return "HTTP " + path;
            }
            case "direct", "direct-vm":
                return "When called";
            case "seda", "vm", "disruptor", "disruptor-vm":
                return "When handed work";
            case "kamelet":
                return "When used as a Kamelet";
            case "file":
                return "When a file arrives in " + path;
            case "ftp", "ftps", "sftp":
                return "When a file arrives on " + entry.name();
            case "mail", "imap", "imaps", "pop3", "pop3s":
                return "When an email arrives";
            default: {
                String d = detail(e);
                if ("messaging".equals(entry.category())) {
                    return "On " + entry.name() + " message" + (d.isEmpty() ? "" : " · " + d);
                }
                return "From " + entry.name() + (d.isEmpty() ? "" : " · " + d);
            }
        }
    }

    /** True when the endpoint only reads data (SQL select, Mongo find...), for edge wording. */
    public static boolean isRead(EndpointRef e) {
        String q = firstNonBlank(e.param("query"), e.scheme().startsWith("sql") || e.scheme().contains("jdbc") ? e.path() : null);
        if (q != null) {
            String first = q.trim().split("\\s+", 2)[0].toLowerCase(Locale.ROOT);
            return first.equals("select") || first.equals("with");
        }
        String op = e.param("operation");
        if (op != null) {
            String o = op.toLowerCase(Locale.ROOT);
            return o.startsWith("find") || o.startsWith("get") || o.startsWith("count") || o.startsWith("query")
                    || o.startsWith("search") || o.startsWith("aggregate");
        }
        return false;
    }

    /** Common cron patterns in words ("Daily at 08:00"); anything unusual is shown as-is. */
    public static String humanCron(String cron) {
        if (cron == null || cron.isBlank()) return "On a schedule";
        String c = cron.trim().replace('+', ' ');
        String[] f = c.split("\\s+");
        // Unix cron has 5 fields; Quartz has seconds first (6-7 fields)
        String sec = "0", min, hour, dom, mon, dow;
        if (f.length == 5) {
            min = f[0]; hour = f[1]; dom = f[2]; mon = f[3]; dow = f[4];
        } else if (f.length >= 6) {
            sec = f[0]; min = f[1]; hour = f[2]; dom = f[3]; mon = f[4]; dow = f[5];
        } else {
            return "On schedule " + c;
        }
        boolean anyDay = (dom.equals("*") || dom.equals("?")) && mon.equals("*");
        boolean anyDow = dow.equals("*") || dow.equals("?");
        if (sec.matches("0/\\d+|\\*/\\d+") && min.equals("*") && hour.equals("*") && anyDay && anyDow) {
            return "Every " + plural(Long.parseLong(sec.substring(sec.indexOf('/') + 1)), "second");
        }
        if (sec.equals("0") && min.matches("0/\\d+|\\*/\\d+") && hour.equals("*") && anyDay && anyDow) {
            return "Every " + plural(Long.parseLong(min.substring(min.indexOf('/') + 1)), "minute");
        }
        if (sec.equals("0") && min.matches("\\d+") && hour.equals("*") && anyDay && anyDow) {
            return "Hourly at :" + pad(min);
        }
        if (sec.equals("0") && min.matches("\\d+") && hour.matches("\\d+") && anyDay) {
            String at = " at " + pad(hour) + ":" + pad(min);
            if (anyDow) return "Daily" + at;
            String d = dow.toUpperCase(Locale.ROOT);
            if (d.equals("MON-FRI") || d.equals("1-5") || d.equals("2-6")) return "Weekdays" + at;
            return "Every " + d + at;
        }
        return "On schedule " + c;
    }

    private static String pad(String n) {
        return n.length() == 1 ? "0" + n : n;
    }

    /** "5000" → "5 seconds", "1m" → "1 minute", "PT10S" → "10 seconds". */
    public static String humanDuration(String value) {
        if (value == null || value.isBlank()) return "second";
        String v = value.trim();
        if (v.startsWith("{{") || v.contains("${")) return v;
        if (v.toUpperCase(Locale.ROOT).startsWith("PT")) {
            v = v.substring(2).toLowerCase(Locale.ROOT);
        }
        long totalMs = 0;
        Matcher m = DURATION.matcher(v);
        boolean matched = false;
        while (m.find()) {
            if (m.group(1) == null || m.group(1).isEmpty()) continue;
            matched = true;
            double n = Double.parseDouble(m.group(1));
            String unit = m.group(2) == null ? "ms" : m.group(2).toLowerCase(Locale.ROOT);
            long factor = switch (unit) {
                case "s", "sec" -> 1000L;
                case "m", "min" -> 60_000L;
                case "h", "hour" -> 3_600_000L;
                case "d", "day" -> 86_400_000L;
                default -> 1L;
            };
            totalMs += (long) (n * factor);
        }
        if (!matched) return v;
        return formatMs(totalMs);
    }

    private static String formatMs(long ms) {
        if (ms % 86_400_000L == 0 && ms > 0) return plural(ms / 86_400_000L, "day");
        if (ms % 3_600_000L == 0 && ms > 0) return plural(ms / 3_600_000L, "hour");
        if (ms % 60_000L == 0 && ms > 0) return plural(ms / 60_000L, "minute");
        if (ms % 1000L == 0 && ms > 0) return plural(ms / 1000L, "second");
        return ms + " ms";
    }

    private static String plural(long n, String unit) {
        return n == 1 ? unit : n + " " + unit + "s";
    }

    static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static String joinNonBlank(String sep, String a, String b) {
        if (a == null || a.isBlank() || b == null || b.isBlank()) return null;
        return a + sep + b;
    }

    static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
