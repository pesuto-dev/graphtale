import { describe, expect, it } from "vitest";
import { kindClass, kindLabel, kindShape } from "./kind";
import type { NodeKind } from "./protocol";

const kinds: NodeKind[] = ["skill", "reference", "agent", "script", "shared", "gate"];

describe("kind visuals", () => {
  it("labels, shapes, and classes cover every node kind", () => {
    const byKind = {
      skill: { label: "skill", shape: "pill", className: "kind-skill" },
      reference: { label: "reference", shape: "pill", className: "kind-reference" },
      agent: { label: "agent", shape: "hex", className: "kind-agent" },
      script: { label: "script", shape: "rect", className: "kind-script" },
      shared: { label: "shared", shape: "pill", className: "kind-shared" },
      gate: { label: "validation", shape: "diamond", className: "kind-gate" },
    } as const;

    for (const kind of kinds) {
      expect(kindLabel(kind)).toBe(byKind[kind].label);
      expect(kindShape(kind)).toBe(byKind[kind].shape);
      expect(kindClass(kind)).toBe(byKind[kind].className);
    }
  });
});
