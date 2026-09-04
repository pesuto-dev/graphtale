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
  type SkillNode,
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
const FIT_VIEW_OPTIONS = { padding: 0.14, minZoom: 0.5 };
const COMPACT_FIT_VIEW_OPTIONS = { padding: 0.12, minZoom: 0.55 };

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

/** Browser preview: `/preview.html?view=flow&compact=1`. */
function initialCompact(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return compactFromQuery(window.location.search);
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
  const [stale, setStale] = useState(false);
  // Bumped on open/refresh so the ReactFlow `key` remounts (resets manual zoom/pan).
  const [fitNonce, setFitNonce] = useState(0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
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
  }, [view, direction, expandedIds, fitNonce, compact, scheduleFit]);

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
  }, [fitView, compact]);

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
      ? toCompactFlow(display.nodes, display.edges)
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
    const data = node.data as SkillNode;
    vscode.postMessage({ type: "openFile", path: data.path });
  };

  function toggleDirection(): void {
    const next: LayoutDirection = direction === "LR" ? "TB" : "LR";
    vscode.postMessage({ type: "setDirection", direction: next });
    setDirection(next);
  }

  return (
    <div className="app">
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
                  ? "Compact: same flow order as normal view, denser chips."
                  : "How this skill runs: ordered steps, agents, forks. Dashed edges are conditional or low-confidence."
                : "What this skill contains on disk: files, agents, scripts, handoffs. Not runtime order (use Flow for that)."}
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
        <div className="graph-pane">
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
              <button type="button" className="fix-prompt-btn" onClick={() => copyFixPrompt()}>
                {copyState === "copied"
                  ? "Copied. Paste in chat"
                  : copyState === "failed"
                    ? "Copy failed. Select the prompt text"
                    : "Copy prompt for chat"}
              </button>
            </div>
          ) : null}
          {view === "catalog" ? (
            <CatalogInventory
              nodes={display.nodes}
              selectedId={selectedId}
              onSelect={selectNode}
              onOpen={(path) => vscode.postMessage({ type: "openFile", path })}
            />
          ) : (
            <>
              <div className="graph" ref={graphContainerRef}>
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
                  minZoom={compact ? 0.5 : 0.45}
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
        node={selected}
        content={content}
        edges={display.edges}
        nodes={display.nodes}
        onSelectNode={selectNode}
      />
    </div>
  );
}
