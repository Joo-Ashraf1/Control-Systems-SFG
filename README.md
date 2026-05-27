# SFGLab — Signal Flow Graph Analyzer

An interactive web application for drawing Signal Flow Graphs (SFGs) and computing transfer functions using **Mason's Gain Rule**. Built with an Angular frontend and a Flask backend powered by SymPy for symbolic math.

---

## Features

- **Interactive Canvas** — Draw nodes and directed branches directly on the canvas using a point-and-click interface (powered by Cytoscape.js)
- **Mason's Rule Engine** — Automatically finds all forward paths, individual loops, non-touching loop combinations, Δ and Δₖ values, and computes the symbolic transfer function T(s)
- **Symbolic Gains** — Branch gains can be any symbolic expression (`G1`, `1/s`, `s+2`, `-H1`, etc.), processed by SymPy
- **Live Graph Info** — Right sidebar shows live node/edge/loop/path counts as you build
- **File I/O** — Load graphs from `.txt` files and export the canvas as a PNG image
- **Undo / Redo** — Full undo/redo stack with `Ctrl+Z` / `Ctrl+Y`
- **Selection Details** — Click any node or edge to inspect and edit its properties in the sidebar
- **Validation** — Pre-calculation validation catches orphan nodes, dead ends, missing I/O assignments, and more

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 17+ (standalone components) |
| Graph rendering | Cytoscape.js |
| Backend | Python / Flask |
| Symbolic math | SymPy |
| Styling | CSS custom properties, JetBrains Mono, Syne |

---

## Project Structure

```
.
├── BackEnd/
│   ├── app.py                  # Flask entry point
│   ├── requirements.txt
│   ├── models/
│   │   ├── graph.py            # Graph data structures & builder
│   │   └── mason.py            # Mason's rule implementation
│   ├── routes/
│   │   └── calculate.py        # /calculate endpoint + DFS path/loop finder
│   └── test/
│       ├── test_calculate.py
│       └── test_calculate_extended.py
│
└── FrontEnd/
    └── src/
        ├── app/
        │   ├── app.ts / app.html / app.css   # Root shell
        │   ├── Components/
        │   │   ├── canvas/         # Cytoscape canvas, tool handlers, undo/redo
        │   │   ├── left-bar/       # Calculate button, results accordion
        │   │   ├── rightbar/       # Graph info, file ops, selection details
        │   │   ├── footer/         # Toolbar (Select / Move / Add Node / Branch)
        │   │   ├── gainmenu/       # Gain input modal
        │   │   └── results-pop-up/ # Full results dialog (WIP)
        │   ├── Models/             # TypeScript interfaces
        │   └── Services/
        │       ├── api.ts          # HTTP client for /calculate
        │       ├── parsing.ts      # .txt file parser
        │       └── graph-validation.service.ts
        └── environments/
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm

### Backend

```bash
cd BackEnd
pip install -r requirements.txt
python app.py
```

The API starts on `http://localhost:5000`.

### Frontend

```bash
cd FrontEnd
npm install
ng serve
```

The app opens at `http://localhost:4200`.

---

## API

### `POST /calculate`

Accepts a graph payload and returns a full Mason's rule breakdown.

**Request body:**
```json
{
  "nodes": [{ "id": "x1" }, { "id": "x2" }, { "id": "x3" }],
  "edges": [
    { "id": "e1", "from": "x1", "to": "x2", "gain": "G1" },
    { "id": "e2", "from": "x2", "to": "x3", "gain": "G2" },
    { "id": "e3", "from": "x2", "to": "x2", "gain": "-H1" }
  ],
  "inputNode": "x1",
  "outputNode": "x3"
}
```

**Response:**
```json
{
  "forwardPaths":     [{ "index": 1, "gain": "G1*G2", "nodesPath": ["x1","x2","x3"] }],
  "loops":            [{ "index": 1, "gain": "-H1",   "nodesPath": ["x2","x2"] }],
  "nonTouchingLoops": [],
  "delta":            "1 + H1",
  "deltaK":           ["1"],
  "tfSymbolic":       "G1*G2 / (1 + H1)"
}
```

---

## .txt File Format

Graphs can be loaded from plain-text files:

```
nodes: x1,x2,x3,x4
edges:
x1->x2: G1
x2->x3: G2
x3->x2: -H1
x3->x4: G3
input: x1
output: x4
```

Comments starting with `//` are ignored.

---

## Running Tests

### Backend

```bash
cd BackEnd
pytest test/
```

The test suite covers: single/multiple forward paths, self-loops, negative feedback, non-touching loops, delta computation, stress tests, and response time.

### Frontend

```bash
cd FrontEnd
ng test
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Delete` / `Backspace` | Delete selected element |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |

---

## License

MIT
