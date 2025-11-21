import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";

import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import "./App.css";

// auto-import all JSON definitions
const nodeModules = import.meta.glob("./services/nodes/*.json", { eager: true });
const edgeModules = import.meta.glob("./services/edges/*.json", { eager: true });

cytoscape.use(dagre);

/* -------------------------------------------------------
   EXAMPLE API FLOWS (multi-layer)
   You can change / extend this as you like.
-------------------------------------------------------- */
const API_FLOWS = [
    {
        id: "su-cron-full-path",
        label: "SU-CRON → SQS → LPS → DB (write)",
        nodes: ["SU-CRON", "SQS_FIFO", "LPS", "DB"],
        edges: ["e1", "e2", "e3"],
    },
    {
        id: "db-to-lps-read",
        label: "DB → LPS (read)",
        nodes: ["DB", "LPS"],
        edges: ["e4"],
    },
];

/* -------------------------------------------------------
   STYLESHEET — clean static edges with triangle arrows
   + classes for dimming / highlighting flows
-------------------------------------------------------- */
const stylesheet = [
    {
        selector: "node[label]",
        style: {
            label: "data(label)",
            "text-valign": "bottom",
            "text-halign": "center",
            "font-size": 16,
            color: "#111827",
            "border-width": 3,
            "border-color": "#4b5563",
            "text-margin-y": 5,
            width: 85,
            height: 85,
            shape: "round-rectangle",
        },
    },
    {
        selector: "node[type='rds']",
        style: {
            shape: "ellipse",
            width: 70,
            height: 70,
            "background-opacity": 0,
            "background-image": "url(/aws-icons/RDS.svg)",
            "background-fit": "cover",
        },
    },
    {
        selector: "node[type='ecs']",
        style: {
            "background-opacity": 0,
            "background-image": "url(/aws-icons/ECS.svg)",
            "background-fit": "cover",
        },
    },
    {
        selector: "node[type='sqs']",
        style: {
            "background-opacity": 0,
            "background-image": "url(/aws-icons/SQS.svg)",
            "background-fit": "cover",
        },
    },
    {
        selector: "edge",
        style: {
            width: 3,
            "line-color": "#6b7280",
            "target-arrow-color": "#6b7280",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "control-point-step-size": 40,

            label: "data(label)",
            "font-size": 12,
            color: "#111827",
            "text-rotation": "autorotate",
            "text-background-color": "#f9fafb",
            "text-background-opacity": 1,
            "text-background-shape": "round-rectangle",
            "text-background-padding": 3,
        },
    },
    {
        selector: "edge[dir='forward']",
        style: {
            "line-color": "#3b82f6",
            "target-arrow-color": "#3b82f6",
            "text-margin-y": -10,
            "text-margin-x": -12,
        },
    },
    {
        selector: "edge[dir='backward']",
        style: {
            "line-color": "#10b981",
            "target-arrow-color": "#10b981",
            "text-margin-y": 10,
            "text-margin-x": -12,
        },
    },
    // Dimmed elements (when not in selected API flow)
    {
        selector: ".dimmed",
        style: {
            opacity: 0.15,
            "text-opacity": 0.2,
            "line-style": "dashed",
        },
    },
    // Highlighted elements (in selected API flow)
    {
        selector: ".highlighted-flow",
        style: {
            opacity: 1,
            "line-style": "solid",
            "line-color": "#0f766e",
            "target-arrow-color": "#0f766e",
        },
    },
];

