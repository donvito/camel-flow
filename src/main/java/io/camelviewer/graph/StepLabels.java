package io.camelviewer.graph;

import java.util.Map;
import java.util.Set;

/** Plain-English wording for EIPs, used by the executive view. */
public final class StepLabels {

    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("from", "Starts"),
            Map.entry("choice", "Makes a decision"),
            Map.entry("when", "If"),
            Map.entry("otherwise", "Otherwise"),
            Map.entry("filter", "Keeps only matching messages"),
            Map.entry("split", "Processes each item"),
            Map.entry("aggregate", "Combines results"),
            Map.entry("multicast", "Sends to several in parallel"),
            Map.entry("recipientList", "Sends to a dynamic list"),
            Map.entry("routingSlip", "Follows a dynamic path"),
            Map.entry("dynamicRouter", "Routes dynamically"),
            Map.entry("loadBalance", "Balances load"),
            Map.entry("loop", "Repeats"),
            Map.entry("doTry", "Tries with error handling"),
            Map.entry("doCatch", "On error"),
            Map.entry("doFinally", "Finally"),
            Map.entry("circuitBreaker", "Protects with a circuit breaker"),
            Map.entry("onFallback", "Fallback"),
            Map.entry("onException", "Handles errors"),
            Map.entry("throttle", "Limits the rate"),
            Map.entry("delay", "Waits"),
            Map.entry("sample", "Samples messages"),
            Map.entry("idempotentConsumer", "Skips duplicates"),
            Map.entry("resequence", "Puts messages back in order"),
            Map.entry("saga", "Runs as a saga (compensating transaction)"),
            Map.entry("transacted", "Runs in a transaction"),
            Map.entry("transform", "Transforms the data"),
            Map.entry("setBody", "Sets the content"),
            Map.entry("marshal", "Converts to a data format"),
            Map.entry("unmarshal", "Reads a data format"),
            Map.entry("convertBodyTo", "Converts the content"),
            Map.entry("enrich", "Enriches with extra data"),
            Map.entry("pollEnrich", "Fetches extra data"),
            Map.entry("poll", "Fetches data"),
            Map.entry("wireTap", "Sends a copy"),
            Map.entry("validate", "Validates"),
            Map.entry("claimCheck", "Stores/restores content"),
            Map.entry("stop", "Stops"),
            Map.entry("rollback", "Rolls back"),
            Map.entry("throwException", "Raises an error"),
            Map.entry("process", "Runs custom logic"),
            Map.entry("bean", "Runs custom logic"),
            Map.entry("script", "Runs a script"),
            Map.entry("kamelet", "Uses a Kamelet"),
            Map.entry("pausable", "Pausable"),
            Map.entry("threads", "Continues in parallel threads"),
            Map.entry("tokenizer", "Tokenizes text"));

    /** Steps that are plumbing and dropped from the plain-language summary. */
    private static final Set<String> NOISE = Set.of(
            "log", "setHeader", "setHeaders", "removeHeader", "removeHeaders", "setProperty", "removeProperty",
            "removeProperties", "setVariable", "setVariables", "removeVariable", "convertHeaderTo",
            "convertVariableTo", "setExchangePattern", "inOnly", "inOut", "routeConfigurationId", "step",
            "sort", "stop", "to", "toD", "bean", "process");

    private StepLabels() {}

    public static String label(String eip) {
        String l = LABELS.get(eip);
        return l != null ? l : humanizeEip(eip);
    }

    public static boolean isNoise(String eip) {
        return NOISE.contains(eip);
    }

    /** "setBody" → "Set body". */
    public static String humanizeEip(String eip) {
        if (eip == null || eip.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < eip.length(); i++) {
            char c = eip.charAt(i);
            if (i == 0) {
                sb.append(Character.toUpperCase(c));
            } else if (Character.isUpperCase(c)) {
                sb.append(' ').append(Character.toLowerCase(c));
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    /** "order-intake-route" / "orderIntakeRoute" → "Order Intake". */
    public static String humanizeId(String id) {
        if (id == null || id.isBlank()) return "Unnamed route";
        String s = id.replaceAll("([a-z0-9])([A-Z])", "$1 $2").replaceAll("[-_.]+", " ").trim();
        String[] words = s.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < words.length; i++) {
            String w = words[i];
            if (i == words.length - 1 && words.length > 1 && w.equalsIgnoreCase("route")) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1));
        }
        return sb.length() == 0 ? id : sb.toString();
    }
}
