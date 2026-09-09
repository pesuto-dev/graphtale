import { useCallback, useEffect, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  compactFromQuery,
  diagnosisNeededWhen,
  diagnosisTitle,
  emptyDiagnosis,
  graphViewFromQuery,
  isHostToWebview,
  type FileContentPayload,
  type GraphView,
  type HostToWebview,
  type LayoutDirection,
  type ProcedureDiagnosis,
  type SkillGraph,
} from "@shared/protocol";
import { selectionAfterReload } from "@shared/reload";
import { toFlow } from "./layout";
import { toCompactFlow } from "./compactLayout";
import { CatalogInventory } from "./CatalogInventory";
import { CompactWrapEdge } from "./CompactWrapEdge";
import { Inspector } from "./Inspector";
import { Legend } from "./Legend";
import { SkillNodeView, type SkillFlowNode } from "./SkillNodeView";
import { vscode } from "./vscode";

const nodeTypes = { skill: SkillNodeView };
const edgeTypes = { compactWrap: CompactWrapEdge };

const emptyGraph: SkillGraph = {
  skillId: "",
  skillName: "",
  rootPath: "",
  nodes: [],
  edges: [],
};

// Keep fit readable; Compact uses a denser grid so allow slightly tighter zoom.
const FIT_VIEW_OPTIONS = { padding: 0.14, minZoom: 0.2, maxZoom: 1 };
const COMPACT_FIT_VIEW_OPTIONS = { padding: 0.12, minZoom: 0.2, maxZoom: 1 };

/** Browser preview defaults to Flow; `/preview.html?view=catalog` opens inventory. */
function initialGraphView(): GraphView {
  if (typeof window === "undefined") {
    return "flow";
  }
  return graphViewFromQuery(window.location.search);
}

function initialDirection(view: GraphView): LayoutDirection {
  return view === "flow" ? "TB" : "LR";
}

/**
 * Start in Compact so long, connected procedures remain legible in an editor
 * column. `compact=0` explicitly selects the detailed layout.
 */
function initialCompact(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return !params.has("compact") || compactFromQuery(window.location.search);
}

export function App() {
  return (
    <ReactFlowProvider>
      <AppShell />
    </ReactFlowProvider>
  );
}

