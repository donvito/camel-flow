package io.camelviewer.parse;

import com.fasterxml.jackson.databind.JsonNode;
import io.camelviewer.model.Graph.StepNode;

import java.util.List;
import java.util.Map;

/** Output of {@link CamelYamlParser}, before routes are joined into a graph. */
public final class Parsed {

    private Parsed() {}

    public record File(
            String path,
            boolean uploaded,
            boolean camel,
            List<Route> routes,
            List<Api> apis,
            List<TemplatedRoute> templatedRoutes,
            List<String> ignored,
            String error) {}

    /**
     * A route-like flow: a route, a route template, a Kamelet or a Pipe.
     *
     * @param kind         {@code route}, {@code routeTemplate}, {@code kamelet}, {@code pipe} or {@code templatedRoute}
     * @param extraConsumes additional link keys this flow can be reached by (e.g. {@code kamelet:myTemplate})
     * @param raw          the original YAML node of a template, used to instantiate {@code templatedRoute}s
     */
    public record Route(
            String id,
            boolean generatedId,
            String description,
            String note,
            String file,
            String kind,
            boolean template,
            EndpointRef from,
            StepNode tree,
            List<EndpointRef> producers,
            List<String> extraConsumes,
            int startLine,
            int endLine,
            String yaml,
            int stepCount,
            List<String> warnings,
            JsonNode raw,
            Map<String, String> templateDefaults) {}

    public record Api(String id, String method, String path, String description, String toUri, String file) {}

    public record TemplatedRoute(
            String templateRef,
            String routeId,
            Map<String, String> parameters,
            String file,
            int startLine,
            int endLine,
            String yaml) {}
}
