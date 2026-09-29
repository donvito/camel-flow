package io.camelviewer.parse;

import io.camelviewer.model.Graph.StepNode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CamelYamlParserTest {

    private final CamelYamlParser parser = new CamelYamlParser();

    private Parsed.File parse(String yaml) {
        return parser.parse("test.camel.yaml", yaml, false);
    }

    @Test
    void stringAndObjectToForms() {
        Parsed.File f = parse("""
                - route:
                    id: r1
                    from:
                      uri: timer:tick
                      parameters:
                        period: 5000
                      steps:
                        - to: direct:a
                        - to:
                            uri: kafka:orders
                            parameters:
                              brokers: localhost:9092
                """);
        assertNull(f.error());
        Parsed.Route r = f.routes().get(0);
        assertEquals("r1", r.id());
        assertEquals("timer", r.from().scheme());
        assertEquals("5000", r.from().param("period"));
        assertEquals(2, r.producers().size());
        assertEquals("direct:a", r.producers().get(0).uri());
        assertEquals("kafka", r.producers().get(1).scheme());
        assertEquals("orders", r.producers().get(1).path());
        assertEquals("localhost:9092", r.producers().get(1).param("brokers"));
    }

    @Test
    void pathAsParametersIsFoldedIntoTheUri() {
        Parsed.File f = parse("""
                - route:
                    from:
                      uri: file
                      parameters:
                        directoryName: "{{inbox.dir}}"
                        include: ".*png"
                      steps:
                        - to:
                            uri: direct
                            parameters:
                              name: save-receipt
                        - to:
                            uri: jms
                            parameters:
                              destinationType: queue
                              destinationName: orders
                """);
        Parsed.Route r = f.routes().get(0);
        assertEquals("file:{{inbox.dir}}", r.from().uri());
        assertEquals("file:{{inbox.dir}}?include=.*png", r.from().displayUri());
        assertEquals("direct:save-receipt", r.producers().get(0).displayUri());
        assertEquals("direct:save-receipt", r.tree().children().get(0).linkKey());
        assertEquals("jms:queue:orders", r.producers().get(1).uri());
    }

    @Test
    void legacyFromWithoutRouteWrapper() {
        Parsed.File f = parse("""
                - from:
                    uri: direct:start
                    steps:
                      - to: log:out
                """);
        Parsed.Route r = f.routes().get(0);
        assertTrue(r.generatedId());
        assertEquals("direct", r.from().scheme());
        assertEquals("log", r.producers().get(0).scheme());
    }

    @Test
    void choiceBranchesAndNestedEndpoints() {
        Parsed.File f = parse("""
                - route:
                    from:
                      uri: direct:in
                      steps:
                        - choice:
                            when:
                              - simple: "${header.x} == 1"
                                steps:
                                  - to: direct:one
                              - expression:
                                  simple:
                                    expression: "${header.x} == 2"
                                steps:
                                  - to: direct:two
                            otherwise:
                              steps:
                                - to: direct:other
                """);
        Parsed.Route r = f.routes().get(0);
        assertEquals(List.of("direct:one", "direct:two", "direct:other"),
                r.producers().stream().map(EndpointRef::uri).toList());
        StepNode choice = r.tree().children().get(0);
        assertEquals("choice", choice.kind());
        assertEquals(3, choice.branches().size());
        assertEquals("simple: ${header.x} == 1", choice.branches().get(0).expression());
        assertEquals("simple: ${header.x} == 2", choice.branches().get(1).expression());
        assertEquals("otherwise", choice.branches().get(2).label());
        assertEquals("direct:one", choice.branches().get(0).steps().get(0).linkKey());
    }

    @Test
    void doTryCatchFinallyAndSplitChildren() {
        Parsed.File f = parse("""
                - route:
                    from:
                      uri: direct:in
                      steps:
                        - split:
                            simple: "${body}"
                            steps:
                              - doTry:
                                  steps:
                                    - to: sql:insert into t values (:#${body})
                                  doCatch:
                                    - exception:
                                        - java.io.IOException
                                      steps:
                                        - to: direct:error
                                  doFinally:
                                    steps:
                                      - log: done
                """);
        Parsed.Route r = f.routes().get(0);
        StepNode split = r.tree().children().get(0);
        assertEquals("split", split.kind());
        assertEquals("simple: ${body}", split.expression());
        StepNode doTry = split.children().get(0);
        assertEquals(List.of("try", "catch IOException", "finally"),
                doTry.branches().stream().map(b -> b.label()).toList());
        EndpointRef sql = r.producers().get(0);
        assertFalse(sql.dynamic(), "${} inside a plain 'to' is component syntax, not a dynamic URI");
    }

    @Test
    void restVerbs() {
        Parsed.File f = parse("""
                - rest:
                    path: /api
                    get:
                      - path: /orders/{id}
                        to: direct:get-order
                    post:
                      - path: orders
                        to:
                          uri: direct:new-order
                """);
        assertEquals(2, f.apis().size());
        Parsed.Api post = f.apis().stream().filter(a -> a.method().equals("POST")).findFirst().orElseThrow();
        assertEquals("/api/orders", post.path());
        assertEquals("direct:new-order", post.toUri());
        Parsed.Api get = f.apis().stream().filter(a -> a.method().equals("GET")).findFirst().orElseThrow();
        assertEquals("/api/orders/{id}", get.path());
    }

    @Test
    void pipeResource() {
        Parsed.File f = parse("""
                apiVersion: camel.apache.org/v1
                kind: Pipe
                metadata:
                  name: orders-to-slack
                spec:
                  source:
                    ref:
                      kind: Kamelet
                      apiVersion: camel.apache.org/v1
                      name: kafka-source
                    properties:
                      topic: orders
                  steps:
                    - ref:
                        kind: Kamelet
                        apiVersion: camel.apache.org/v1
                        name: json-deserialize-action
                  sink:
                    uri: slack:#orders
                """);
        Parsed.Route r = f.routes().get(0);
        assertEquals("orders-to-slack", r.id());
        assertEquals("pipe", r.kind());
        assertEquals("kamelet:kafka-source", r.from().uri());
        assertEquals(2, r.producers().size());
        assertEquals("slack", r.producers().get(1).scheme());
    }

    @Test
    void dynamicToD() {
        Parsed.File f = parse("""
                - route:
                    from:
                      uri: direct:in
                      steps:
                        - toD: "http:${header.url}"
                        - toD: direct:static
                        - recipientList:
                            constant: "direct:a,direct:b"
                        - routingSlip:
                            header: slip
                """);
        List<EndpointRef> p = f.routes().get(0).producers();
        assertTrue(p.get(0).dynamic());
        assertFalse(p.get(1).dynamic());
        assertEquals("direct:a", p.get(2).uri());
        assertEquals("direct:b", p.get(3).uri());
        assertTrue(p.get(4).dynamic());
        assertEquals("", p.get(4).scheme());
    }

    @Test
    void brokenYamlReportsErrorWithoutThrowing() {
        Parsed.File f = parse("""
                - route:
                    from:
                      uri: direct:a
                     steps: [
                """);
        assertNotNull(f.error());
        assertTrue(f.routes().isEmpty());
    }

    @Test
    void nonCamelYamlIsNotCamel() {
        Parsed.File f = parse("""
                server:
                  port: 8080
                spring:
                  application:
                    name: demo
                """);
        assertFalse(f.camel());
    }

    @Test
    void lineRangesAndSnippet() {
        String yaml = """
                # header comment
                - route:
                    id: first
                    from:
                      uri: direct:a
                      steps:
                        - to: direct:b

                # second
                - route:
                    id: second
                    from:
                      uri: direct:b
                      steps:
                        - log: hi
                """;
        Parsed.File f = parse(yaml);
        Parsed.Route first = f.routes().get(0);
        Parsed.Route second = f.routes().get(1);
        assertEquals(2, first.startLine());
        assertEquals(7, first.endLine());
        assertTrue(first.yaml().startsWith("- route:\n    id: first"));
        assertFalse(first.yaml().contains("# second"));
        assertEquals(10, second.startLine());
        assertEquals(15, second.endLine());
    }

    @Test
    void routeTemplateAndKameletEip() {
        Parsed.File f = parse("""
                - routeTemplate:
                    id: notify
                    parameters:
                      - name: channel
                        defaultValue: general
                    from:
                      uri: kamelet:source
                      steps:
                        - to: "slack:#{{channel}}"
                - route:
                    from:
                      uri: timer:t
                      steps:
                        - kamelet: notify
                - templatedRoute:
                    routeTemplateRef: notify
                    routeId: notify-ops
                    parameters:
                      - name: channel
                        value: ops
                """);
        Parsed.Route template = f.routes().get(0);
        assertTrue(template.template());
        assertEquals("kamelet:notify", template.from().uri());
        assertEquals("general", template.templateDefaults().get("channel"));
        assertEquals("kamelet:notify", f.routes().get(1).producers().get(0).uri());

        Parsed.Route instance = parser.instantiate(template, f.templatedRoutes().get(0));
        assertEquals("notify-ops", instance.id());
        assertEquals("slack:#ops", instance.producers().get(0).uri());
    }

    @Test
    void stepMetadataAndDisabled() {
        Parsed.File f = parse("""
                - route:
                    from:
                      uri: direct:in
                      steps:
                        - to:
                            id: call-ai
                            description: Ask the model
                            note: uses the prod key
                            uri: openai:chat-completion
                        - to:
                            uri: direct:off
                            disabled: true
                """);
        Parsed.Route r = f.routes().get(0);
        StepNode ai = r.tree().children().get(0);
        assertEquals("call-ai", ai.id());
        assertEquals("Ask the model", ai.label());
        assertEquals("uses the prod key", ai.note());
        assertEquals("ai", ai.category());
        assertTrue(r.tree().children().get(1).disabled());
        assertEquals(1, r.producers().size(), "disabled steps do not create links");
    }
}
