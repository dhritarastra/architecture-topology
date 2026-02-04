# Architecture Topology Visualizer

An interactive web application for visualizing system architecture and API flows. Built with React, Cytoscape.js, and Dagre layout.

## Overview

This tool provides:
- **Infrastructure View** — Visual representation of AWS services (ECS, RDS, DynamoDB, SQS, etc.) and their connections
- **API Flow View** — Step-by-step visualization of API request flows with happy/unhappy path exploration
- **Interactive Graph** — Click nodes to inspect details, drag to reposition, zoom and pan

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd architecture-topology

# Install dependencies
npm install
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview  # Preview the production build
```

## Project Structure

```
src/
├── App.jsx              # Main application component
├── App.css              # Styles
└── services/            # Data definitions (JSON)
    ├── nodes/           # Node definitions (ECS, RDS, etc.)
    ├── edges/           # Connections between nodes
    └── flows/           # API flow definitions
public/
└── aws-icons/           # AWS service icons
```

## Adding Data

### Add a Node

Create a JSON file in `src/services/nodes/`:

```json
[
  {
    "id": "MY-SERVICE",
    "label": "My Service",
    "type": "ecs",
    "layer": "application"
  }
]
```

### Add an Edge

Create a JSON file in `src/services/edges/`:

```json
[
  {
    "id": "e1",
    "source": "SERVICE-A",
    "target": "SERVICE-B",
    "label": "REST API"
  }
]
```

### Add a Flow

Create a JSON file in `src/services/flows/`:

```json
{
  "id": "my-flow",
  "label": "My API Flow",
  "nodes": ["SERVICE-A", "SERVICE-B"],
  "edges": ["e1"],
  "steps": [
    {
      "id": "s1",
      "edgeId": "e1",
      "title": "Service A calls Service B"
    }
  ]
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F` | Fit graph to viewport |
| `/` | Focus search |
| `R` | Refresh layout |
| `?` | Show help overlay |
| `Esc` | Clear selection |
