import {
  compactFromQuery,
  graphViewFromQuery,
  type GraphView,
  type LayoutDirection,
  type SkillGraph,
} from "@shared/protocol";
import { CompactWrapEdge } from "./CompactWrapEdge";
import { SkillNodeView } from "./SkillNodeView";

export const nodeTypes = { skill: SkillNodeView };
export const edgeTypes = { compactWrap: CompactWrapEdge };

/** Rounded smoothstep for Flow edges. Compact edges keep their own type and path options. */
export const defaultEdgeOptions = {
  type: "smoothstep" as const,
  pathOptions: { borderRadius: 16 },
};

export const emptyGraph: SkillGraph = {
  skillId: "",
  skillName: "",
  rootPath: "",
  nodes: [],
  edges: [],
};

// Keep fit readable; Compact uses a denser grid so allow slightly tighter zoom.
export const FIT_VIEW_OPTIONS = { padding: 0.14, minZoom: 0.2, maxZoom: 1 };
export const COMPACT_FIT_VIEW_OPTIONS = { padding: 0.12, minZoom: 0.2, maxZoom: 1 };

/** Browser preview defaults to Flow; `/preview.html?view=catalog` opens inventory. */
export function initialGraphView(): GraphView {
  if (typeof window === "undefined") {
    return "flow";
  }
  return graphViewFromQuery(window.location.search);
}

export function initialDirection(view: GraphView): LayoutDirection {
  return view === "flow" ? "TB" : "LR";
}

/**
 * Start in Compact so long, connected procedures remain legible in an editor
 * column. `compact=0` explicitly selects the detailed layout.
 */
export function initialCompact(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return !params.has("compact") || compactFromQuery(window.location.search);
}
