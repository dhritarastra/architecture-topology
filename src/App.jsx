import {useState, useRef, useEffect, useMemo, useCallback} from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";

import {JsonView} from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import "./App.css";

// auto-import all JSON definitions
const nodeModules = import.meta.glob("./services/nodes/*.json", {eager: true});
const edgeModules = import.meta.glob("./services/edges/*.json", {eager: true});
const flowModules = import.meta.glob("./services/flows/*.json", {eager: true});

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
    // OFF-FLOW (apply to nodes + edges)
    {
        selector: "node.off-flow",
        style: {
            opacity: 0.05,
            "text-opacity": 0.05,
        },
    },
    {
        selector: "edge.off-flow",
        style: {
            opacity: 0.05,
            "text-opacity": 0.05,
            "line-style": "dashed",
        },
    },

// NEXT (upcoming)
    {
        selector: "node.flow-next",
        style: {
            opacity: 0.55,
            "text-opacity": 0.35,
            "border-color": "#9ca3af",
            "border-width": 3,
        },
    },
    {
        selector: "edge.flow-next",
        style: {
            opacity: 0.55,
            "text-opacity": 0.35,
            "line-color": "#9ca3af",
            "target-arrow-color": "#9ca3af",
            width: 3,
        },
    },

// DONE (previous)
    {
        selector: "node.flow-done",
        style: {
            opacity: 0.95,
            "text-opacity": 0.85,
            "border-color": "#0f766e",
            "border-width": 4,
        },
    },
    {
        selector: "edge.flow-done",
        style: {
            opacity: 0.95,
            "text-opacity": 0.85,
            "line-color": "#0f766e",
            "target-arrow-color": "#0f766e",
            width: 5,
        },
    },

