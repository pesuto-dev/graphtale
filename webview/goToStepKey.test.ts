import { describe, expect, it } from "vitest";
import type { SkillNode } from "@shared/protocol";
import { goToStepKey, type GoToStepKeyState } from "./goToStepKey";

function node(id: string, label: string): SkillNode {
  return { id, label, kind: "skill", path: `/skills/${id}`, summary: "", uses: [] };
}

const first = node("step:1", "1. Read request");
const second = node("step:2", "2. Gather files");

function state(partial: Partial<GoToStepKeyState> = {}): GoToStepKeyState {
  return { query: "read", open: true, matches: [first, second], active: 0, ...partial };
}

describe("goToStepKey", () => {
  it("moves down to the next match", () => {
    expect(goToStepKey("ArrowDown", state())).toEqual({ kind: "move", active: 1 });
  });

  it("clamps ArrowDown at the last match", () => {
    expect(goToStepKey("ArrowDown", state({ active: 1 }))).toEqual({ kind: "move", active: 1 });
  });

  it("moves up to the previous match", () => {
    expect(goToStepKey("ArrowUp", state({ active: 1 }))).toEqual({ kind: "move", active: 0 });
  });

  it("clamps ArrowUp at the first match", () => {
    expect(goToStepKey("ArrowUp", state())).toEqual({ kind: "move", active: 0 });
  });

  it("clears when Escape is pressed with a query", () => {
    expect(goToStepKey("Escape", state())).toEqual({ kind: "clear" });
  });

  it("clears when Escape is pressed with an open list", () => {
    expect(goToStepKey("Escape", state({ query: "", open: true }))).toEqual({ kind: "clear" });
  });

  it("ignores Escape when the field is idle", () => {
    expect(goToStepKey("Escape", state({ query: "", open: false, matches: [] }))).toBeUndefined();
  });

  it("goes to the active match on Enter", () => {
    expect(goToStepKey("Enter", state({ active: 1 }))).toEqual({ kind: "go", node: second });
  });

  it("reports a miss when Enter finds nothing", () => {
    expect(goToStepKey("Enter", state({ query: "missing", matches: [] }))).toEqual({
      kind: "miss",
      status: 'No step matches "missing".',
    });
  });

  it("ignores keys that do not navigate", () => {
    expect(goToStepKey("a", state())).toBeUndefined();
  });
});
