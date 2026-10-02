# User guide

- [Loading routes](#loading-routes)
- [Executive and Technical views](#executive-and-technical-views)
- [Explorer and YAML source](#explorer-and-yaml-source)
- [Step-by-step flow](#step-by-step-flow)
- [Working with the canvas](#working-with-the-canvas)
- [Exporting a PNG](#exporting-a-png)
- [Presenting](#presenting)
- [Keyboard shortcuts](#keyboard-shortcuts)

## Loading routes

You can load routes in two ways, and mix them:

| | How | Updates |
|---|---|---|
| **A folder or file** | `java -jar camelflow.jar ./routes` | Every `*.yaml` / `*.yml` below it is loaded, including sub-folders. Hidden folders, `target`, `build` and `node_modules` are skipped. Saving a file refreshes the diagram within about a second. |
| **Opened files** | **File › Open YAML files…** (⌘/Ctrl+O), or drag files onto the window | Each new file is shown on its own straight away. Opening a file with the same name again replaces it. Opened files are kept in memory until you close them or restart. |

**Closing a file:**
- Hover over an opened file in the Explorer and click its **×**.
- Or, while viewing it, choose **File › Close file**.
- **File › Close all opened files** closes them all.

Files from a watched folder can't be closed from the viewer. They disappear when you delete or move them on disk.

YAML that isn't Camel (for example `application.yaml`) is ignored. If a file has a YAML error, a red banner names the file and line, and the rest of the diagram still shows.

## Executive and Technical views

Switch with the toggle in the middle of the toolbar, **View › Executive / Technical**, or `V`. The starting view comes from `--view`. A link with `?view=technical` opens in that view, which is handy for sharing.

| | Executive (default) | Technical |
|---|---|---|
| Route card | Title, what starts it ("Daily at 08:00", "HTTP POST /api/tickets"), what it uses (AI ×2, Database…) | Route id, `from` URI, every endpoint it sends to, step count, `file:line` |
| Lines | "calls", "hands off", "Kafka · orders", "asks", "stores" | The shared endpoint (`direct:intake`, `kafka:tickets.normal`) |
| Systems | Friendly names (OpenAI · gpt-4o, Slack · #support) | Also the raw URIs, plus internal plumbing (`log`, `bean`, dynamic `toD`) |
| Details panel | "What it does" in plain language | Step tree with expressions, parameters and the route's YAML |

Click any card to open its details on the right. Its neighbours are highlighted and everything else is faded.

**View** menu toggles:

| Toggle | Key | Effect |
|---|---|---|
| External systems | `S` | Show or hide system nodes (AI, databases, APIs…) |
| Internal steps | `I` | Show or hide `log`, `bean`, dynamic endpoints and similar. On by default in Technical, off in Executive. |
| Group routes by file | `G` | Draw a box around each file's routes |
| Minimap | `M` | Show or hide the minimap |
| Legend | | Show or hide the legend |

## Explorer and YAML source

The **Explorer** is the left sidebar. Toggle it with `E` or the toolbar's first icon.

- **All files** shows everything.
- **Click a file** to show only that file's routes, plus the systems they use. Routes in other files that it calls, or that call it, stay as faded, dashed cards so you can see how the file connects. The URL gets `?file=…`, so you can bookmark or share that view.
- **Expand a file** to list its routes and REST endpoints. Click one to select it; the canvas pans to it. Double-click a route to open it step by step.
- **`</>`** opens the file's full YAML on the right, with wrap, copy and "show on canvas" buttons.
  - The selected route's lines are highlighted.
  - Click any route's lines to jump to that route on the canvas.
  - In the Technical view, a route's details also have an **Open full file** link.

Both side panels resize by dragging their inner edge. Double-click the edge to reset the width.

## Step-by-step flow

Double-click a route, press `Enter` on a selected route, or use **Open step-by-step flow** in its details. You'll see:
- the trigger and every step in order;
- `choice`, `doTry`, `multicast` and `circuitBreaker` fanning out into branches that join again;
- `split`, `loop`, `aggregate`, `filter` and similar wrapped in a box around their inner steps.

A step that calls another route has an **Open flow** link to that route. The toolbar breadcrumb, or `Esc`, returns to the overview.

## Working with the canvas

- **Zoom:**
  - scroll or pinch;
  - the controls in the bottom-right corner;
  - `+` / `−` / `0` (fit to screen);
  - **View › Zoom**.
- **Move cards** by dragging. Positions are remembered per folder, file and view, and are kept when files reload. **Layout › Reset layout** re-arranges everything.
- **Direction:** left → right or top → bottom (`L`).
- **Theme:** use the palette icon in the toolbar for previews, or **View › Theme**. Choose Light, Dark, Midnight (violet), Ocean (blue), Forest (green), or Rose (pink). System follows your OS setting. Your choice is saved in this browser; `T` cycles through all themes. Themes color the entire viewer, including cards, YAML, and PNG exports.
- **Search** (`/`) highlights matching routes, systems and steps.

## Exporting a PNG

**Export › PNG — transparent / white / theme background** downloads straight away at 2×. **Export › Export options…** (⌘/Ctrl+E) opens a dialog where you choose:

- **Background:** transparent (drops cleanly onto slides), theme colour, or white.
- **Colors:** the current theme, or force light or dark, for example to present a light diagram while working in dark.
- **Resolution:** 1×, 2× or 3×.

The whole diagram is exported, not just what's on screen, without the grid, controls, minimap or selection highlight. The file is named after what you're viewing, for example `receipt-ocr-sqlite-executive.png`.

## Presenting

**View › Presentation mode** (`P`) hides the menus, toolbar and panels. `Esc` leaves it.

## Keyboard shortcuts

Single-key shortcuts are ignored while you're typing in a field. Press `?` in the app for this list.

| Key | Action |
|---|---|
| `V` | Switch Executive / Technical view |
| `E` | Show / hide the Explorer |
| `L` | Layout: left → right / top → bottom |
| `S` | Show / hide external systems |
| `I` | Show / hide internal steps |
| `G` | Group routes by file |
| `M` | Show / hide the minimap |
| `T` | Cycle through themes |
| `P` | Presentation mode |
| `/` | Search |
| `+` `−` `0` | Zoom in, zoom out, fit to screen |
| `Enter` | Open the selected route step by step |
| `Esc` | Close a dialog or panel, go back to the overview, leave presentation |
| ⌘/Ctrl+`O` | Open YAML files |
| ⌘/Ctrl+`E` | Export PNG… |
| `?` | Show all shortcuts |

Hover over any toolbar icon to see what it does and its shortcut.