/* -------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------- */
export default function App() {
    const [elements, setElements] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);

    // viewMode: "infra" | "api"
    const [viewMode, setViewMode] = useState("infra");
    const [selectedFlowId, setSelectedFlowId] = useState(API_FLOWS[0]?.id || null);

    const cyRef = useRef(null);
    const layoutApplied = useRef(false);

    /* ------------------------------------------
       BUILD ELEMENTS FROM JSON FILES
    ------------------------------------------- */
    const graphElements = useMemo(() => {
        const allNodes = Object.values(nodeModules).flatMap((mod) =>
            Array.isArray(mod.default) ? mod.default : []
        );

        const allEdges = Object.values(edgeModules).flatMap((mod) =>
            Array.isArray(mod.default) ? mod.default : []
        );

        const nodeElements = allNodes.map((n) => ({
            data: {
                id: n.id,
                repo: n.repo,
                label: n.label,
                type: n.type,
                schema: n.schema,
            },
        }));

        const edgeElements = allEdges.map((e) => ({
            data: {
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
                dir: e.dir,
            },
        }));

        return [...nodeElements, ...edgeElements];
    }, []);

    useEffect(() => {
        setElements(graphElements);
    }, [graphElements]);

    /* ------------------------------------------
       CY INIT — interactions only
    ------------------------------------------- */
    const onCyInit = useCallback((cy) => {
        cyRef.current = cy;

        cy.zoomingEnabled(true);
        cy.panningEnabled(true);
        cy.userZoomingEnabled(true);
        cy.userPanningEnabled(true);
        cy.boxSelectionEnabled(true);

        cy.nodes().unlock();
        cy.nodes().grabify();

        cy.on("tap", "node", (evt) => {
            const node = evt.target;
            setSelectedNode(node.data());
        });
    }, []);

    /* ------------------------------------------
       APPLY LAYOUT ONCE, AFTER ELEMENTS LOADED
    ------------------------------------------- */
    useEffect(() => {
        if (!cyRef.current) return;
        if (!elements.length) return;
        if (layoutApplied.current) return;

        const cy = cyRef.current;

        const layout = cy.layout({
            name: "dagre",
            rankDir: "LR",
            nodeSep: 50,
            rankSep: 70,
            edgeSep: 20,
        });

        layout.run();
        layoutApplied.current = true;

        cy.fit();
    }, [elements]);

    /* ------------------------------------------
       APPLY FLOW HIGHLIGHTING FOR API VIEW
    ------------------------------------------- */
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;

        // Clear previous classes
        cy.elements().removeClass("dimmed");
        cy.elements().removeClass("highlighted-flow");

        if (viewMode !== "api" || !selectedFlowId) {
            // Infra view ⇒ everything normal
            return;
        }

        const flow = API_FLOWS.find((f) => f.id === selectedFlowId);
        if (!flow) return;

        const { nodes: nodeIds = [], edges: edgeIds = [] } = flow;

        const allNodes = cy.nodes();
        const allEdges = cy.edges();

        const nodesInFlow = allNodes.filter((n) => nodeIds.includes(n.id()));
        const edgesInFlow = allEdges.filter((e) => edgeIds.includes(e.id()));

        // Dim everything
        allNodes.addClass("dimmed");
        allEdges.addClass("dimmed");

        // Undim + highlight flow
        nodesInFlow.removeClass("dimmed").addClass("highlighted-flow");
        edgesInFlow.removeClass("dimmed").addClass("highlighted-flow");
    }, [viewMode, selectedFlowId, elements]);

    /* ------------------------------------------ */
    return (
        <div className="app-container">
            {/* Left: Graph */}
            <div className="graph-container">
                <CytoscapeComponent
                    elements={elements}
                    style={{ width: "100%", height: "100%" }}
                    cy={onCyInit}
                    stylesheet={stylesheet}
                />
            </div>

            {/* Right: Controls + Node Details */}
            <div className="details-panel">
                {/* View mode toggle */}
                <div style={{ marginBottom: "12px" }}>
                    <strong>View:</strong>{" "}
                    <button
                        onClick={() => setViewMode("infra")}
                        style={{
                            marginRight: 8,
                            padding: "4px 8px",
                            background: viewMode === "infra" ? "#0f766e" : "#e5e7eb",
                            color: viewMode === "infra" ? "#fff" : "#111827",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                        }}
                    >
                        Infra
                    </button>
                    <button
                        onClick={() => setViewMode("api")}
                        style={{
                            padding: "4px 8px",
                            background: viewMode === "api" ? "#0f766e" : "#e5e7eb",
                            color: viewMode === "api" ? "#fff" : "#111827",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                        }}
                    >
                        API flows
                    </button>
                </div>

                {/* API flow selector */}
                {viewMode === "api" && (
                    <div style={{ marginBottom: "12px" }}>
                        <label>
                            <strong>API Flow:&nbsp;</strong>
                            <select
                                value={selectedFlowId || ""}
                                onChange={(e) => setSelectedFlowId(e.target.value || null)}
                            >
                                {API_FLOWS.map((flow) => (
                                    <option key={flow.id} value={flow.id}>
                                        {flow.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                )}

                {/* Node details */}
                {selectedNode ? (
                    <div>
                        <h2 style={{ marginTop: 0, marginBottom: 8 }}>Node Details</h2>
                        <div style={{ fontSize: 14, marginBottom: 8 }}>
                            <div><strong>ID:</strong> {selectedNode.id}</div>
                            <div><strong>Label:</strong> {selectedNode.label}</div>
                            <div><strong>Type:</strong> {selectedNode.type}</div>
                            {selectedNode.repo && (
                                <div><strong>Repo:</strong> {selectedNode.repo}</div>
                            )}
                        </div>
                        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Schema</h3>
                        <JsonView data={selectedNode.schema || {}} />
                    </div>
                ) : (
                    <div>Select a node to inspect its schema.</div>
                )}
            </div>
        </div>
    );
}
