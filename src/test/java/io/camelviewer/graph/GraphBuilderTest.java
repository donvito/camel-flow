package io.camelviewer.graph;

import io.camelviewer.model.Graph;
import io.camelviewer.parse.CamelYamlParser;
import io.camelviewer.parse.EndpointRef;
import io.camelviewer.parse.Parsed;
import io.camelviewer.server.GraphService;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GraphBuilderTest {

    private static Graph sample;

    @BeforeAll
    static void loadSample() {
        sample = new GraphService(Path.of("samples/ai-support-workflow")).graph();
    }

    private static Optional<Graph.Link> link(Graph g, String source, String target) {
        return g.links().stream().filter(l -> l.source().equals(source) && l.target().equals(target)).findFirst();
    }

    private static Graph.SystemNode system(Graph g, String id) {
        return g.systems().stream().filter(s -> s.id().equals(id)).findFirst().orElse(null);
    }

    @Test
    void sampleParsesCompletely() {
        assertEquals(7, sample.routes().size());
        assertEquals(2, sample.apis().size());
        assertTrue(sample.files().stream().allMatch(f -> f.error() == null));
    }

    @Test
    void directLinkIsCall() {
        Graph.Link l = link(sample, "route:ticket-intake", "route:audit-trail").orElseThrow();
        assertEquals("call", l.kind());
        assertEquals("sends a copy", l.label());
        assertEquals("direct:audit", l.linkKey());
    }

    @Test
    void sedaLinkIsAsync() {
        assertEquals("async", link(sample, "route:ticket-intake", "route:urgent-responder").orElseThrow().kind());
    }

    @Test
    void kafkaProducerAndConsumerBecomeEventEdgeWithoutSystemNode() {
        Graph.Link l = link(sample, "route:ticket-intake", "route:normal-processor").orElseThrow();
        assertEquals("event", l.kind());
        assertEquals("Kafka · tickets.normal", l.label());
        assertNull(system(sample, "sys:kafka:tickets.normal"));
        // the DLQ topic has no consumer, so it is an external system
        assertNotNull(system(sample, "sys:kafka:tickets.dlq"));
    }

    @Test
    void aiComponentsAreCategorisedAsAi() {
        assertTrue(sample.systems().stream().anyMatch(s -> s.scheme().equals("openai") && s.category().equals("ai")
                && "gpt-4o".equals(s.detail())));
        assertTrue(sample.systems().stream().anyMatch(s -> s.scheme().equals("langchain4j-chat")
                && s.category().equals("ai")));
    }

    @Test
    void logIsInternal() {
        assertTrue(sample.systems().stream().filter(s -> s.scheme().equals("log")).allMatch(Graph.SystemNode::internal));
    }

    @Test
    void schedulerBecomesTriggerBadge() {
        Graph.Route r = sample.routes().stream().filter(x -> x.routeId().equals("daily-summary")).findFirst().orElseThrow();
        assertEquals("Daily at 08:00", r.trigger().label());
        assertTrue(sample.links().stream().noneMatch(l -> l.target().equals("route:daily-summary")));
    }

    @Test
    void restApiLinksToConsumingRoute() {
        Graph.Link l = sample.links().stream().filter(x -> x.kind().equals("api")
                && x.target().equals("route:ticket-intake")).findFirst().orElseThrow();
        assertEquals("api:POST /api/tickets", l.source());
    }

    @Test
    void dynamicToDIsFlagged() {
        Graph.SystemNode dyn = sample.systems().stream().filter(Graph.SystemNode::dynamic).findFirst().orElseThrow();
        assertEquals("dynamic address", dyn.detail());
    }

    @Test
    void routeSummaryUsesPlainLanguage() {
        Graph.Route r = sample.routes().stream().filter(x -> x.routeId().equals("ticket-intake")).findFirst().orElseThrow();
        List<String> labels = r.steps().stream().map(Graph.StepSummary::label).toList();
        assertTrue(labels.contains("Asks LangChain4j Chat · classifier"), labels.toString());
        assertTrue(labels.contains("Makes a decision"), labels.toString());
        assertTrue(labels.contains("Hands off to Urgent ticket responder"), labels.toString());
        assertFalse(labels.stream().anyMatch(l -> l.startsWith("Log")), labels.toString());
        assertEquals(Map.of("ai", 1), r.categoryCounts());
    }

    @Test
    void jmsAliasesLinkTogether() {
        EndpointRef a = EndpointRef.of("jms:queue:orders", Map.of(), "to", false, false);
        EndpointRef b = EndpointRef.of("activemq:orders", Map.of(), "from", true, false);
        assertEquals(Endpoints.linkKey(a), Endpoints.linkKey(b));
    }

    @Test
    void templatedRouteInstantiatesTemplate() {
        CamelYamlParser parser = new CamelYamlParser();
        Parsed.File f = parser.parse("t.yaml", """
                - routeTemplate:
                    id: forward
                    parameters:
                      - name: target
                    from:
                      uri: "timer:{{target}}"
                      steps:
                        - to: "direct:{{target}}"
                - templatedRoute:
                    routeTemplateRef: forward
                    routeId: forward-orders
                    parameters:
                      - name: target
                        value: orders
                - route:
                    id: orders
                    from:
                      uri: direct:orders
                      steps:
                        - to: log:x
                """, false);
        Graph g = new GraphBuilder(parser).build("/tmp", List.of(f));
        assertTrue(link(g, "route:forward-orders", "route:orders").isPresent());
    }

    @Test
    void unresolvedDirectBecomesUnresolvedNode() {
        CamelYamlParser parser = new CamelYamlParser();
        Parsed.File f = parser.parse("t.yaml", """
                - route:
                    from:
                      uri: timer:t
                      steps:
                        - to: direct:nowhere
                """, false);
        Graph g = new GraphBuilder(parser).build("/tmp", List.of(f));
        Graph.SystemNode s = system(g, "sys:direct:nowhere");
        assertNotNull(s);
        assertEquals("unresolved", s.category());
    }

    @Test
    void cronInWords() {
        assertEquals("Weekdays at 09:30", Endpoints.humanCron("0 30 9 ? * MON-FRI"));
        assertEquals("Every 5 minutes", Endpoints.humanCron("0 0/5 * * * ?"));
        assertEquals("Every 10 seconds", Endpoints.humanCron("0/10 * * * * ?"));
        assertEquals("Daily at 06:15", Endpoints.humanCron("15 6 * * *"));
        assertEquals("On schedule 0 0 12 1 * ?", Endpoints.humanCron("0 0 12 1 * ?"));
    }

    @Test
    void sqlSelectReadsInsertStores() {
        Graph.Link read = link(sample, "route:get-ticket", "sys:sql database:tickets").orElseThrow();
        assertEquals("reads", read.label());
        Graph.Link write = link(sample, "route:normal-processor", "sys:sql database:tickets").orElseThrow();
        assertEquals("stores", write.label());
    }

    @Test
    void startsEmptyWithoutAFolderAndShowsOpenedFiles() {
        GraphService empty = new GraphService(null);
        assertTrue(empty.graph().routes().isEmpty());
        assertTrue(empty.graph().files().isEmpty());
        assertEquals("", empty.graph().rootDir());

        empty.upload("uploaded/a.yaml", """
                - route:
                    id: opened
                    from:
                      uri: timer:t
                      steps:
                        - to: direct:x
                """);
        assertEquals(1, empty.graph().routes().size());
        assertNotNull(empty.source("uploaded/a.yaml"));
        assertNull(empty.source("anything-else.yaml"), "no folder means nothing on disk is readable");
    }

    @Test
    void timerLabels() {
        assertEquals("Every 5 seconds", Endpoints.triggerLabel(EndpointRef.of("timer:x?period=5000", Map.of(), "from", true, false)));
        assertEquals("Every minute", Endpoints.triggerLabel(EndpointRef.of("timer:x", Map.of("period", "1m"), "from", true, false)));
        assertEquals("Every second", Endpoints.triggerLabel(EndpointRef.of("timer:x", Map.of(), "from", true, false)));
        assertEquals("HTTP POST /orders", Endpoints.triggerLabel(EndpointRef.of("platform-http:/orders?httpMethodRestrict=POST", Map.of(), "from", true, false)));
    }
}
