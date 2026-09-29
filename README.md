# Camel Workflow Viewer

See how your **Apache Camel YAML** routes fit together, in a diagram anyone can follow.

Each route is one card, showing what starts it and what it uses. Lines show how routes call each other (`direct`, `seda`, Kafka, JMS…), and the systems they touch (AI models, databases, APIs, storage, apps) appear as named nodes. This is useful when you need to walk executives through an integration or an AI workflow. Developers can switch to the **Technical** view or open any route **step by step**.

It is a viewer only: it never changes your files.

## Quick start

You need Java 17 or newer.

```bash
mvn package                                               # builds target/camel-workflow-viewer.jar

java -jar target/camel-workflow-viewer.jar                # start empty, then open or drop YAML files
java -jar target/camel-workflow-viewer.jar ./my-routes    # show a folder (or one file), refreshed on every save
```

Your browser opens at `http://127.0.0.1:8080/`.
- **Started empty:** add files with **File › Open YAML files…** (⌘/Ctrl+O) or by dragging them onto the window.
- **Started with a folder:** every `*.yaml` / `*.yml` below it is loaded, and the diagram updates by itself whenever you save.

## Options

```
java -jar camel-workflow-viewer.jar [folder-or-file] [options]

  folder-or-file   Routes to load and watch (optional; without it the viewer starts empty)
  --port <n>       HTTP port (default 8080; the next free port is used if it is busy)
  --host <addr>    Bind address (default 127.0.0.1; 0.0.0.0 shares it on your network)
  --view <mode>    Starting view: executive (default) or technical
  --no-open        Don't open a browser window
```

## At a glance

- **Executive / Technical:** plain language for presentations, or route ids, URIs, step trees and YAML for developers. Press `V` to switch.
- **Explorer:** a file tree on the left. Click a file to see only its routes; `</>` shows its YAML.
- **Step-by-step flow:** double-click a route to see every step, branch and loop.
- **Drag, zoom, dark mode, PNG export:** the export can have a transparent background, and card positions are remembered.
- **Keyboard:** press `?` in the app to list all shortcuts.

## Guides

- [User guide](docs/user-guide.md): views, Explorer, drill-down, canvas, export and shortcuts
- [Supported YAML](docs/supported-yaml.md): what is read, how connections are drawn, limitations
- [Development](docs/development.md): building, dev mode, project layout, HTTP API, tests

## Author

**Melvin Vivas** · [GitHub](https://github.com/donvito/) · [AI Backends](https://aibackends.com/)
