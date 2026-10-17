import type { SkillNode } from "@shared/protocol";

export type GoToStepKey =
  | { kind: "move"; active: number }
  | { kind: "clear" }
  | { kind: "miss"; status: string }
  | { kind: "go"; node: SkillNode };

export function goToStepKey(
  key: string,
  state: { query: string; open: boolean; matches: SkillNode[]; active: number },
): GoToStepKey | undefined {
  const limit = Math.max(state.matches.length - 1, 0);
  if (key === "ArrowDown") {
    return { kind: "move", active: Math.min(state.active + 1, limit) };
  }
  if (key === "ArrowUp") {
    return { kind: "move", active: Math.max(state.active - 1, 0) };
  }
  if (key === "Escape") {
    return state.query || state.open ? { kind: "clear" } : undefined;
  }
  if (key !== "Enter") {
    return undefined;
  }
  const chosen = state.matches[Math.min(state.active, limit)];
  if (chosen) {
    return { kind: "go", node: chosen };
  }
  const trimmed = state.query.trim();
  return trimmed ? { kind: "miss", status: `No step matches "${trimmed}".` } : undefined;
}
