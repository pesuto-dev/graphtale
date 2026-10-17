import { useEffect, useRef, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import type { NodeMouseHandler } from "@xyflow/react";
import type {
  FileContentPayload,
  GraphView,
  LayoutDirection,
  ProcedureDiagnosis,
  SkillGraph,
} from "@shared/protocol";
import type { SkillFlowNode } from "./SkillNodeView";
import { directionAfterSwitch, entryAfterSwitch, nodeClickIntent } from "./viewCommands";
import { vscode } from "./vscode";

export type CopyState = "idle" | "copied" | "failed";

export type CommandInput = {
  graph: SkillGraph;
  procedure: SkillGraph;
  diagnosis: ProcedureDiagnosis;
  direction: LayoutDirection;
  compact: boolean;
  setView: (next: GraphView) => void;
  setDirection: (direction: LayoutDirection) => void;
  setSelectedId: (id: string | undefined) => void;
  setExpandedIds: Dispatch<SetStateAction<string[]>>;
  setContent: (content: FileContentPayload | undefined) => void;
  setInspectorOpen: (open: boolean) => void;
  setCompact: Dispatch<SetStateAction<boolean>>;
  setFitNonce: Dispatch<SetStateAction<number>>;
  setCopyState: Dispatch<SetStateAction<CopyState>>;
};

export type ViewCommands = {
  switchView: (next: GraphView) => void;
  copyFixPrompt: () => void;
  selectNode: (id: string) => void;
  toggleExpanded: (id: string) => void;
  onNodeClick: NodeMouseHandler<SkillFlowNode>;
  onNodeDoubleClick: NodeMouseHandler<SkillFlowNode>;
  toggleDirection: () => void;
  toggleCompact: () => void;
};

function applySwitch(input: CommandInput, next: GraphView): void {
  const entry = entryAfterSwitch(next, input.graph, input.procedure);
  const forced = directionAfterSwitch(next, input.direction, input.compact);
  input.setView(next);
  input.setSelectedId(entry?.id);
  input.setExpandedIds(entry ? [entry.id] : []);
  input.setContent(undefined);
  if (forced) {
    input.setDirection(forced);
    vscode.postMessage({ type: "setDirection", direction: forced });
  }
  if (entry) {
    vscode.postMessage({ type: "selectNode", nodeId: entry.id });
  }
}

function applyCopy(input: CommandInput, timer: { current: number | undefined }): void {
  vscode.postMessage({ type: "copyText", text: input.diagnosis.fixPrompt });
  if (timer.current !== undefined) {
    window.clearTimeout(timer.current);
  }
  timer.current = window.setTimeout(() => {
    input.setCopyState((current) => (current === "idle" ? "failed" : current));
  }, 1500);
}

function applySelect(input: CommandInput, id: string): void {
  input.setSelectedId(id);
  input.setInspectorOpen(true);
  vscode.postMessage({ type: "selectNode", nodeId: id });
}

function applyExpanded(input: CommandInput, id: string): void {
  input.setExpandedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
}

function applyNodeClick(input: CommandInput, event: MouseEvent, nodeId: string): void {
  const intent = nodeClickIntent(event.target, nodeId);
  if (intent.type === "expand") {
    event.preventDefault();
    applyExpanded(input, intent.id);
    return;
  }
  if (intent.type === "follow") {
    event.preventDefault();
    applySelect(input, intent.id);
    return;
  }
  applySelect(input, intent.id);
}

function applyDirection(input: CommandInput): void {
  const next: LayoutDirection = input.direction === "LR" ? "TB" : "LR";
  vscode.postMessage({ type: "setDirection", direction: next });
  input.setDirection(next);
}

function applyCompact(input: CommandInput): void {
  input.setCompact((value) => !value);
  input.setExpandedIds([]);
  input.setFitNonce((nonce) => nonce + 1);
}

export function useViewCommands(input: CommandInput): ViewCommands {
  const copyTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    return () => {
      if (copyTimer.current !== undefined) {
        window.clearTimeout(copyTimer.current);
      }
    };
  }, []);

  return {
    switchView: (next) => applySwitch(input, next),
    copyFixPrompt: () => applyCopy(input, copyTimer),
    selectNode: (id) => applySelect(input, id),
    toggleExpanded: (id) => applyExpanded(input, id),
    onNodeClick: (event, node) => applyNodeClick(input, event, node.id),
    onNodeDoubleClick: (_event, node) => {
      vscode.postMessage({ type: "openFile", nodeId: node.id });
    },
    toggleDirection: () => applyDirection(input),
    toggleCompact: () => applyCompact(input),
  };
}