function AppShell() {
  const [graph, setGraph] = useState<SkillGraph>(emptyGraph);
  const [procedure, setProcedure] = useState<SkillGraph>(emptyGraph);
  const [diagnosis, setDiagnosis] = useState<ProcedureDiagnosis>(emptyDiagnosis());
  const [view, setView] = useState<GraphView>(() => initialGraphView());
  const [direction, setDirection] = useState<LayoutDirection>(() =>
    initialDirection(initialGraphView()),
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [content, setContent] = useState<FileContentPayload | undefined>(undefined);
  const [error, setError] = useState<{ message: string; retryable: boolean }>();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [stale, setStale] = useState(false);
  // Bumped on open/refresh so the ReactFlow `key` remounts (resets manual zoom/pan).
  const [fitNonce, setFitNonce] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [narrow, setNarrow] = useState(() => window.innerWidth < 720);
  useEffect(() => { const resize = () => setNarrow(window.innerWidth < 720); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize); }, []);
  const [compact, setCompact] = useState(() => initialCompact());
  const rootPathRef = useRef("");
  const selectedIdRef = useRef<string | undefined>(undefined);
  const viewRef = useRef<GraphView>(initialGraphView());
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  selectedIdRef.current = selectedId;
  viewRef.current = view;

  // Fit the whole graph into the panel. Retried on the next frame and shortly
  // after so it lands once layout/size/expand measurements have settled.
  const scheduleFit = useCallback(() => {
    const options = compact ? COMPACT_FIT_VIEW_OPTIONS : FIT_VIEW_OPTIONS;
    const run = () => void fitView(options);
    const frame = requestAnimationFrame(run);
    const timer = setTimeout(run, 150);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [fitView, compact]);

  // Keep the whole graph visible after open/refresh, view/layout changes,
  // expand/collapse, or panel resize. Open/refresh remount via `fitNonce` in the
  // ReactFlow key; resize and expand only re-fit (no remount flicker).
  useEffect(() => {
    return scheduleFit();
  }, [view, direction, expandedIds, fitNonce, compact, narrow, inspectorOpen, scheduleFit]);

  // Debounced panel resize → re-fit without remounting.
  useEffect(() => {
    const el = graphContainerRef.current;
    if (!el) {
      return;
    }
    let last = { w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      const next = { w: Math.round(el.clientWidth), h: Math.round(el.clientHeight) };
      if (next.w === last.w && next.h === last.h) {
        return;
      }
      last = next;
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void fitView(compact ? COMPACT_FIT_VIEW_OPTIONS : FIT_VIEW_OPTIONS);
      }, 120);
    });
    observer.observe(el);
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
      observer.disconnect();
    };
  }, [fitView, compact, view, fitNonce]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isHostToWebview(event.data)) {
        return;
      }
      applyHostMessage(event.data);
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function applyHostMessage(message: HostToWebview): void {
    switch (message.type) {
      case "graph": {
        const procedureGraph = message.procedure ?? message.pipeline ?? emptyGraph;
        const isFirstOpen = rootPathRef.current === "";
        const sameSkill =
          rootPathRef.current !== "" && rootPathRef.current === message.graph.rootPath;
        const opened: GraphView = sameSkill
          ? viewRef.current
          : isFirstOpen
            ? initialGraphView()
            : "flow";
        const activeNodes =
          opened === "flow" && procedureGraph.nodes.length > 0
            ? procedureGraph.nodes
            : message.graph.nodes;
        const reload = selectionAfterReload(
          rootPathRef.current,
          message.graph.rootPath,
          selectedIdRef.current,
          activeNodes,
        );
        rootPathRef.current = message.graph.rootPath;
        setGraph(message.graph);
        setProcedure(procedureGraph);
        setDiagnosis(message.diagnosis ?? emptyDiagnosis(message.graph.skillName));
        if (reload.resetView) {
          setView(opened);
          setExpandedIds(reload.selectedId ? [reload.selectedId] : []);
          if (opened === "flow" && message.direction === "LR") {
            const nextDir: LayoutDirection = "TB";
            setDirection(nextDir);
            vscode.postMessage({ type: "setDirection", direction: nextDir });
          } else {
            setDirection(message.direction);
          }
        } else {
          setDirection(message.direction);
        }
        setSelectedId(reload.selectedId);
        setContent(undefined);
        setStale(false);
        setError(undefined);
        setFitNonce((nonce) => nonce + 1);
        setCopyState("idle");
        if (reload.selectedId) {
          vscode.postMessage({ type: "selectNode", nodeId: reload.selectedId });
        }
        return;
      }
      case "fileContent":
        setContent(message.payload);
        return;
      case "direction":
        setDirection(message.direction);
        return;
      case "stale":
        setStale(message.stale);
        return;
      case "error":
        setError({ message: message.message, retryable: message.retryable });
        return;
      case "copyResult":
        setCopyState(message.ok ? "copied" : "failed");
        if (message.ok) {
          setTimeout(() => setCopyState("idle"), 1600);
        }
        return;
      default: {
        const _exhaustive: never = message;
        return _exhaustive;
      }
    }
  }

  const showDiagnosis = view === "flow" && diagnosis.confidence !== "high";
  const display = view === "flow" ? procedure : graph;
  const selected = display.nodes.find((node) => node.id === selectedId);
  const flow =
    view === "flow" && compact
      ? toCompactFlow(display.nodes, display.edges, narrow ? 2 : 4)
      : toFlow(display.nodes, display.edges, direction, expandedIds);
  const agentCount = display.nodes.filter((node) => node.kind === "agent").length;
  const gateCount = display.nodes.filter((node) => node.kind === "gate").length;
  const scriptCount = display.nodes.filter((node) => node.kind === "script").length;
  const inventoryCount = view === "flow" && compact
    ? flow.nodes.length
    : display.nodes.length;

  function switchView(next: GraphView): void {
    setView(next);
    const active = next === "flow" ? procedure : graph;
    const entry = active.nodes.find((node) => node.isEntry) ?? active.nodes[0];
    setSelectedId(entry?.id);
    setExpandedIds(entry ? [entry.id] : []);
    setContent(undefined);
    if (next === "flow" && direction === "LR" && !compact) {
      const nextDir: LayoutDirection = "TB";
      setDirection(nextDir);
      vscode.postMessage({ type: "setDirection", direction: nextDir });
    }
    if (entry) {
      vscode.postMessage({ type: "selectNode", nodeId: entry.id });
    }
  }

  function copyFixPrompt(): void {
    vscode.postMessage({ type: "copyText", text: diagnosis.fixPrompt });
    window.setTimeout(() => {
      setCopyState((current) => (current === "idle" ? "failed" : current));
    }, 1500);
  }

  function selectNode(id: string): void {
    setSelectedId(id);
    setInspectorOpen(true);
    vscode.postMessage({ type: "selectNode", nodeId: id });
  }

  function toggleExpanded(id: string): void {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const onNodeClick: NodeMouseHandler<SkillFlowNode> = (event, node) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-expand]")) {
      event.preventDefault();
      toggleExpanded(node.id);
      return;
    }
    const chip = target.closest("[data-target-id]") as HTMLElement | null;
    const targetId = chip?.dataset.targetId;
    if (targetId) {
      event.preventDefault();
      selectNode(targetId);
      return;
    }
    selectNode(node.id);
  };

  const onNodeDoubleClick: NodeMouseHandler<SkillFlowNode> = (_event, node) => {
    vscode.postMessage({ type: "openFile", nodeId: node.id });
  };

  function toggleDirection(): void {
    const next: LayoutDirection = direction === "LR" ? "TB" : "LR";
    vscode.postMessage({ type: "setDirection", direction: next });
    setDirection(next);
  }

  return (
    <div className={inspectorOpen ? "app" : "app inspector-closed"}>
      <header className="toolbar">
        <div>
          <div className="title-row">
            <h1>{graph.skillName || "Graphtale"}</h1>
            <span className="status-pill on">viewer</span>
          </div>
          <div className="view-tabs">
            <button
              type="button"
              className={view === "flow" ? "active" : ""}
              onClick={() => switchView("flow")}
            >
              Flow
            </button>
            <button
              type="button"
              className={view === "catalog" ? "active" : ""}
              onClick={() => switchView("catalog")}
            >
              Catalog
            </button>
          </div>
          <p className="hint">
            {stale
              ? "Skill files changed in Cursor or VS Code. Refresh to update the graph."
              : view === "flow"
                ? compact
                  ? "Compact overview of the same instructions. Zoom or pan for detail."
                  : "Supported instruction structure, linked to its source. Dashed edges show inferred or unresolved relationships."
                : "Files and references found for this skill. Catalog does not imply execution order."}
          </p>
        </div>
        <div className="toolbar-stats">
          <span className="stat">
            <strong>{inventoryCount}</strong>
            {view === "flow" ? (compact ? "shown" : "steps") : "nodes"}
          </span>
          <span className="stat">
            <strong>{agentCount}</strong>
            agents
          </span>
          {view === "flow" ? (
            <span className="stat">
              <strong>{scriptCount > 0 ? scriptCount : gateCount}</strong>
              {scriptCount > 0 ? "scripts" : "gates"}
            </span>
          ) : null}
          <button
            type="button"
            className={stale ? "refresh-btn is-stale" : "refresh-btn"}
            onClick={() => vscode.postMessage({ type: "refresh" })}
          >
            {stale ? "Refresh · files changed" : "Refresh"}
          </button>
          {view === "flow" ? (
            <button
              type="button"
              className={compact ? "active" : ""}
              onClick={() => {
                setCompact((value) => !value);
                setExpandedIds([]);
                setFitNonce((nonce) => nonce + 1);
              }}
            >
              Compact
            </button>
          ) : null}
          {view === "flow" && !compact ? (
            <button type="button" onClick={toggleDirection}>
              Layout {direction === "LR" ? "left to right" : "top to bottom"}
            </button>
          ) : null}
        </div>
      </header>
      <div className="main main-procedure">
        {error ? <div className="error-banner" role="alert"><span>{error.message}</span>{error.retryable ? <button onClick={() => vscode.postMessage({ type: "refresh" })}>Retry</button> : null}</div> : null}
        <div className="graph-pane">
          {(graph.warnings?.length || procedure.warnings?.length) ? <details className="read-warnings"><summary>Some files or steps could not be fully read</summary><ul>{[...new Set([...(graph.warnings ?? []), ...(procedure.warnings ?? [])])].map(warning => <li key={warning}>{warning}</li>)}</ul></details> : null}
          {showDiagnosis ? (
            <div className={`diagnosis-banner confidence-${diagnosis.confidence}`}>
              <div className="diagnosis-copy">
                <strong>{diagnosisTitle(diagnosis.confidence)}</strong>
                <p>{diagnosis.message}</p>
                <p className="diagnosis-hint">{diagnosisNeededWhen(diagnosis.confidence)}</p>
                {copyState === "failed" && diagnosis.fixPrompt ? (
                  <pre className="fix-prompt-text" tabIndex={0}>
                    {diagnosis.fixPrompt}
                  </pre>
                ) : null}
              </div>
              <div className="diagnosis-actions">
              <button type="button" onClick={() => switchView("catalog")}>Inspect files in Catalog</button>
              <details><summary>Optional: clarify the step structure</summary>
              <button type="button" className="fix-prompt-btn" onClick={() => copyFixPrompt()}>
                {copyState === "copied"
                  ? "Copied. Paste in chat"
                  : copyState === "failed"
                    ? "Copy failed. Select the prompt text"
                    : "Copy clarification prompt"}
              </button></details></div>
            </div>
          ) : null}
          {view === "catalog" ? (
            <CatalogInventory
              nodes={display.nodes}
              selectedId={selectedId}
              onSelect={selectNode}
              onOpen={(nodeId) => vscode.postMessage({ type: "openFile", nodeId })}
            />
          ) : display.nodes.length === 0 ? (
            <div className="flow-empty"><p>Review this skill’s files and instructions in Catalog.</p><button onClick={() => switchView("catalog")}>Open Catalog</button></div>
          ) : (
            <>
              <div className="graph" ref={graphContainerRef} onKeyDownCapture={event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                const element = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node");
                if (element?.dataset.id) { event.preventDefault(); event.stopPropagation(); selectNode(element.dataset.id); }
              }}>
                <ReactFlow
                  key={`${graph.rootPath}-${view}-${direction}-${compact}-${fitNonce}`}
                  nodes={flow.nodes.map((node) => ({
                    ...node,
                    selected: node.id === selectedId,
                  }))}
                  edges={flow.edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  onNodeClick={onNodeClick}
                  onNodeDoubleClick={onNodeDoubleClick}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                  fitView
                  fitViewOptions={compact ? COMPACT_FIT_VIEW_OPTIONS : FIT_VIEW_OPTIONS}
                  minZoom={0.1}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={18} size={1} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </div>
              <Legend
                showGate={gateCount > 0}
                showProcedureHints
              />
            </>
          )}
        </div>
      </div>
      <Inspector
        open={inspectorOpen}
        onToggle={() => setInspectorOpen(value => !value)}
        node={selected}
        content={content}
        edges={display.edges}
        nodes={display.nodes}
        onSelectNode={selectNode}
      />
    </div>
  );
}
