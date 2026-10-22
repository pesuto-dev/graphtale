import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import {
  emptyDiagnosis,
  isHostToWebview,
  type FileContentPayload,
  type GraphView,
  type HostToWebview,
  type LayoutDirection,
  type ProcedureDiagnosis,
  type SkillGraph,
} from "@shared/protocol";
import { selectionAfterReload } from "@shared/reload";
import { emptyGraph, initialGraphView } from "./appConfig";
import { vscode } from "./vscode";

export type HostMessageBindings = {
  rootPathRef: MutableRefObject<string>;
  selectedIdRef: MutableRefObject<string | undefined>;
  viewRef: MutableRefObject<GraphView>;
  setGraph: (graph: SkillGraph) => void;
  setProcedure: (graph: SkillGraph) => void;
  setDiagnosis: Dispatch<SetStateAction<ProcedureDiagnosis>>;
  setView: (view: GraphView) => void;
  setDirection: (direction: LayoutDirection) => void;
  setExpandedIds: (ids: string[]) => void;
  setSelectedId: (id: string | undefined) => void;
  setContent: (content: FileContentPayload | undefined) => void;
  setStale: (stale: boolean) => void;
  setError: (error: { message: string; retryable: boolean } | undefined) => void;
  setFitNonce: (update: (nonce: number) => number) => void;
  setCopyState: (state: "idle" | "copied" | "failed") => void;
};

function applyHostMessage(bindings: HostMessageBindings, message: HostToWebview): void {
  switch (message.type) {
    case "graph": {
      const procedureGraph = message.procedure ?? message.pipeline ?? emptyGraph;
      const isFirstOpen = bindings.rootPathRef.current === "";
      const sameSkill =
        bindings.rootPathRef.current !== "" && bindings.rootPathRef.current === message.graph.rootPath;
      const opened: GraphView = sameSkill
        ? bindings.viewRef.current
        : isFirstOpen
          ? initialGraphView()
          : "flow";
      const activeNodes =
        opened === "flow" && procedureGraph.nodes.length > 0
          ? procedureGraph.nodes
          : message.graph.nodes;
      const reload = selectionAfterReload(
        bindings.rootPathRef.current,
        message.graph.rootPath,
        bindings.selectedIdRef.current,
        activeNodes,
      );
      bindings.rootPathRef.current = message.graph.rootPath;
      bindings.setGraph(message.graph);
      bindings.setProcedure(procedureGraph);
      bindings.setDiagnosis(message.diagnosis ?? emptyDiagnosis(message.graph.skillName));
      if (reload.resetView) {
        bindings.setView(opened);
        bindings.setExpandedIds(reload.selectedId ? [reload.selectedId] : []);
        if (opened === "flow" && message.direction === "LR") {
          const nextDir: LayoutDirection = "TB";
          bindings.setDirection(nextDir);
          vscode.postMessage({ type: "setDirection", direction: nextDir });
        } else {
          bindings.setDirection(message.direction);
        }
      } else {
        bindings.setDirection(message.direction);
      }
      bindings.setSelectedId(reload.selectedId);
      bindings.setContent(undefined);
      bindings.setStale(false);
      bindings.setError(undefined);
      bindings.setFitNonce((nonce) => nonce + 1);
      bindings.setCopyState("idle");
      if (reload.selectedId) {
        vscode.postMessage({ type: "selectNode", nodeId: reload.selectedId });
      }
      return;
    }
    case "fileContent":
      bindings.setContent(message.payload);
      return;
    case "direction":
      bindings.setDirection(message.direction);
      return;
    case "stale":
      bindings.setStale(message.stale);
      return;
    case "error":
      bindings.setError({ message: message.message, retryable: message.retryable });
      return;
    case "copyResult":
      if (!message.ok && message.text !== undefined) {
        const prompt = message.text;
        bindings.setDiagnosis((current) => ({ ...current, fixPrompt: prompt }));
      }
      bindings.setCopyState(message.ok ? "copied" : "failed");
      if (message.ok) {
        setTimeout(() => bindings.setCopyState("idle"), 1600);
      }
      return;
    default: {
      const _exhaustive: never = message;
      return _exhaustive;
    }
  }
}

export function useHostMessages(bindings: HostMessageBindings): void {
  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isHostToWebview(event.data)) {
        return;
      }
      applyHostMessage(bindings, event.data);
    };
    window.addEventListener("message", onMessage);
    vscode.postMessage({ type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);
}
