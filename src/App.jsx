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
const flowModules = import.meta.glob("./services/flows/*.json", { eager: true });

cytoscape.use(dagre);

/* -------------------------------------------------------
   LOAD API FLOWS dynamically
-------------------------------------------------------- */
const API_FLOWS = Object.entries(flowModules)
    .map(([path, mod]) => {
        const flow = mod.default ?? mod;
        console.log("Loaded flow module:", path, flow);
        return flow;
    })
    .filter((f) => f && f.id && f.label);

/* -------------------------------------------------------
   STYLESHEET
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
        selector: "node[type='library']",
        style: {
            "background-opacity": 0,
            "background-image": "url(/aws-icons/ECS.svg)",
            "background-fit": "cover",
        },
    },
    {
        selector: "node[type='dynamodb']",
        style: {
            shape: "ellipse",
            width: 70,
            height: 70,
            "background-opacity": 0,
            "background-image": "url(/aws-icons/DynamoDB.svg)",
            "background-fit": "cover",
        },
    },
    {
        selector: "node[type='eventbridge']",
        style: {
            "background-opacity": 0,
            "background-image": "url(/aws-icons/ECS.svg)",
            "background-fit": "cover",
        },
    },
    {
        selector: "node[type='apex']",
        style: {
            "background-opacity": 0,
            "background-image": "url(/aws-icons/ECS.svg)",
            "background-fit": "cover",
        },
    },
    {
        selector: "node[type='mop']",
        style: {
            shape: "ellipse",
            width: 70,
            height: 70,
            "background-opacity": 0,
            "background-image": "url(/aws-icons/group.png)",
            "background-fit": "cover",
        },
    },
    {
        selector: "node[type='cloudfront']",
        style: {
            shape: "ellipse",
            width: 70,
            height: 70,
            "background-opacity": 0,
            "background-image": "url(/aws-icons/CloudFront.svg)",
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
            "text-margin-y": 0,
            "text-margin-x": 0,
        },
    },
    {
        selector: "edge[dir='backward']",
        style: {
            "line-color": "#10b981",
            "target-arrow-color": "#10b981",
            "text-margin-y": 0,
            "text-margin-x": 0,
        },
    },
    {
        selector: ".dimmed",
        style: {
            opacity: 0.15,
            "text-opacity": 0.2,
            "line-style": "dashed",
        },
    },
    {
        selector: ".highlighted-flow",
        style: {
            opacity: 1,
            "line-style": "solid",
            "line-color": "#0f766e",
            "target-arrow-color": "#0f766e",
        },
    },
    // current step (edge + its source/target node)
    {
        selector: ".current-step",
        style: {
            opacity: 1,
            "line-color": "#f97316",
            "target-arrow-color": "#f97316",
            "border-color": "#f97316",
        },
    },
];

/* -------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------- */
export default function App() {
    const [elements, setElements] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);

    const [viewMode, setViewMode] = useState("infra");
    const [selectedFlowId, setSelectedFlowId] = useState(API_FLOWS[0]?.id || null);

    // step index within selected flow.edges[]
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const cyRef = useRef(null);
    const layoutApplied = useRef(false);

    // resizable split state & refs
    const [leftWidth, setLeftWidth] = useState(70); // percentage for graph panel
    const isResizingRef = useRef(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(70);

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

        const nodes = allNodes.map((n) => ({
            data: { ...n },
        }));

        const edges = allEdges.map((e) => ({
            data: { ...e },
        }));

        return [...nodes, ...edges];
    }, []);

    useEffect(() => {
        setElements(graphElements);
    }, [graphElements]);

    /* ------------------------------------------
       CY INIT
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
            setSelectedNode(evt.target.data());
        });
    }, []);

    /* ------------------------------------------
       APPLY DAGRE LAYOUT ONCE
    ------------------------------------------- */
    useEffect(() => {
        if (!cyRef.current || !elements.length || layoutApplied.current) return;

        const cy = cyRef.current;
        cy.layout({
            name: "dagre",
            rankDir: "LR",
            nodeSep: 50,
            rankSep: 100,
            edgeSep: 200,
        }).run();

        layoutApplied.current = true;
        cy.fit();
    }, [elements]);

    /* ------------------------------------------
       MOUSE HANDLERS FOR RESIZE
    ------------------------------------------- */
    const handleMouseMove = useCallback((e) => {
        if (!isResizingRef.current) return;
        const dx = e.clientX - startXRef.current;
        const deltaPercent = (dx / window.innerWidth) * 100;
        let newWidth = startWidthRef.current + deltaPercent;
        newWidth = Math.max(30, Math.min(80, newWidth)); // clamp
        setLeftWidth(newWidth); // DOM only
    }, []);

    const handleMouseUp = useCallback(() => {
        if (!isResizingRef.current) return;
        isResizingRef.current = false;
        window.removeEventListener("mousemove", handleMouseMove);

        if (cyRef.current) {
            const cy = cyRef.current;
            requestAnimationFrame(() => {
                cy.resize(); // no fit here if you want positions to stay
            });
        }
    }, [handleMouseMove]);

    const handleMouseDown = useCallback(
        (e) => {
            isResizingRef.current = true;
            startXRef.current = e.clientX;
            startWidthRef.current = leftWidth;
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        },
        [leftWidth, handleMouseMove, handleMouseUp]
    );

    // cleanup on unmount
    useEffect(() => {
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    /* ------------------------------------------
       RESET step index when flow/mode changes
    ------------------------------------------- */
    useEffect(() => {
        setCurrentStepIndex(0);
    }, [selectedFlowId, viewMode]);

    /* ------------------------------------------
       APPLY FLOW + STEP HIGHLIGHTING FOR API MODE
    ------------------------------------------- */
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;

        cy.elements().removeClass("dimmed highlighted-flow current-step");
        if (viewMode !== "api" || !selectedFlowId) return;

        const flow = API_FLOWS.find((f) => f.id === selectedFlowId);
        if (!flow) return;

        const { nodes = [], edges = [] } = flow;

        const allNodes = cy.nodes();
        const allEdges = cy.edges();

        const nodesInFlow = allNodes.filter((n) => nodes.includes(n.id()));
        const edgesInFlow = allEdges.filter((e) => edges.includes(e.id()));

        // Dim everything by default
        allNodes.addClass("dimmed");
        allEdges.addClass("dimmed");

        // Undim + mark full flow
        nodesInFlow.removeClass("dimmed").addClass("highlighted-flow");
        edgesInFlow.removeClass("dimmed").addClass("highlighted-flow");

        // Step-specific highlight (currentStepIndex)
        if (edges.length > 0) {
            const clampedIndex = Math.min(
                Math.max(currentStepIndex, 0),
                edges.length - 1
            );
            const edgeId = edges[clampedIndex];
            if (edgeId) {
                const edge = cy.getElementById(edgeId);
                if (edge && edge.length > 0) {
                    edge.removeClass("dimmed").addClass("current-step");
                    const src = edge.source();
                    const tgt = edge.target();
                    [src, tgt].forEach((node) => {
                        if (node && node.length > 0) {
                            node.removeClass("dimmed").addClass("current-step");
                        }
                    });
                }
            }
        }
    }, [viewMode, selectedFlowId, elements, currentStepIndex]);

    // Find active flow (for API mode)
    const activeFlow = useMemo(() => {
        if (viewMode !== "api" || !selectedFlowId) return null;
        return API_FLOWS.find((f) => f.id === selectedFlowId) || null;
    }, [viewMode, selectedFlowId]);

    // Decide which schema to show for the selected node
    const getSchemaForSelectedNode = (nodeData) => {
        if (!nodeData) return {};

        if (viewMode === "api" && activeFlow && activeFlow.nodeSchemas) {
            const flowSchema = activeFlow.nodeSchemas[nodeData.id];
            if (flowSchema) {
                return flowSchema;
            }
        }

        return nodeData.schema || {};
    };

    /* ------------------------------------------ */
    return (
        <div className="app-container">
            {/* LEFT: graph */}
            <div
                className="graph-container"
                style={{ width: `${leftWidth}%` }}
            >
                <CytoscapeComponent
                    elements={elements}
                    style={{ width: "100%", height: "100%" }}
                    cy={onCyInit}
                    stylesheet={stylesheet}
                />
            </div>

            {/* RESIZER BAR */}
            <div
                className="vertical-resizer"
                onMouseDown={handleMouseDown}
            />

            {/* RIGHT: details */}
            <div
                className="details-panel"
                style={{ width: `${100 - leftWidth}%` }}
            >
                {/* View mode toggle */}
                <div style={{ marginBottom: 12 }}>
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
                        API Flows
                    </button>
                </div>

                {/* Flow dropdown */}
                {viewMode === "api" && (
                    <div style={{ marginBottom: 12 }}>
                        <label>
                            <strong>API Flow:&nbsp;</strong>
                            <select
                                value={selectedFlowId || ""}
                                onChange={(e) => setSelectedFlowId(e.target.value)}
                            >
                                {API_FLOWS.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                )}

                {/* Step-by-step controls (only in API mode, when flow loaded) */}
                {viewMode === "api" && activeFlow && activeFlow.edges && activeFlow.edges.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                        <div style={{ marginBottom: 4 }}>
                            <strong>
                                Step {Math.min(currentStepIndex + 1, activeFlow.edges.length)} of{" "}
                                {activeFlow.edges.length}
                            </strong>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                            <button
                                onClick={() =>
                                    setCurrentStepIndex((idx) => Math.max(0, idx - 1))
                                }
                                disabled={currentStepIndex <= 0}
                                style={{
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    border: "1px solid #d1d5db",
                                    background:
                                        currentStepIndex <= 0 ? "#f3f4f6" : "#e5e7eb",
                                    cursor:
                                        currentStepIndex <= 0 ? "not-allowed" : "pointer",
                                }}
                            >
                                ◀ Prev
                            </button>
                            <button
                                onClick={() =>
                                    setCurrentStepIndex((idx) =>
                                        Math.min(activeFlow.edges.length - 1, idx + 1)
                                    )
                                }
                                disabled={currentStepIndex >= activeFlow.edges.length - 1}
                                style={{
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    border: "1px solid #d1d5db",
                                    background:
                                        currentStepIndex >= activeFlow.edges.length - 1
                                            ? "#f3f4f6"
                                            : "#e5e7eb",
                                    cursor:
                                        currentStepIndex >= activeFlow.edges.length - 1
                                            ? "not-allowed"
                                            : "pointer",
                                }}
                            >
                                Next ▶
                            </button>
                        </div>
                        <div style={{ fontSize: 12, color: "#4b5563" }}>
                            {(() => {
                                if (!activeFlow.edges.length) return null;
                                const edgeId =
                                    activeFlow.edges[
                                        Math.min(
                                            currentStepIndex,
                                            activeFlow.edges.length - 1
                                        )
                                        ];
                                const edgeEl = elements.find(
                                    (el) => el.data && el.data.id === edgeId
                                );
                                if (!edgeEl) return `Edge: ${edgeId}`;
                                const { source, target, label } = edgeEl.data;
                                return `Step: ${source} → ${target}${
                                    label ? ` (${label})` : ""
                                }`;
                            })()}
                        </div>
                    </div>
                )}

                {/* Node details */}
                {selectedNode ? (
                    <div>
                        <h2>Node Details</h2>
                        <JsonView data={getSchemaForSelectedNode(selectedNode)} />
                    </div>
                ) : (
                    <div>Select a node to inspect its schema.</div>
                )}
            </div>
        </div>
    );
}
