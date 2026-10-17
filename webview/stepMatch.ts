import type { SkillNode } from "@shared/protocol";

const NUMBERED_LABEL = /^(\S+)\.\s+(\S[\s\S]*)$/;
const MISS_RANK = 100;

export interface StepParts { number: string; title: string }

/** Number is the token before “. ”; otherwise the `step:` id suffix. */
export function stepNumberAndTitle(node: SkillNode): StepParts {
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
  const scored = nodes.flatMap((node, index) => scoreStep(node, q, index));
  scored.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return scored.map((hit) => hit.node);
}

export function nodesPresentOnFlow(nodes: SkillNode[], shown: { id: string }[]): SkillNode[] {
  const ids = new Set(shown.map((item) => item.id));
  return nodes.filter((node) => ids.has(node.id));
}

interface ScoredStep { node: SkillNode; rank: number; index: number }

function scoreStep(node: SkillNode, query: string, index: number): ScoredStep[] {
  const rank = rankStep(node, query);
  return rank >= MISS_RANK ? [] : [{ node, rank, index }];
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
  if (labelMentionsQuery(label, n, query)) {
    return 5;
  }
  return MISS_RANK;
}

/** A longer step number such as 20 contains "2", but that is not a title hit. */
function labelMentionsQuery(label: string, number: string, query: string): boolean {
  if (!label.includes(query)) {
    return false;
  }
  const longerNumber = number.includes(query) && number !== query;
  return !longerNumber || isStepPrefix(number, query);
}

/** Prefix match that does not treat a longer step number as the same step. */
function isStepPrefix(number: string, query: string): boolean {
  if (!number.startsWith(query) || number === query) {
    return false;
  }
  return !/^\d/.test(number.slice(query.length));
}
