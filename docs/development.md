# Development

## Build

| Command | Result |
|---|---|
| `mvn package` | Builds the React UI (Maven downloads its own Node), runs the tests, and writes `target/camelflow.jar` |
| `mvn -Dskip.frontend test` | Java only, which is quicker when you haven't touched the UI |

The jar is self-contained, about 3 MB. Its only runtime dependency is Jackson YAML, and it targets Java 17.

## Running while developing

```bash
java -jar target/camelflow.jar samples/ai-support-workflow --no-open   # API on :8080
cd frontend && npm install && npm run dev                             # UI on :5173 with hot reload
```

Vite forwards `/api` to `:8080`. `samples/ai-support-workflow/` is a small AI support-desk example used by the tests and handy for trying things out.

## Project layout

```
src/main/java/io/camelviewer/
  Main.java                      command line, starts the server, opens the browser
  parse/CamelYamlParser.java     YAML → routes, step trees and endpoints (no Camel runtime needed)
  parse/EndpointRef.java         endpoint URI parsing, including Kaoto's path-as-parameters form
  graph/GraphBuilder.java        joins routes, systems and APIs into the graph
  graph/ComponentCatalog.java    scheme → friendly name, category, linking behaviour, path parameters
  graph/Endpoints.java           link keys, short details, trigger wording ("Every 5 minutes")
  graph/StepLabels.java          plain-language step names
  server/                        JDK HttpServer, graph cache, server-sent events
  watch/                         polls the folder for YAML changes
src/main/resources/camel-yaml-keys.json    EIP and language lists taken from the Camel schema
src/test/resources/schema/camelYamlDsl.json the Camel schema the tests check against
frontend/src/
  App.tsx                        menus, shortcuts, panels
  toFlow.ts, drill/              graph JSON → React Flow nodes for the overview and the step-by-step flow
  layout.ts, useAutoLayout.ts    dagre layout, remembered positions
  components/                    menu bar, toolbar, Explorer, details, YAML source, dialogs, tooltips
  nodes/, edges/                 cards and lines
```

## HTTP API

The UI uses these endpoints, served on the same port.

| Endpoint | Purpose |
|---|---|
| `GET /api/graph` | Routes, systems, APIs, links and file status, as JSON |
| `GET /api/config` | Starting view, folder and version |
| `GET /api/events` | Server-sent events: `changed` when a file changes |
| `POST /api/upload?name=file.yaml` | Adds an opened or dropped file; the body is the YAML |
| `DELETE /api/upload?path=uploaded/file.yaml` | Closes one opened file |
| `DELETE /api/upload` | Closes all opened files |
| `GET /api/source?path=…` | Full text of a loaded file. Only files the viewer loaded can be read. |

By default the server only listens on `127.0.0.1`.

## Tests

`mvn test` runs three suites:

- **`CamelYamlParserTest`:** URI forms, Kaoto parameters, branches, REST, Pipes, templates, dynamic endpoints, broken files, line ranges.
- **`GraphBuilderTest`:** links between routes, system nodes, categories, triggers, and the empty start. It runs against `samples/`.
- **`CamelYamlKeysSyncTest`:** checks `camel-yaml-keys.json` against the Camel schema.

The UI is type-checked during the build (`tsc`).

## Updating the Camel schema

When a new Camel version adds EIPs:

1. Replace `src/test/resources/schema/camelYamlDsl.json` with the new file from `dsl/camel-yaml-dsl/camel-yaml-dsl/src/generated/resources/schema/` in the Camel repository.
2. Run `mvn -Dskip.frontend test`. `CamelYamlKeysSyncTest` lists exactly what changed.
3. Update `src/main/resources/camel-yaml-keys.json` to match. If a new EIP carries an endpoint `uri`, add it to endpoint extraction in `CamelYamlParser`.
