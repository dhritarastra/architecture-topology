import {useState, useRef, useEffect, useMemo} from "react";
import CytoscapeComponent from "react-cytoscapejs";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";

import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import "./App.css"
// auto-import all node JSONs in src/services/nodes
const nodeModules = import.meta.glob("./services/nodes/*.json", { eager: true });
// auto-import all edge JSONs in src/services/edges
const edgeModules = import.meta.glob("./services/edges/*.json", { eager: true });

cytoscape.use(dagre);

// ----- stylesheet: arrows + non-overlapping edges -----
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
            shape: "round-rectangle",   // 👈 all non-DB nodes become rounded rectangles
        },
    },
    // 👇 DB only override
    {
        selector: "node[type = 'rds']",
        style: {
            shape: "ellipse",           // 👈 circle
            width: 70,
            height: 70,
            "background-opacity": 0,
            "background-image": "url(/aws-icons/RDS.svg)",
            "background-fit": "cover",
        },
    },
    // AWS ECS
    {
        selector: "node[type = 'ecs']",
        style: {
            "background-opacity": 0,
            "background-image": "url(/aws-icons/ECS.svg)",
            "background-fit": "cover",
        }
    },
    // Amazon SQS
    {
        selector: "node[type = 'sqs']",
        style: {
            "background-opacity": 0,
            "background-image": "url(/aws-icons/SQS.svg)",
            "background-fit": "cover",
        }
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

            // base label styling
            label: "data(label)",
            "font-size": 12,
            color: "#111827",
            "text-rotation": "autorotate",

            // pill background so text is readable
            "text-background-color": "#f9fafb",
            "text-background-opacity": 1,
            "text-background-shape": "round-rectangle",
            "text-background-padding": 3,
        },
    },
    // LPS → DB (writes) – bend up, label just above & centered-ish
    {
        selector: "edge[dir = 'forward']",
        style: {
            "control-point-weight": 1,
            "line-color": "#3b82f6",
            "target-arrow-color": "#3b82f6",
            "text-margin-y": -10, // above the edge
            "text-margin-x": -12, // shift a bit left towards center
        },
    },
    // DB → LPS (reads) – bend down, label just below & centered-ish
    {
        selector: "edge[dir = 'backward']",
        style: {
            "control-point-weight": 0,
            "line-color": "#10b981",
            "target-arrow-color": "#10b981",
            "text-margin-y": 10,  // below the edge
            "text-margin-x": -12, // same x-shift so both align vertically
        },
    },
];

// Animate edges with a "flowing" dashed effect
function startEdgeDashAnimation(cy) {
    // set dashed style once
    cy.edges().forEach((edge) => {
        edge.style("line-style", "dashed");
        edge.style("line-dash-pattern", [10, 8]); // dash length / gap
    });

    let offset = 0;

    // simple animation loop
    setInterval(() => {
        offset = (offset + 1) % 30;

        cy.edges().forEach((edge) => {
            // forward/backward edges can move in opposite directions if you like
            const dir = edge.data("dir");
            const sign =
                dir === "backward"
                    ? -1
                    : 1; // backward edges "flow" the other way

            edge.style("line-dash-offset", sign * offset);
        });
    }, 50); // 50ms for smooth animation
}


export default function App() {
    const [elements, setElements] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const cyRef = useRef(null);
    const layoutWasApplied = useRef(false);


    // Build graph elements
    useEffect(() => {
        // Combine all nodes from all JSON files
        const allNodes = Object.values(nodeModules).flatMap((mod) => {
            // each mod.default should be an array of nodes
            return Array.isArray(mod.default) ? mod.default : [];
        });

        // Combine all edges from all JSON files
        const allEdges = Object.values(edgeModules).flatMap((mod) => {
            return Array.isArray(mod.default) ? mod.default : [];
        });

        const nodeElements = allNodes.map((n) => ({
            data: {
                id: n.id,
                repo: n.repo,
                label: n.label,
                type: n.type,
                schema: n.schema
            }
        }));

        const edgeElements = allEdges.map((e) => ({
            data: {
                id: e.id,
                source: e.source,
                target: e.target,
                label: e.label,
                dir: e.dir
            }
        }));

        setElements([...nodeElements, ...edgeElements]);
    }, []);



    // When graph loads, apply layout + events
    const onCyInit = (cy) => {
        cyRef.current = cy;

        // interactions
        cy.zoomingEnabled(true);
        cy.panningEnabled(true);
        cy.userZoomingEnabled(true);
        cy.userPanningEnabled(true);
        cy.boxSelectionEnabled(true);
        cy.nodes().unlock();
        cy.nodes().grabify();

        // click handler
        cy.on("tap", "node", (evt) => {
            const node = evt.target;
            if (node.data("isFlowToken")) return;
            setSelectedNode(node.data());
        });
    };

    useEffect(() => {
        if (!cyRef.current) return;
        if (!elements.length) return;
        if (layoutWasApplied.current) return;

        const cy = cyRef.current;

        const layout = cy.layout({
            name: "dagre",
            rankDir: "LR",
            nodeSep: 50,
            rankSep: 70,
            edgeSep: 20,
        });

        layout.run();

        layout.on("layoutstop", () => {
            startEdgeDashAnimation(cy);   // <<< 🔥 START ANIMATION HERE
        });

        layoutWasApplied.current = true;

        cy.fit();
    }, [elements]);




    const cyElement = useMemo(() => {
        return (
            <CytoscapeComponent
                elements={elements}
                cy={onCyInit}
                className="graph-canvas"
                stylesheet={stylesheet}
            />
        );
    }, [elements]);  // only rebuild when ELEMENTS change, not when selected node changes


    return (
        <div className="app-container">
        {/* Graph container */}
            <div className="graph-container">
            <h3 style={{ padding: "10px" }}>GoBusiness System Topology</h3>
                {cyElement}
            </div>

            {/* Inspector Panel */}
            <div className="inspector-container">
                <h3>Inspector</h3>

                {!selectedNode && <div>Select a node in the graph.</div>}

                {selectedNode && (
                    <>
                        <button className="inspector-close-btn" onClick={() => setSelectedNode(null)}>
                            Close
                        </button>

                        <h4>Service: {selectedNode.label}</h4>
                        <h4>Repository: {selectedNode.repo}</h4>

                        <JsonView
                            data={selectedNode.schema || {}}
                            style={{ background: "#fff", padding: "10px" }}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
