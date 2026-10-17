import type { SkillNode } from "@shared/protocol";

export type GoToStepKey =
  | { kind: "move"; active: number }
  | { kind: "clear" }
  | { kind: "miss"; status: string }
  | { kind: "go"; node: SkillNode };

export type GoToStepKeyState = {
  query: string;
  open: boolean;
  matches: SkillNode[];
  active: number;
};

export function goToStepKey(key: string, state: GoToStepKeyState): GoToStepKey | undefined {
  const limit = Math.max(state.matches.length - 1, 0);
  if (key === "ArrowDown") {
    return { kind: "move", active: Math.min(state.active + 1, limit) };
  }
  if (key === "ArrowUp") {
    return { kind: "move", active: Math.max(state.active - 1, 0) };
  }
  if (key === "Escape") {
    return escapeStep(state);
  }
  if (key === "Enter") {
    return enterStep(state, limit);
  }
  return undefined;
}

function escapeStep(state: GoToStepKeyState): GoToStepKey | undefined {
  return state.query || state.open ? { kind: "clear" } : undefined;
}

function enterStep(state: GoToStepKeyState, limit: number): GoToStepKey | undefined {
  const chosen = state.matches[Math.min(state.active, limit)];
  if (chosen) {
    return { kind: "go", node: chosen };
  }
  const trimmed = state.query.trim();
  return trimmed ? { kind: "miss", status: `No step matches "${trimmed}".` } : undefined;
}
