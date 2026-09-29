# CamelFlow

[![CI](https://github.com/donvito/camel-flow/actions/workflows/ci.yml/badge.svg)](https://github.com/donvito/camel-flow/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/donvito/camel-flow?sort=semver)](https://github.com/donvito/camel-flow/releases/latest)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

CamelFlow is a viewer for Apache Camel YAML routes. It shows your routes and how they connect as an easy-to-read diagram.

## Quick start

You need Java 17 or newer.

**Download** `camelflow.jar` from the [latest release](https://github.com/donvito/camel-flow/releases/latest), then:

```bash
java -jar camelflow.jar                # start empty, then open or drop YAML files
java -jar camelflow.jar ./my-routes    # show a folder (or one file), refreshed on every save
```

**Or run it with [JBang](https://www.jbang.dev/)**, with no manual download:

```bash
jbang camelflow@donvito/camel-flow ./my-routes
```

**Or build it yourself** with `mvn package`, which writes `target/camelflow.jar` ([development guide](docs/development.md)).

Your browser opens at `http://127.0.0.1:8080/`.
- **Started empty:** add files with **File › Open YAML files…** (⌘/Ctrl+O) or by dragging them onto the window.
- **Started with a folder:** every `*.yaml` / `*.yml` below it is loaded, and the diagram updates by itself whenever you save.

## Options

```
java -jar camelflow.jar [folder-or-file] [options]

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

- [Changelog](CHANGELOG.md)

## Author

**Melvin Vivas** · [GitHub](https://github.com/donvito/) · [AI Backends](https://aibackends.com/)

## License

[Apache License 2.0](LICENSE). Apache Camel is a trademark of the Apache Software Foundation. CamelFlow is an independent project.
