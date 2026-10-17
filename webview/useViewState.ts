import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeMouseHandler } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import {
  emptyDiagnosis,
  type FileContentPayload,
  type GraphView,
  type LayoutDirection,
  type ProcedureDiagnosis,
  type SkillGraph,
} from "@shared/protocol";
import {
  COMPACT_FIT_VIEW_OPTIONS,
  FIT_VIEW_OPTIONS,
  emptyGraph,
  initialCompact,
  initialDirection,
  initialGraphView,
} from "./appConfig";
import type { SkillFlowNode } from "./SkillNodeView";
import { vscode } from "./vscode";

export function useViewState() {
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

  function toggleCompact(): void {
    setCompact((value) => !value);
    setExpandedIds([]);
    setFitNonce((nonce) => nonce + 1);
  }

  return {
    graph,
    setGraph,
    procedure,
    setProcedure,
    diagnosis,
    setDiagnosis,
    view,
    setView,
    direction,
    setDirection,
    selectedId,
    setSelectedId,
    expandedIds,
    setExpandedIds,
    content,
    setContent,
    error,
    setError,
    inspectorOpen,
    setInspectorOpen,
    stale,
    setStale,
    fitNonce,
    setFitNonce,
    copyState,
    setCopyState,
    narrow,
    compact,
    setCompact,
    rootPathRef,
    selectedIdRef,
    viewRef,
    graphContainerRef,
    switchView,
    copyFixPrompt,
    selectNode,
    toggleExpanded,
    onNodeClick,
    onNodeDoubleClick,
    toggleDirection,
    toggleCompact,
  };
}
