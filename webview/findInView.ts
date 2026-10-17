import type { SkillNode } from "@shared/protocol";

const NUMBERED_LABEL = /^(\S+)\.\s+(\S[\s\S]*)$/;

/** How long a “go to step” fit keeps winning over a whole-graph fit. */
export const STEP_FOCUS_MS = 700;

export function filterCatalogNodes(nodes: SkillNode[], query: string): SkillNode[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return nodes;
  }
  return nodes.filter((node) =>
    [node.label, node.path, node.summary].some((field) => field.toLowerCase().includes(q)),
  );
}

/** Number is the token before “. ”; otherwise the `step:` id suffix. */
export function stepNumberAndTitle(node: SkillNode): { number: string; title: string } {
  const match = NUMBERED_LABEL.exec(node.label);
  if (match) {
    return { number: match[1], title: match[2] };
  }
  if (node.id.startsWith("step:")) {
    return { number: node.id.slice("step:".length), title: node.label };
  }
  return { number: "", title: node.label };
}

/**
 * Best step first. Exact number beats an exact title, then a non-numeric
 * prefix (`N2` → `N2a`, but `2` does not match `20`), then title text.
 */
export function rankSteps(nodes: SkillNode[], query: string): SkillNode[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }
  const scored = nodes.flatMap((node, index) => {
    const rank = rankStep(node, q);
    return rank >= 100 ? [] : [{ node, rank, index }];
  });
  scored.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return scored.map((hit) => hit.node);
}

export function isFindShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): boolean {
  return (event.key === "f" || event.key === "F") && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
}

/** Fit a single node in the middle of the pane without filling the screen. */
export function stepFocusOptions(nodeId: string): {
  nodes: { id: string }[];
  padding: number;
  duration: number;
  minZoom: number;
  maxZoom: number;
} {
  return {
    nodes: [{ id: nodeId }],
    padding: 0.45,
    duration: 180,
    minZoom: 0.2,
    maxZoom: 1.2,
  };
}

function rankStep(node: SkillNode, query: string): number {
  const { number, title } = stepNumberAndTitle(node);
  const n = number.toLowerCase();
  const t = title.toLowerCase();
  const label = node.label.toLowerCase();
  if (n && n === query) {
    return 0;
  }
  if (t === query || label === query) {
    return 1;
  }
  if (n && isStepPrefix(n, query)) {
    return 2;
  }
  if (t.startsWith(query)) {
    return 3;
  }
  if (t.includes(query)) {
    return 4;
  }
  // A longer step number such as 20 contains "2", but that is not a title hit.
  if (label.includes(query) && !(n.includes(query) && n !== query && !isStepPrefix(n, query))) {
    return 5;
  }
  return 100;
}

/** Prefix match that does not treat a longer step number as the same step. */
function isStepPrefix(number: string, query: string): boolean {
  if (!number.startsWith(query) || number === query) {
    return false;
  }
  return !/^\d/.test(number.slice(query.length));
}
