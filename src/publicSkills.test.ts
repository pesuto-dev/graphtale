import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseProcedure } from "./parseProcedure";
import { parseSkill } from "./parseSkill";

const publicRoot = path.resolve(__dirname, "../fixtures/public-skills");
const emptyHome = path.resolve(__dirname, "../fixtures/empty-home");

describe("first-run public skills", () => {
  it("keeps an honest none diagnosis for prose-only marketplace skills", () => {
    const result = parseProcedure({
      skillRoot: path.join(publicRoot, "prose-only"),
      catalog: [],
      homedir: emptyHome,
    });
    expect(result.diagnosis.confidence).toBe("none");
    expect(result.graph.nodes).toHaveLength(0);
    expect(result.diagnosis.message).toMatch(/no numbered steps/i);
    expect(result.diagnosis.fixPrompt).toMatch(/First Steps|numbered/i);
  });

  it("builds a high-confidence procedure from First Steps", () => {
    const result = parseProcedure({
      skillRoot: path.join(publicRoot, "first-steps"),
      catalog: [],
      homedir: emptyHome,
    });
    expect(result.diagnosis.confidence).toBe("high");
    const labels = result.graph.nodes.map((n) => n.label);
    expect(labels).toContain("SKILL.md");
    expect(result.graph.nodes.filter((n) => n.id.startsWith("step:")).length).toBe(3);
  });

  it("builds a high-confidence procedure from plain numbered Instructions", () => {
    const result = parseProcedure({
      skillRoot: path.join(publicRoot, "instructions-plain"),
      catalog: [],
      homedir: emptyHome,
    });
    expect(result.diagnosis.confidence).toBe("high");
    const steps = result.graph.nodes.filter((n) => n.id.startsWith("step:"));
    expect(steps.map((n) => n.label).join(" ")).toMatch(/Confirm|extract|plain text/i);
  });

  it("lists optional agents/openai.yaml in the catalog", () => {
    const graph = parseSkill({
      skillRoot: path.join(publicRoot, "codex-openai"),
      catalog: [],
      homedir: emptyHome,
    });
    const yaml = graph.nodes.find((n) => n.label === "openai.yaml");
    expect(yaml).toBeDefined();
    expect(yaml?.kind).toBe("reference");
    expect(yaml?.path).toMatch(/agents[/\\]openai\.yaml$/);
  });

  it("shows a procedure for the Codex sidecar skill", () => {
    const result = parseProcedure({
      skillRoot: path.join(publicRoot, "codex-openai"),
      catalog: [],
      homedir: emptyHome,
    });
    expect(result.diagnosis.confidence).toBe("high");
    expect(result.graph.nodes.some((n) => n.id.startsWith("step:"))).toBe(true);
  });
});