// CURRENT (active)
    {
        selector: "node.flow-current",
        style: {
            opacity: 1,
            "text-opacity": 1,
            "border-color": "#f97316",
            "border-width": 6,
        },
    },
    {
        selector: "edge.flow-current",
        style: {
            opacity: 1,
            "text-opacity": 1,
            "line-color": "#f97316",
            "target-arrow-color": "#f97316",
            width: 7,
        },
    },
    // UNHAPPY (possible failure outcomes for *current* step)
    {
        selector: "node.flow-unhappy",
        style: {
            opacity: 0.75,
            "text-opacity": 0.6,
            "border-color": "#ef4444",
            "border-width": 4,
        },
    },
    {
        selector: "edge.flow-unhappy",
        style: {
            opacity: 0.75,
            "text-opacity": 0.55,
            "line-style": "dashed",
            "line-color": "#ef4444",
            "target-arrow-color": "#ef4444",
            width: 4,
        },
    },

    // UNHAPPY (selected unhappy outcome - optional)
    {
        selector: "node.flow-unhappy-selected",
        style: {
            opacity: 1,
            "text-opacity": 1,
            "border-color": "#dc2626",
            "border-width": 6,
        },
    },
    {
        selector: "edge.flow-unhappy-selected",
        style: {
            opacity: 1,
            "text-opacity": 1,
            "line-style": "dashed",
            "line-color": "#dc2626",
            "target-arrow-color": "#dc2626",
            width: 6,
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

    const handleMouseUpRef = useRef(null);
    // step index within selected flow.edges[]
    const [currentStepIndex, setCurrentStepIndex] = useState(0);

    const cyRef = useRef(null);
    const layoutApplied = useRef(false);

    // resizable split state and refs
    const [leftWidth, setLeftWidth] = useState(70);
    const isResizingRef = useRef(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(70);

    const [showUnhappy, setShowUnhappy] = useState(true);


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

        // 🔒 determinism: stable ordering
        allNodes.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        allEdges.sort((a, b) => String(a.id).localeCompare(String(b.id)));

        const nodes = allNodes.map((n) => ({
            data: {...n},
        }));

        const edges = allEdges.map((e) => ({
            data: {...e},
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

    const [layoutVersion, setLayoutVersion] = useState(0);

    const runLayout = useCallback((opts = {}) => {
        const cy = cyRef.current;
        if (!cy) return;

        // Stop any running layout
        if (cy._activeLayout) {
            try {
                cy._activeLayout.stop();
            } catch (_) {
            }
        }

        // ✅ symmetry helper: snap nodes to a clean grid BEFORE dagre
        // This reduces micro-misalignment and makes the final result look more "even"
        const gridSize = 20;
        cy.nodes().forEach((n) => {
            const p = n.position();
            n.position({
                x: Math.round(p.x / gridSize) * gridSize,
                y: Math.round(p.y / gridSize) * gridSize,
            });
        });

        const layout = cy.layout({
            name: "dagre",
            rankDir: "LR",

            // "symmetry / clean spacing" knobs
            nodeSep: 100,
            rankSep: 120,
            edgeSep: 100,

            // This often produces a more balanced, consistent structure
            ranker: "network-simplex",

            // Force dagre to respect node dimensions consistently
            // (helps reduce overlaps/odd packing)
            spacingFactor: 1.15,

            // Keep some breathing space around the graph
            padding: 60,

            // Avoid animation jitter (deterministic visual)
            animate: false,

            ...opts,
        });

        cy._activeLayout = layout;
        layout.run();

        requestAnimationFrame(() => {
            cy.fit(undefined, 50);
        });
    }, []);


    /* ------------------------------------------
       APPLY DAGRE LAYOUT ONCE
    ------------------------------------------- */
    useEffect(() => {
        if (!cyRef.current || !elements.length) return;

        // Run layout on first load and every refresh
        runLayout();

        // keep your flag if you want, but you no longer need it
        layoutApplied.current = true;
    }, [elements, layoutVersion, runLayout]);


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
        window.removeEventListener("mouseup", handleMouseUpRef.current);


        if (cyRef.current) {
            const cy = cyRef.current;
            requestAnimationFrame(() => {
                cy.resize(); // no fit here if you want positions to stay
            });
        }
    }, [handleMouseMove]);

    useEffect(() => {
        handleMouseUpRef.current = handleMouseUp;
    }, [handleMouseUp]);


    const handleMouseDown = useCallback(
        (e) => {
            isResizingRef.current = true;
            startXRef.current = e.clientX;
            startWidthRef.current = leftWidth;

            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUpRef.current);
        },
        [leftWidth, handleMouseMove]
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

    const getFlowSteps = (flow) => {
        if (!flow) return [];
        if (Array.isArray(flow.steps) && flow.steps.length) return flow.steps;

        // fallback to old format (edges only)
        const edges = Array.isArray(flow.edges) ? flow.edges : [];
        return edges.map((edgeId) => ({edgeId}));
    };

    /* ------------------------------------------
       APPLY FLOW + STEP HIGHLIGHTING FOR API MODE
    ------------------------------------------- */
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;

        // Clear all step/flow classes first
        cy.elements().removeClass("off-flow flow-next flow-done flow-current flow-unhappy flow-unhappy-selected");

        // Only apply in API mode
        if (viewMode !== "api" || !selectedFlowId) return;

        const flow = API_FLOWS.find((f) => f.id === selectedFlowId);
        if (!flow) return;

        const steps = getFlowSteps(flow);
        const flowEdgeIds = steps.map(s => s.edgeId).filter(Boolean);

        if (flowEdgeIds.length === 0) {
            // If flow has no edges, just grey everything else out
            cy.elements().addClass("off-flow");
            return;
        }

        // Clamp index
        const idx = Math.min(Math.max(currentStepIndex, 0), flowEdgeIds.length - 1);

        const doneEdgeIds = flowEdgeIds.slice(0, idx);      // previous edges
        const currentEdgeId = flowEdgeIds[idx];             // current edge
        const nextEdgeIds = flowEdgeIds.slice(idx + 1);     // future edges
        const currentStep = steps[idx] || null;
        const unhappyEdgeIds = showUnhappy
            ? (Array.isArray(currentStep?.unhappy) ? currentStep.unhappy.map(u => u.edgeId).filter(Boolean) : [])
            : [];


        // Helper to collect nodes touched by a list of edges
        const collectTouchedNodes = (edgeIds) => {
            const nodeIds = new Set();
            edgeIds.forEach((eid) => {
                const e = cy.getElementById(eid);
                if (e && e.length > 0) {
                    const s = e.data("source");
                    const t = e.data("target");
                    if (s) nodeIds.add(s);
                    if (t) nodeIds.add(t);
                }
            });
            return nodeIds;
        };

        const unhappyNodeIds = collectTouchedNodes(unhappyEdgeIds);
        const doneNodeIds = collectTouchedNodes(doneEdgeIds);
        const nextNodeIds = collectTouchedNodes(nextEdgeIds);

        // Current edge + current nodes
        const currentEdge = currentEdgeId ? cy.getElementById(currentEdgeId) : null;
        const currentNodeIds = new Set();
        if (currentEdge && currentEdge.length > 0) {
            const s = currentEdge.data("source");
            const t = currentEdge.data("target");
            if (s) currentNodeIds.add(s);
            if (t) currentNodeIds.add(t);
        }

        // 1) Grey out EVERYTHING by default (stronger than your old "dimmed")
        cy.elements().addClass("off-flow");

        // 2) Un-grey all edges/nodes that are part of the flow path (done/current/next)
        const allRelevantEdgeIds = [
            ...doneEdgeIds,
            currentEdgeId,
            ...nextEdgeIds,
            ...unhappyEdgeIds,
        ].filter(Boolean);

        const allRelevantNodeIds = new Set([
            ...doneNodeIds,
            ...currentNodeIds,
            ...nextNodeIds,
            ...unhappyNodeIds,
        ]);


        cy.edges().filter((e) => allRelevantEdgeIds.includes(e.id()))
            .removeClass("off-flow");

        cy.nodes().filter((n) => allRelevantNodeIds.has(n.id()))
            .removeClass("off-flow");

        // 3) Apply classes by phase
        // Done
        if (doneEdgeIds.length) {
            cy.edges().filter((e) => doneEdgeIds.includes(e.id()))
                .addClass("flow-done");
            cy.nodes().filter((n) => doneNodeIds.has(n.id()))
                .addClass("flow-done");
        }

        // Next
        if (nextEdgeIds.length) {
            cy.edges().filter((e) => nextEdgeIds.includes(e.id()))
                .addClass("flow-next");
            cy.nodes().filter((n) => nextNodeIds.has(n.id()))
                .addClass("flow-next");
        }

        // Current (overrides done/next where needed)
        if (currentEdgeId) {
            const e = cy.getElementById(currentEdgeId);
            if (e && e.length > 0) e.addClass("flow-current");

            cy.nodes().filter((n) => currentNodeIds.has(n.id()))
                .addClass("flow-current");
        }

        // 4) Auto-center on current step (nice UX while stepping)
        if (currentEdgeId) {
            const e = cy.getElementById(currentEdgeId);
            if (e && e.length > 0) {
                // center on the edge (you can also center on nodes if you prefer)
                cy.animate({center: {eles: e}, duration: 200});
            }
        }

        // Unhappy (possible outcomes for current step)
        if (unhappyEdgeIds.length) {
            cy.edges().filter((e) => unhappyEdgeIds.includes(e.id()))
                .addClass("flow-unhappy");

            cy.nodes().filter((n) => unhappyNodeIds.has(n.id()))
                .addClass("flow-unhappy");
        }


    }, [viewMode, selectedFlowId, currentStepIndex, showUnhappy]);

    // Find active flow (for API mode)
    const activeFlow = useMemo(() => {
        if (viewMode !== "api" || !selectedFlowId) return null;
        return API_FLOWS.find((f) => f.id === selectedFlowId) || null;
    }, [viewMode, selectedFlowId]);

    const activeSteps = useMemo(() => getFlowSteps(activeFlow), [activeFlow]);

    const currentStep = useMemo(() => {
        if (viewMode !== "api" || !activeSteps.length) return null;
        const idx = Math.min(Math.max(currentStepIndex, 0), activeSteps.length - 1);
        return activeSteps[idx] || null;
    }, [viewMode, activeSteps, currentStepIndex]);

    const currentEdgeId = currentStep?.edgeId || null;


    // Decide which schema to show for the selected node
    const getSchemaForSelectedNode = (nodeData) => {
        if (!nodeData) return {};

        // STEP-specific schema wins
        if (viewMode === "api" && currentStep?.nodeSchemas) {
            const stepSchema = currentStep.nodeSchemas[nodeData.id];
            if (stepSchema) return stepSchema;
        }

        // fallback: flow-level schema
        if (viewMode === "api" && activeFlow?.nodeSchemas) {
            const flowSchema = activeFlow.nodeSchemas[nodeData.id];
            if (flowSchema) return flowSchema;
        }

        // fallback: node’s own schema
        return nodeData.schema || {};
    };


    /* ------------------------------------------ */
    return (
        <div className="app-container">
            {/* LEFT: graph */}
            <div
                className="graph-container"
                style={{width: `${leftWidth}%`}}
            >
                <CytoscapeComponent
                    elements={elements}
                    style={{width: "100%", height: "100%"}}
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
                style={{width: `${100 - leftWidth}%`}}
            >
                {/* View mode toggle */}
                <div style={{marginBottom: 12}}>
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
                    <button
                        onClick={() => setLayoutVersion((v) => v + 1)}
                        style={{
                            marginLeft: 12,
                            padding: "4px 8px",
                            background: "#111827",
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                        }}
                    >
                        Refresh Layout
                    </button>
                </div>

                {/* Flow dropdown */}
                {viewMode === "api" && (
                    <div style={{marginBottom: 12}}>
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
                {viewMode === "api" && activeFlow && activeFlow.edges && activeSteps.length > 0 && (
                    <div style={{marginBottom: 12}}>
                        <div style={{marginBottom: 4}}>
                            <strong>
                                Step {Math.min(currentStepIndex + 1, activeSteps.length)} of{" "}
                                {activeSteps.length}
                            </strong>
                        </div>
                        <div style={{display: "flex", gap: 8, marginBottom: 4}}>
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
                                        Math.min(activeSteps.length - 1, idx + 1)
                                    )
                                }
                                disabled={currentStepIndex >= activeSteps.length - 1}
                                style={{
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    border: "1px solid #d1d5db",
                                    background:
                                        currentStepIndex >= activeSteps.length - 1
                                            ? "#f3f4f6"
                                            : "#e5e7eb",
                                    cursor:
                                        currentStepIndex >= activeSteps.length - 1
                                            ? "not-allowed"
                                            : "pointer",
                                }}
                            >
                                Next ▶
                            </button>
                        </div>
                        <div style={{fontSize: 12, color: "#4b5563"}}>
                            {(() => {
                                if (!activeSteps.length) return null;

                                const step = activeSteps[Math.min(currentStepIndex, activeSteps.length - 1)];
                                const edgeId = step?.edgeId;

                                if (!edgeId) return null;

                                const edgeEl = elements.find((el) => el.data && el.data.id === edgeId);
                                if (!edgeEl) return `Edge: ${edgeId}`;

                                const {source, target, label} = edgeEl.data;
                                return `Step: ${source} → ${target}${label ? ` (${label})` : ""}`;
                            })()}
                        </div>
                    </div>
                )}

                {viewMode === "api" && currentStep && (
                    <div style={{marginBottom: 12}}>
                        <h3 style={{margin: "8px 0"}}>Step Details</h3>
                        <div style={{fontSize: 12, color: "#4b5563", marginBottom: 6}}>
                            {currentStep.title || `Edge: ${currentStep.edgeId}`}
                        </div>

                        {Array.isArray(currentStep.unhappy) && currentStep.unhappy.length > 0 && (
                            <div style={{marginTop: 8}}>
                                <div style={{fontWeight: 600, marginBottom: 6}}>Unhappy paths at this step</div>
                                <ul style={{margin: 0, paddingLeft: 18, fontSize: 12, color: "#4b5563"}}>
                                    {currentStep.unhappy.map((u) => (
                                        <li key={u.edgeId}>
                                            {u.title || u.edgeId} <span style={{opacity: 0.7}}>({u.edgeId})</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <label style={{display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12}}>
                            <input type="checkbox" checked={showUnhappy}
                                   onChange={(e) => setShowUnhappy(e.target.checked)}/>
                            Show unhappy paths
                        </label>


                        <div style={{marginTop: 10}}>
                            <JsonView data={currentStep.nodeSchemas || {}}/>
                        </div>
                    </div>
                )}


                {/* Node details */}
                {selectedNode ? (
                    <div>
                        <h2>Node Details</h2>
                        <JsonView data={getSchemaForSelectedNode(selectedNode)}/>
                    </div>
                ) : (
                    <div>Select a node to inspect its schema.</div>
                )}
            </div>
        </div>
    );
}
