package io.camelviewer.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.Map;

/**
 * The JSON document served at {@code /api/graph}. Everything the UI renders comes from here.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record Graph(
        String generatedAt,
        String rootDir,
        List<FileStatus> files,
        List<Route> routes,
        List<SystemNode> systems,
        List<Api> apis,
        List<Link> links,
        List<String> warnings) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record FileStatus(String path, int routes, String error, boolean uploaded, List<String> ignored) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Route(
            String id,
            String routeId,
            String title,
            String description,
            String note,
            String file,
            boolean template,
            String kind,
            Trigger trigger,
            List<StepSummary> steps,
            int systemCount,
            Map<String, Integer> categoryCounts,
            String fromUri,
            List<String> produces,
            List<String> consumes,
            int[] lines,
            String yaml,
            StepNode stepTree,
            int stepCount,
            List<String> warnings) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Trigger(String label, String category, String uri, String scheme) {}

    public record StepSummary(String label, String category) {}

    /** Node in the full EIP tree used by the technical view and the route drill-down. */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    public record StepNode(
            String kind,
            String label,
            String id,
            String description,
            String note,
            String uri,
            Map<String, Object> parameters,
            String expression,
            String category,
            String scheme,
            String system,
            boolean dynamic,
            boolean disabled,
            boolean internal,
            String linkKey,
            List<Branch> branches,
            List<StepNode> children) {}

    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    public record Branch(String label, String expression, List<StepNode> steps) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SystemNode(
            String id,
            String label,
            String detail,
            String category,
            String scheme,
            List<String> uris,
            boolean internal,
            boolean dynamic) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Api(String id, String method, String path, String description, String file, String toUri) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Link(String id, String source, String target, String kind, String label, String linkKey) {}
}
