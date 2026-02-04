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
        selector: "node[type='dynamo-db']",
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
        selector: "node[type='config']",
        style: {
            "background-opacity": 0,
            "background-image": "url(/aws-icons/Config.svg)",
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


    // FILTERED (hidden nodes)
    {
        selector: "node.filtered-out",
        style: {
            opacity: 0.1,
            "text-opacity": 0.1,
        },
    },
    {
        selector: "edge.filtered-out",
        style: {
            opacity: 0.1,
            "text-opacity": 0.1,
        },
    },

    // SEARCH HIGHLIGHT
    {
        selector: "node.search-highlight",
        style: {
            "border-color": "#8b5cf6",
            "border-width": 6,
            opacity: 1,
            "text-opacity": 1,
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

    // NEW: Outcome-based navigation
    const [flowPathHistory, setFlowPathHistory] = useState([]);
    const [selectedOutcome, setSelectedOutcome] = useState(null);

    // NEW: Phase 3 - State tracking
    const [flowState, setFlowState] = useState({});
    const [stateHistory, setStateHistory] = useState([]);

    // NEW: Infrastructure view enhancements
    const [infraDetailTab, setInfraDetailTab] = useState("overview");
    const [filterLayer, setFilterLayer] = useState("all");

    // PHASE 4: Search, Export, Layout Options
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [recentSearches, setRecentSearches] = useState([]);
    const [showHelpOverlay, setShowHelpOverlay] = useState(false);
    const [layoutAlgorithm, setLayoutAlgorithm] = useState("dagre"); // dagre, hierarchical, circular
    const [layoutOrientation, setLayoutOrientation] = useState("LR"); // LR, TB, RL, BT


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
            } catch {
                // Ignore errors
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
        setFlowPathHistory([]);
        setSelectedOutcome(null);
        
        // Initialize flow state from selected flow
        const flow = API_FLOWS.find((f) => f.id === selectedFlowId);
        if (flow && flow.initialState) {
            setFlowState(flow.initialState);
            setStateHistory([{
                stepId: "initial",
                stepTitle: "Flow Start",
                state: flow.initialState,
                timestamp: new Date().toISOString()
            }]);
        } else {
            setFlowState({});
            setStateHistory([]);
        }
    }, [selectedFlowId, viewMode]);

    const getFlowSteps = (flow) => {
        if (!flow) return [];
        if (Array.isArray(flow.steps) && flow.steps.length) return flow.steps;

        // fallback to old format (edges only)
        const edges = Array.isArray(flow.edges) ? flow.edges : [];
        return edges.map((edgeId) => ({edgeId}));
    };

    /* ------------------------------------------
       OUTCOME-BASED NAVIGATION HELPERS
    ------------------------------------------- */
    // Handle outcome selection
    const handleOutcomeSelection = useCallback((outcome) => {
        const flow = API_FLOWS.find((f) => f.id === selectedFlowId);
        if (!flow) return;

        const steps = getFlowSteps(flow);
        const currentStep = steps[currentStepIndex];
        
        // Apply state changes from outcome
        let newState = {...flowState};
        if (outcome.stateChanges) {
            newState = {...newState, ...outcome.stateChanges};
            setFlowState(newState);
        }
        
        // Record this choice in history
        setFlowPathHistory(prev => [
            ...prev,
            {
                stepId: currentStep.id,
                stepTitle: currentStep.title,
                outcomeId: outcome.id,
                outcomeLabel: outcome.label,
                outcomeType: outcome.type,
                timestamp: new Date().toISOString()
            }
        ]);

        // Record state changes in state history
        if (outcome.stateChanges) {
            setStateHistory(prev => [
                ...prev,
                {
                    stepId: currentStep.id,
                    stepTitle: currentStep.title,
                    outcomeLabel: outcome.label,
                    state: newState,
                    changes: outcome.stateChanges,
                    timestamp: new Date().toISOString()
                }
            ]);
        }

        setSelectedOutcome(outcome);

        // Navigate to next step based on outcome
        if (outcome.nextStepId) {
            // Find the next step in the steps array
            const nextStepIndex = steps.findIndex(s => s.id === outcome.nextStepId);
            if (nextStepIndex !== -1) {
                setCurrentStepIndex(nextStepIndex);
            }
        }
    }, [selectedFlowId, currentStepIndex, flowState]);

    // Reset flow to beginning
    const resetFlow = useCallback(() => {
        setCurrentStepIndex(0);
        setFlowPathHistory([]);
        setSelectedOutcome(null);
        
        // Reset state to initial
        const flow = API_FLOWS.find((f) => f.id === selectedFlowId);
        if (flow && flow.initialState) {
            setFlowState(flow.initialState);
            setStateHistory([{
                stepId: "initial",
                stepTitle: "Flow Start",
                state: flow.initialState,
                timestamp: new Date().toISOString()
            }]);
        } else {
            setFlowState({});
            setStateHistory([]);
        }
    }, [selectedFlowId]);


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

    /* ------------------------------------------
       APPLY LAYER FILTERS (Infrastructure mode)
    ------------------------------------------- */
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;

        // Only apply in infrastructure mode
        if (viewMode !== "infra") {
            cy.nodes().removeClass("filtered-out");
            cy.edges().removeClass("filtered-out");
            return;
        }

        // Remove existing classes
        cy.nodes().removeClass("filtered-out");
        cy.edges().removeClass("filtered-out");

        // Apply layer filter
        if (filterLayer !== "all") {
            cy.nodes().forEach(node => {
                if (node.data("layer") !== filterLayer) {
                    node.addClass("filtered-out");
                }
            });

            // Filter edges connected to filtered nodes
            cy.edges().forEach(edge => {
                const source = edge.source();
                const target = edge.target();
                if (source.hasClass("filtered-out") || target.hasClass("filtered-out")) {
                    edge.addClass("filtered-out");
                }
            });
        }

    }, [viewMode, filterLayer]);

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

    /* ------------------------------------------
       PHASE 4: SEARCH FUNCTIONALITY
    ------------------------------------------- */
    const handleSearch = useCallback((query) => {
        if (!cyRef.current || !query.trim()) {
            setSearchResults([]);
            cyRef.current?.nodes().removeClass("search-highlight");
            return;
        }

        const lowerQuery = query.toLowerCase();
        const allNodes = cyRef.current.nodes();
        
        // Fuzzy search: match node label, id, or repo
        const matches = allNodes.filter((node) => {
            const label = (node.data("label") || "").toLowerCase();
            const id = (node.data("id") || "").toLowerCase();
            const repo = (node.data("repo") || "").toLowerCase();
            return label.includes(lowerQuery) || id.includes(lowerQuery) || repo.includes(lowerQuery);
        });

        const results = matches.map((node) => ({
            id: node.data("id"),
            label: node.data("label"),
            type: node.data("type")
        }));

        setSearchResults(results);

        // Highlight search results
        allNodes.removeClass("search-highlight");
        matches.addClass("search-highlight");

        // Center on first result
        if (matches.length > 0) {
            cyRef.current.animate({
                fit: {
                    eles: matches,
                    padding: 50
                },
                duration: 500
            });
        }

        // Add to recent searches (max 5)
        if (query.trim() && !recentSearches.includes(query)) {
            const updated = [query, ...recentSearches].slice(0, 5);
            setRecentSearches(updated);
            localStorage.setItem("arch-recent-searches", JSON.stringify(updated));
        }
    }, [recentSearches]);

    const handleSearchNodeClick = useCallback((nodeId) => {
        if (!cyRef.current) return;
        const node = cyRef.current.$(`#${nodeId}`);
        if (node.length > 0) {
            node.select();
            cyRef.current.animate({
                fit: {
                    eles: node,
                    padding: 100
                },
                duration: 500
            });
        }
    }, []);

    /* ------------------------------------------
       PHASE 4: EXPORT FUNCTIONALITY
    ------------------------------------------- */
    const exportGraphAsPNG = useCallback(() => {
        if (!cyRef.current) return;
        const png = cyRef.current.png({
            full: true,
            scale: 2,
            bg: "#ffffff"
        });
        const link = document.createElement("a");
        link.download = `architecture-${new Date().toISOString().split('T')[0]}.png`;
        link.href = png;
        link.click();
    }, []);

    const exportGraphAsSVG = useCallback(() => {
        if (!cyRef.current) return;
        // High quality PNG export (Cytoscape doesn't have native SVG)
        const png = cyRef.current.png({
            full: true,
            scale: 4,
            bg: "#ffffff"
        });
        const link = document.createElement("a");
        link.download = `architecture-${new Date().toISOString().split('T')[0]}-hq.png`;
        link.href = png;
        link.click();
    }, []);

    const exportFlowAsMarkdown = useCallback(() => {
        if (viewMode !== "api" || !selectedFlowId) return;
        
        const flow = API_FLOWS.find((f) => f.id === selectedFlowId);
        if (!flow) return;

        let markdown = `# ${flow.label}\n\n`;
        markdown += `**Flow ID:** ${flow.id}\n\n`;
        if (flow.description) {
            markdown += `${flow.description}\n\n`;
        }

        markdown += `## Flow Path History\n\n`;
        if (flowPathHistory.length === 0) {
            markdown += `_No steps taken yet_\n\n`;
        } else {
            flowPathHistory.forEach((item, idx) => {
                markdown += `### Step ${idx + 1}: ${item.stepTitle}\n\n`;
                markdown += `**Outcome:** ${item.outcomeLabel}\n\n`;
                if (item.outcomeDescription) {
                    markdown += `${item.outcomeDescription}\n\n`;
                }
                if (item.request) {
                    markdown += `**Request:**\n\`\`\`json\n${JSON.stringify(item.request, null, 2)}\n\`\`\`\n\n`;
                }
                if (item.response) {
                    markdown += `**Response:**\n\`\`\`json\n${JSON.stringify(item.response, null, 2)}\n\`\`\`\n\n`;
                }
            });
        }

        const blob = new Blob([markdown], { type: "text/markdown" });
        const link = document.createElement("a");
        link.download = `${flow.id}-flow-${new Date().toISOString().split('T')[0]}.md`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }, [viewMode, selectedFlowId, flowPathHistory]);

    const exportStateAsJSON = useCallback(() => {
        const exportData = {
            timestamp: new Date().toISOString(),
            viewMode,
            selectedFlowId,
            currentStepIndex,
            flowPathHistory,
            flowState,
            stateHistory,
            searchQuery,
            filterLayer,
            layoutAlgorithm,
            layoutOrientation
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.download = `app-state-${new Date().toISOString()}.json`;
        link.href = URL.createObjectURL(blob);
        link.click();
    }, [viewMode, selectedFlowId, currentStepIndex, flowPathHistory, flowState, stateHistory, searchQuery, filterLayer, layoutAlgorithm, layoutOrientation]);

    /* ------------------------------------------
       PHASE 4: KEYBOARD SHORTCUTS
    ------------------------------------------- */
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if typing in input/textarea/select
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") {
                return;
            }

            switch (e.key.toLowerCase()) {
                case "f":
                    if (cyRef.current) {
                        cyRef.current.fit(null, 50);
                    }
                    e.preventDefault();
                    break;
                case "/":
                    document.getElementById("global-search-input")?.focus();
                    e.preventDefault();
                    break;
                case "escape":
                    if (cyRef.current) {
                        cyRef.current.elements().unselect();
                        cyRef.current.nodes().removeClass("search-highlight");
                    }
                    setSearchQuery("");
                    setSearchResults([]);
                    setSelectedNode(null);
                    e.preventDefault();
                    break;
                case "?":
                    setShowHelpOverlay((prev) => !prev);
                    e.preventDefault();
                    break;
                case "r":
                    if (cyRef.current) {
                        runLayout(cyRef.current);
                    }
                    e.preventDefault();
                    break;
                default:
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [runLayout]);

    /* ------------------------------------------
       PHASE 4: LAYOUT OPTIONS
    ------------------------------------------- */
    const applyLayout = useCallback((algorithm, orientation) => {
        if (!cyRef.current) return;

        let layoutOptions = {};

        switch (algorithm) {
            case "dagre":
                layoutOptions = {
                    name: "dagre",
                    rankDir: orientation,
                    nodeSep: 80,
                    rankSep: 120,
                    edgeSep: 40,
                    spacingFactor: 1.2,
                    ranker: "network-simplex",
                    fit: true,
                    padding: 50
                };
                break;
            case "hierarchical":
                layoutOptions = {
                    name: "breadthfirst",
                    directed: true,
                    spacingFactor: 1.5,
                    fit: true,
                    padding: 50
                };
                break;
            case "circular":
                layoutOptions = {
                    name: "circle",
                    fit: true,
                    padding: 50,
                    spacingFactor: 1.2
                };
                break;
            default:
                layoutOptions = {
                    name: "dagre",
                    rankDir: "LR",
                    fit: true,
                    padding: 50
                };
        }

        const layout = cyRef.current.layout(layoutOptions);
        layout.run();

        // Save preferences
        localStorage.setItem("arch-layout-algorithm", algorithm);
        localStorage.setItem("arch-layout-orientation", orientation);
    }, []);

    useEffect(() => {
        if (cyRef.current && layoutApplied.current) {
            applyLayout(layoutAlgorithm, layoutOrientation);
        }
    }, [layoutAlgorithm, layoutOrientation, applyLayout]);

    /* ------------------------------------------
       PHASE 4: LOAD SAVED PREFERENCES
    ------------------------------------------- */
    useEffect(() => {
        // Load recent searches
        const savedSearches = localStorage.getItem("arch-recent-searches");
        if (savedSearches) {
            try {
                setRecentSearches(JSON.parse(savedSearches));
            } catch (e) {
                console.error("Failed to load recent searches", e);
            }
        }

        // Load layout preferences
        const savedAlgorithm = localStorage.getItem("arch-layout-algorithm");
        const savedOrientation = localStorage.getItem("arch-layout-orientation");
        if (savedAlgorithm) setLayoutAlgorithm(savedAlgorithm);
        if (savedOrientation) setLayoutOrientation(savedOrientation);
    }, []);

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

                {/* PHASE 4: Search Bar */}
                <div style={{
                    marginBottom: 12,
                    padding: 10,
                    background: "#f3f4f6",
                    borderRadius: 6,
                    border: "1px solid #d1d5db"
                }}>
                    <div style={{display: "flex", gap: 8, alignItems: "center", marginBottom: 8}}>
                        <input
                            id="global-search-input"
                            type="text"
                            placeholder="🔍 Search nodes... (press / to focus)"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                handleSearch(e.target.value);
                            }}
                            style={{
                                flex: 1,
                                padding: "6px 10px",
                                borderRadius: 4,
                                border: "1px solid #d1d5db",
                                fontSize: 13
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    setSearchResults([]);
                                    cyRef.current?.nodes().removeClass("search-highlight");
                                }}
                                style={{
                                    padding: "6px 10px",
                                    background: "#ef4444",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    fontSize: 12
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    {searchResults.length > 0 && (
                        <div style={{fontSize: 11, color: "#6b7280", marginBottom: 6}}>
                            Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                        </div>
                    )}
                    {searchResults.length > 0 && (
                        <div style={{display: "flex", flexWrap: "wrap", gap: 6}}>
                            {searchResults.map((result) => (
                                <button
                                    key={result.id}
                                    onClick={() => handleSearchNodeClick(result.id)}
                                    style={{
                                        padding: "4px 8px",
                                        background: "#8b5cf6",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        fontSize: 11
                                    }}
                                >
                                    {result.label}
                                </button>
                            ))}
                        </div>
                    )}
                    {recentSearches.length > 0 && !searchQuery && (
                        <div style={{marginTop: 8}}>
                            <div style={{fontSize: 11, color: "#9ca3af", marginBottom: 4}}>Recent:</div>
                            <div style={{display: "flex", flexWrap: "wrap", gap: 4}}>
                                {recentSearches.map((term, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setSearchQuery(term);
                                            handleSearch(term);
                                        }}
                                        style={{
                                            padding: "3px 6px",
                                            background: "#e5e7eb",
                                            color: "#374151",
                                            border: "1px solid #d1d5db",
                                            borderRadius: 3,
                                            cursor: "pointer",
                                            fontSize: 10
                                        }}
                                    >
                                        {term}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* PHASE 4: Export & Layout Controls */}
                <div style={{
                    marginBottom: 12,
                    padding: 10,
                    background: "#fef3c7",
                    borderRadius: 6,
                    border: "1px solid #fcd34d"
                }}>
                    <div style={{fontSize: 12, fontWeight: 600, marginBottom: 8, color: "#92400e"}}>
                        ⚙️ Tools & Layout
                    </div>
                    <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                        {/* Export buttons */}
                        <div>
                            <div style={{fontSize: 11, color: "#78350f", marginBottom: 4}}>Export:</div>
                            <div style={{display: "flex", gap: 6, flexWrap: "wrap"}}>
                                <button
                                    onClick={exportGraphAsPNG}
                                    style={{
                                        padding: "4px 8px",
                                        background: "#10b981",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        fontSize: 11
                                    }}
                                >
                                    📸 PNG
                                </button>
                                <button
                                    onClick={exportGraphAsSVG}
                                    style={{
                                        padding: "4px 8px",
                                        background: "#10b981",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        fontSize: 11
                                    }}
                                >
                                    🖼️ HQ PNG
                                </button>
                                {viewMode === "api" && (
                                    <button
                                        onClick={exportFlowAsMarkdown}
                                        style={{
                                            padding: "4px 8px",
                                            background: "#3b82f6",
                                            color: "#fff",
                                            border: "none",
                                            borderRadius: 4,
                                            cursor: "pointer",
                                            fontSize: 11
                                        }}
                                    >
                                        📝 Flow MD
                                    </button>
                                )}
                                <button
                                    onClick={exportStateAsJSON}
                                    style={{
                                        padding: "4px 8px",
                                        background: "#f59e0b",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        fontSize: 11
                                    }}
                                >
                                    💾 State JSON
                                </button>
                            </div>
                        </div>

                        {/* Layout algorithm */}
                        <div>
                            <div style={{fontSize: 11, color: "#78350f", marginBottom: 4}}>Layout Algorithm:</div>
                            <select
                                value={layoutAlgorithm}
                                onChange={(e) => setLayoutAlgorithm(e.target.value)}
                                style={{
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    border: "1px solid #d1d5db",
                                    fontSize: 12,
                                    width: "100%"
                                }}
                            >
                                <option value="dagre">Dagre (Hierarchical)</option>
                                <option value="hierarchical">Hierarchical (Breadthfirst)</option>
                                <option value="circular">Circular</option>
                            </select>
                        </div>

                        {/* Layout orientation (only for dagre) */}
                        {layoutAlgorithm === "dagre" && (
                            <div>
                                <div style={{fontSize: 11, color: "#78350f", marginBottom: 4}}>Orientation:</div>
                                <div style={{display: "flex", gap: 6}}>
                                    {["LR", "TB", "RL", "BT"].map((dir) => (
                                        <button
                                            key={dir}
                                            onClick={() => setLayoutOrientation(dir)}
                                            style={{
                                                padding: "4px 8px",
                                                background: layoutOrientation === dir ? "#92400e" : "#fef3c7",
                                                color: layoutOrientation === dir ? "#fff" : "#92400e",
                                                border: "1px solid #d97706",
                                                borderRadius: 4,
                                                cursor: "pointer",
                                                fontSize: 11,
                                                flex: 1
                                            }}
                                        >
                                            {dir}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Keyboard shortcuts hint */}
                        <div style={{fontSize: 10, color: "#78350f", marginTop: 4, padding: 6, background: "#fef9c3", borderRadius: 4}}>
                            Press <strong>?</strong> for keyboard shortcuts
                        </div>
                    </div>
                </div>

                {/* Infrastructure view layer filter */}
                {viewMode === "infra" && (
                    <div style={{
                        marginBottom: 12,
                        padding: 10,
                        background: "#f9fafb",
                        borderRadius: 6,
                        border: "1px solid #e5e7eb"
                    }}>
                        <div style={{display: "flex", gap: 12, fontSize: 12, alignItems: "center"}}>
                            <div>
                                <label style={{marginRight: 6, fontWeight: 600}}>Layer:</label>
                                <select
                                    value={filterLayer}
                                    onChange={(e) => setFilterLayer(e.target.value)}
                                    style={{
                                        padding: "4px 8px",
                                        borderRadius: 4,
                                        border: "1px solid #d1d5db",
                                        fontSize: 12
                                    }}
                                >
                                    <option value="all">All Layers</option>
                                    <option value="presentation">Presentation</option>
                                    <option value="application">Application</option>
                                    <option value="data">Data</option>
                                    <option value="cron-job">Cron-Job</option>
                                    <option value="external">External</option>
                                </select>
                            </div>

                            {filterLayer !== "all" && (
                                <button
                                    onClick={() => setFilterLayer("all")}
                                    style={{
                                        padding: "4px 8px",
                                        background: "#fee2e2",
                                        color: "#991b1b",
                                        border: "1px solid #fca5a5",
                                        borderRadius: 4,
                                        cursor: "pointer",
                                        fontSize: 11,
                                        fontWeight: 600
                                    }}
                                >
                                    Clear Filter
                                </button>
                            )}
                        </div>
                    </div>
                )}

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
                        {flowPathHistory.length > 0 && (
                            <button
                                onClick={resetFlow}
                                style={{
                                    marginLeft: 8,
                                    padding: "4px 8px",
                                    background: "#dc2626",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 4,
                                    cursor: "pointer",
                                    fontSize: 12
                                }}
                            >
                                ↻ Reset Flow
                            </button>
                        )}
                    </div>
                )}

                {/* Flow Path Breadcrumb */}
                {viewMode === "api" && flowPathHistory.length > 0 && (
                    <div style={{
                        marginBottom: 12,
                        padding: 10,
                        background: "#f0fdf4",
                        border: "1px solid #86efac",
                        borderRadius: 6
                    }}>
                        <div style={{fontWeight: 600, marginBottom: 6, fontSize: 12}}>Flow Path History:</div>
                        <div style={{fontSize: 11, color: "#374151", lineHeight: "1.6"}}>
                            {flowPathHistory.map((item, idx) => (
                                <div key={idx} style={{marginBottom: 4}}>
                                    <span style={{fontWeight: 600}}>{idx + 1}.</span> {item.stepTitle}
                                    <br />
                                    <span style={{
                                        marginLeft: 16,
                                        padding: "2px 6px",
                                        borderRadius: 3,
                                        background: item.outcomeType === "happy" ? "#dcfce7" : 
                                                   item.outcomeType === "unhappy" ? "#fee2e2" :
                                                   item.outcomeType === "recovery" ? "#fef3c7" : "#f3f4f6",
                                        fontSize: 10
                                    }}>
                                        {item.outcomeLabel}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Step-by-step controls (only in API mode, when flow loaded) */}
                {viewMode === "api" && activeFlow && activeFlow.edges && activeSteps.length > 0 && (
                    <div style={{marginBottom: 12}}>

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
                        <div style={{display: "flex", alignItems: "center", gap: 8, marginBottom: 8}}>
                            <h3 style={{margin: 0}}>Step Details</h3>
                            {/* Phase 3: Step Type Badges */}
                            {currentStep.type && (
                                <span style={{
                                    padding: "2px 8px",
                                    borderRadius: 12,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    background: currentStep.type === "conditional" ? "#fef3c7" :
                                               currentStep.type === "retry" ? "#fee2e2" :
                                               currentStep.isWaitState ? "#fef3c7" : "#f3f4f6",
                                    color: currentStep.type === "conditional" ? "#92400e" :
                                           currentStep.type === "retry" ? "#991b1b" :
                                           currentStep.isWaitState ? "#92400e" : "#6b7280"
                                }}>
                                    {currentStep.type === "conditional" ? "🔀 Conditional" :
                                     currentStep.type === "retry" ? "↻ Retry" :
                                     currentStep.isWaitState ? "⏸ Wait State" : "Standard"}
                                </span>
                            )}
                        </div>
                        <div style={{fontSize: 13, color: "#111827", marginBottom: 10, fontWeight: 500}}>
                            {currentStep.title || `Edge: ${currentStep.edgeId}`}
                        </div>
                        {currentStep.description && (
                            <div style={{fontSize: 12, color: "#6b7280", marginBottom: 12, fontStyle: "italic"}}>
                                {currentStep.description}
                            </div>
                        )}

                        {/* Phase 3: Conditional Logic Display */}
                        {currentStep.condition && (
                            <div style={{
                                padding: 8,
                                background: "#fef9c3",
                                border: "1px solid #fde047",
                                borderRadius: 4,
                                marginBottom: 12,
                                fontSize: 11
                            }}>
                                <strong>Condition:</strong> <code style={{fontFamily: "monospace"}}>{currentStep.condition}</code>
                            </div>
                        )}


                        {/* Phase 3: Retry Policy Display */}
                        {currentStep.retryPolicy && currentStep.retryPolicy.enabled && (
                            <div style={{
                                padding: 8,
                                background: "#fef2f2",
                                border: "1px solid #fca5a5",
                                borderRadius: 4,
                                marginBottom: 12,
                                fontSize: 11
                            }}>
                                <div style={{fontWeight: 600, marginBottom: 4}}>↻ Retry Policy:</div>
                                <div>Max attempts: {currentStep.retryPolicy.maxAttempts}</div>
                                <div>Backoff: {currentStep.retryPolicy.backoffMs?.join("ms, ")}ms</div>
                                {currentStep.retryPolicy.retryOn && (
                                    <div>Retry on: {currentStep.retryPolicy.retryOn.join(", ")}</div>
                                )}
                            </div>
                        )}

                        {/* Outcome Selector - NEW */}
                        {Array.isArray(currentStep.outcomes) && currentStep.outcomes.length > 0 && (
                            <div style={{marginBottom: 12}}>
                                <div style={{fontWeight: 600, marginBottom: 8, fontSize: 13}}>Choose Outcome:</div>
                                <div style={{display: "flex", flexDirection: "column", gap: 8}}>
                                    {currentStep.outcomes.map((outcome) => (
                                        <button
                                            key={outcome.id}
                                            onClick={() => handleOutcomeSelection(outcome)}
                                            disabled={outcome.nextStepId === null && outcome.type === "terminal"}
                                            style={{
                                                padding: "10px 12px",
                                                background: outcome.type === "happy" ? "#dcfce7" : 
                                                           outcome.type === "unhappy" ? "#fee2e2" :
                                                           outcome.type === "recovery" ? "#fef3c7" : "#f3f4f6",
                                                border: `2px solid ${outcome.type === "happy" ? "#16a34a" : 
                                                                      outcome.type === "unhappy" ? "#dc2626" :
                                                                      outcome.type === "recovery" ? "#ca8a04" : "#9ca3af"}`,
                                                borderRadius: 6,
                                                cursor: outcome.nextStepId === null && outcome.type === "terminal" ? "not-allowed" : "pointer",
                                                textAlign: "left",
                                                opacity: outcome.nextStepId === null && outcome.type === "terminal" ? 0.7 : 1
                                            }}
                                        >
                                            <div style={{fontWeight: 600, fontSize: 13, marginBottom: 4}}>{outcome.label}</div>
                                            {outcome.description && (
                                                <div style={{fontSize: 11, color: "#6b7280"}}>
                                                    {outcome.description}
                                                </div>
                                            )}
                                            {outcome.nextStepId === null && (
                                                <div style={{fontSize: 10, color: "#9ca3af", marginTop: 4, fontStyle: "italic"}}>
                                                    {outcome.type === "terminal" ? "Flow ends here" : "No next step defined"}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Legacy unhappy paths display (for old format) */}
                        {Array.isArray(currentStep.unhappy) && currentStep.unhappy.length > 0 && !currentStep.outcomes && (
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

                        {!currentStep.outcomes && (
                            <label style={{display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12}}>
                                <input type="checkbox" checked={showUnhappy}
                                       onChange={(e) => setShowUnhappy(e.target.checked)}/>
                                Show unhappy paths
                            </label>
                        )}

                        {/* Request/Response Display */}
                        {selectedOutcome && (
                            <div style={{marginTop: 12, padding: 10, background: "#fafaf9", borderRadius: 6, border: "1px solid #e7e5e4"}}>
                                <div style={{fontWeight: 600, marginBottom: 8, fontSize: 12}}>Selected Outcome Details:</div>
                                {selectedOutcome.request && (
                                    <div style={{marginBottom: 8}}>
                                        <div style={{fontWeight: 600, fontSize: 11, color: "#0ea5e9", marginBottom: 4}}>REQUEST:</div>
                                        <JsonView data={selectedOutcome.request} style={{fontSize: 10}} />
                                    </div>
                                )}
                                {selectedOutcome.response && (
                                    <div>
                                        <div style={{fontWeight: 600, fontSize: 11, color: "#8b5cf6", marginBottom: 4}}>RESPONSE:</div>
                                        <JsonView data={selectedOutcome.response} style={{fontSize: 10}} />
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{marginTop: 10}}>
                            <JsonView data={currentStep.nodeSchemas || {}}/>
                        </div>
                    </div>
                )}

                {/* Phase 3: State Tracking Visualization */}
                {viewMode === "api" && activeFlow && activeFlow.initialState && Object.keys(flowState).length > 0 && (
                    <div style={{
                        marginTop: 12,
                        marginBottom: 12,
                        padding: 10,
                        background: "#f0f9ff",
                        border: "1px solid #bae6fd",
                        borderRadius: 6
                    }}>
                        <div style={{fontWeight: 600, marginBottom: 8, fontSize: 13, color: "#0369a1"}}>📦 Current Flow State</div>
                        <JsonView data={flowState} style={{fontSize: 11}} />
                        
                        {stateHistory.length > 1 && (
                            <details style={{marginTop: 12}}>
                                <summary style={{cursor: "pointer", fontWeight: 600, fontSize: 12, color: "#0369a1"}}>
                                    State History ({stateHistory.length - 1} changes)
                                </summary>
                                <div style={{marginTop: 8, maxHeight: 200, overflowY: "auto"}}>
                                    {stateHistory.slice(1).map((entry, idx) => (
                                        <div key={idx} style={{
                                            padding: 6,
                                            marginBottom: 6,
                                            background: "#fff",
                                            border: "1px solid #e0e7ff",
                                            borderRadius: 4,
                                            fontSize: 10
                                        }}>
                                            <div style={{fontWeight: 600, marginBottom: 2}}>
                                                {idx + 1}. {entry.stepTitle}
                                            </div>
                                            <div style={{color: "#6b7280", marginBottom: 2}}>
                                                {entry.outcomeLabel}
                                            </div>
                                            <div style={{color: "#059669", fontWeight: 600}}>Changes:</div>
                                            <JsonView data={entry.changes} style={{fontSize: 10}} />
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                )}


                {/* Node details - Enhanced Infrastructure View */}
                {selectedNode ? (
                    <div style={{marginTop: 16}}>
                        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12}}>
                            <h2 style={{margin: 0}}>Node: {selectedNode.label}</h2>
                        </div>

                        {/* Tab Navigation */}
                        <div style={{display: "flex", gap: 4, marginBottom: 12, borderBottom: "2px solid #e5e7eb"}}>
                            {["overview", "api", "dependencies"].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setInfraDetailTab(tab)}
                                    style={{
                                        padding: "8px 16px",
                                        border: "none",
                                        background: "none",
                                        borderBottom: infraDetailTab === tab ? "2px solid #0f766e" : "none",
                                        marginBottom: "-2px",
                                        cursor: "pointer",
                                        fontWeight: infraDetailTab === tab ? 600 : 400,
                                        color: infraDetailTab === tab ? "#0f766e" : "#6b7280",
                                        fontSize: 13,
                                        textTransform: "capitalize"
                                    }}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div style={{fontSize: 12}}>
                            {/* Overview Tab */}
                            {infraDetailTab === "overview" && (
                                <div>
                                    {selectedNode.repo && (
                                        <div style={{marginBottom: 12}}>
                                            <strong>Repository:</strong> {selectedNode.repo}
                                        </div>
                                    )}
                                    {selectedNode.layer && (
                                        <div style={{marginBottom: 12}}>
                                            <strong>Layer:</strong> <span style={{
                                                padding: "2px 6px",
                                                background: "#f3f4f6",
                                                borderRadius: 3,
                                                fontSize: 11
                                            }}>{selectedNode.layer}</span>
                                            {selectedNode.tier && <span> / {selectedNode.tier}</span>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* API Tab */}
                            {infraDetailTab === "api" && selectedNode.api && (
                                <div>
                                    <div style={{marginBottom: 12}}>
                                        <strong>Base URL:</strong> {selectedNode.api.baseUrl}
                                    </div>
                                    {selectedNode.api.version && (
                                        <div style={{marginBottom: 12}}>
                                            <strong>Version:</strong> {selectedNode.api.version}
                                        </div>
                                    )}
                                    {selectedNode.api.endpoints && (
                                        <div>
                                            <strong style={{display: "block", marginBottom: 8}}>Endpoints:</strong>
                                            {selectedNode.api.endpoints.map((endpoint, idx) => (
                                                <div key={idx} style={{
                                                    padding: 8,
                                                    marginBottom: 6,
                                                    background: "#f9fafb",
                                                    borderRadius: 4,
                                                    border: "1px solid #e5e7eb"
                                                }}>
                                                    <div style={{fontWeight: 600, fontFamily: "monospace", fontSize: 11}}>
                                                        <span style={{
                                                            padding: "2px 6px",
                                                            background: endpoint.method === "GET" ? "#dbeafe" : 
                                                                       endpoint.method === "POST" ? "#dcfce7" : "#fef3c7",
                                                            borderRadius: 3,
                                                            marginRight: 6
                                                        }}>{endpoint.method}</span>
                                                        {endpoint.path}
                                                    </div>
                                                    {endpoint.description && (
                                                        <div style={{fontSize: 10, color: "#6b7280", marginTop: 4}}>
                                                            {endpoint.description}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Dependencies Tab */}
                            {infraDetailTab === "dependencies" && selectedNode.dependencies && (
                                <div>
                                    {selectedNode.dependencies.internal && selectedNode.dependencies.internal.length > 0 && (
                                        <div style={{marginBottom: 16}}>
                                            <strong style={{display: "block", marginBottom: 6, color: "#0f766e"}}>Internal Services</strong>
                                            <div style={{display: "flex", flexWrap: "wrap", gap: 6}}>
                                                {selectedNode.dependencies.internal.map(dep => (
                                                    <span key={dep} style={{
                                                        padding: "4px 8px",
                                                        background: "#dbeafe",
                                                        borderRadius: 4,
                                                        fontSize: 11
                                                    }}>{dep}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedNode.dependencies.external && selectedNode.dependencies.external.length > 0 && (
                                        <div style={{marginBottom: 16}}>
                                            <strong style={{display: "block", marginBottom: 6, color: "#0f766e"}}>External Services</strong>
                                            <div style={{display: "flex", flexWrap: "wrap", gap: 6}}>
                                                {selectedNode.dependencies.external.map(dep => (
                                                    <span key={dep} style={{
                                                        padding: "4px 8px",
                                                        background: "#fef3c7",
                                                        borderRadius: 4,
                                                        fontSize: 11
                                                    }}>{dep}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedNode.dependencies.databases && selectedNode.dependencies.databases.length > 0 && (
                                        <div style={{marginBottom: 16}}>
                                            <strong style={{display: "block", marginBottom: 6, color: "#0f766e"}}>Databases</strong>
                                            <div style={{display: "flex", flexWrap: "wrap", gap: 6}}>
                                                {selectedNode.dependencies.databases.map(dep => (
                                                    <span key={dep} style={{
                                                        padding: "4px 8px",
                                                        background: "#e0e7ff",
                                                        borderRadius: 4,
                                                        fontSize: 11
                                                    }}>{dep}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                ) : (
                    <div style={{marginTop: 16, color: "#6b7280"}}>Select a node to inspect its details.</div>
                )}
            </div>

            {/* Keyboard Shortcuts Help Overlay */}
            {showHelpOverlay && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0, 0, 0, 0.75)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000
                    }}
                    onClick={() => setShowHelpOverlay(false)}
                >
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: 12,
                            padding: 24,
                            maxWidth: 500,
                            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20}}>
                            <h2 style={{margin: 0, fontSize: 20}}>⌨️ Keyboard Shortcuts</h2>
                            <button
                                onClick={() => setShowHelpOverlay(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    fontSize: 24,
                                    cursor: "pointer",
                                    color: "#6b7280",
                                    padding: 0,
                                    lineHeight: 1
                                }}
                            >
                                ×
                            </button>
                        </div>
                        <div style={{display: "flex", flexDirection: "column", gap: 12}}>
                            {[
                                {key: "F", desc: "Fit graph to screen"},
                                {key: "/", desc: "Focus search input"},
                                {key: "ESC", desc: "Clear selection and search"},
                                {key: "R", desc: "Refresh layout"},
                                {key: "?", desc: "Show/hide this help"}
                            ].map(({key, desc}) => (
                                <div
                                    key={key}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: 12,
                                        background: "#f9fafb",
                                        borderRadius: 6,
                                        border: "1px solid #e5e7eb"
                                    }}
                                >
                                    <span style={{fontSize: 14, color: "#374151"}}>{desc}</span>
                                    <kbd style={{
                                        padding: "4px 10px",
                                        background: "#fff",
                                        border: "1px solid #d1d5db",
                                        borderRadius: 4,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        fontFamily: "monospace",
                                        color: "#111827",
                                        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                                    }}>{key}</kbd>
                                </div>
                            ))}
                        </div>
                        <div style={{
                            marginTop: 20,
                            padding: 12,
                            background: "#f0fdfa",
                            border: "1px solid #5eead4",
                            borderRadius: 6,
                            fontSize: 12,
                            color: "#134e4a"
                        }}>
                            <strong>💡 Tip:</strong> All shortcuts work from anywhere in the app (except when typing in inputs)
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
