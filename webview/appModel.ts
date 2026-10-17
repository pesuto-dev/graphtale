import type { Edge } from "@xyflow/react";
import type {
  GraphView,
  LayoutDirection,
  ProcedureDiagnosis,
  SkillGraph,
  SkillNode,
} from "@shared/protocol";
import { toCompactFlow } from "./compactLayout";
import { toFlow } from "./layout";
import type { SkillFlowNode } from "./SkillNodeView";

export interface AppViewInput {
  view: GraphView;
  compact: boolean;
  narrow: boolean;
  direction: LayoutDirection;
  diagnosis: ProcedureDiagnosis;
  graph: SkillGraph;
  procedure: SkillGraph;
  selectedId: string | undefined;
  expandedIds: string[];
  stale: boolean;
}

export interface FlowModel {
  nodes: SkillFlowNode[];
  edges: Edge[];
}

export interface AppViewModel {
  showDiagnosis: boolean;
  display: SkillGraph;
  selected: SkillNode | undefined;
  flow: FlowModel;
  agentCount: number;
  gateCount: number;
  scriptCount: number;
  inventoryCount: number;
  hint: string;
  warnings: string[];
}

function countKind(nodes: SkillNode[], kind: SkillNode["kind"]): number {
  return nodes.filter((node) => node.kind === kind).length;
}

export function flowFor(input: AppViewInput, display: SkillGraph): FlowModel {
  if (input.view === "flow" && input.compact) {
    return toCompactFlow(display.nodes, display.edges, input.narrow ? 2 : 4);
  }
  return toFlow(display.nodes, display.edges, input.direction, input.expandedIds);
}

export function viewHint(input: Pick<AppViewInput, "stale" | "view" | "compact">): string {
  if (input.stale) {
    return "Skill files changed in Cursor or VS Code. Refresh to update the graph.";
  }
  if (input.view !== "flow") {
    return "Files and references found for this skill. Catalog does not imply execution order.";
  }
  if (input.compact) {
    return "Compact overview of the same instructions. Zoom or pan for detail.";
  }
  return "Supported instruction structure, linked to its source. Dashed edges show inferred or unresolved relationships.";
}

export function deriveAppView(input: AppViewInput): AppViewModel {
  const display = input.view === "flow" ? input.procedure : input.graph;
  const flow = flowFor(input, display);
  return {
    showDiagnosis: input.view === "flow" && input.diagnosis.confidence !== "high",
    display,
    selected: display.nodes.find((node) => node.id === input.selectedId),
    flow,
    agentCount: countKind(display.nodes, "agent"),
    gateCount: countKind(display.nodes, "gate"),
    scriptCount: countKind(display.nodes, "script"),
    inventoryCount: input.view === "flow" && input.compact ? flow.nodes.length : display.nodes.length,
    hint: viewHint(input),
    warnings: [...new Set([...(input.graph.warnings ?? []), ...(input.procedure.warnings ?? [])])],
  };
}
