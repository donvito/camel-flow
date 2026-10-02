# Changelog

Notable changes to CamelFlow. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Midnight, Ocean, Forest, and Rose themes, with a visual palette picker, saved preferences, and theme-aware PNG exports. The View menu and `T` shortcut include all themes.

## [0.1.0]

First release.

### Added

- Diagram of Apache Camel YAML DSL routes: one card per route, lines between routes that call each other (`direct`, `seda`, Kafka, JMS and more), and named nodes for the systems they use (AI, databases, APIs, messaging, storage, apps).
- **Executive** view in plain language, and **Technical** view with route ids, URIs, step trees and YAML.
- Step-by-step flow for any route, with branches, loops and try/catch.
- Explorer sidebar with a per-file view and the YAML source of each file.
- Start empty and open or drop YAML files, or watch a folder with live reload.
- Supports routes, route templates, REST, Pipes, Kamelets and Kaoto-style files. The EIP lists come from the Camel YAML DSL schema.
- Desktop-style menus, keyboard shortcuts and tooltips, resizable panels, dark mode, draggable cards with remembered positions.
- PNG export of the whole diagram, with a transparent, white or theme background.
- Single runnable jar (Java 17+), also runnable with JBang.

[Unreleased]: https://github.com/donvito/camel-flow/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/donvito/camel-flow/releases/tag/v0.1.0
