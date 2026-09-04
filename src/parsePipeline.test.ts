import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkills } from "./discover";
import { parsePipeline } from "./parsePipeline";

const fixturesRoot = path.resolve(__dirname, "../fixtures");
const analyseRoot = path.join(fixturesRoot, "analyse-ticket");

describe("parsePipeline", () => {
  it("builds a high-confidence flow from emptied analyse-ticket First Steps", () => {
    const catalog = discoverSkills({
      workspaceFolders: [path.join(fixturesRoot, "project")],
      homedir: path.join(fixturesRoot, "empty-home"),
    });
    const graph = parsePipeline({
      skillRoot: analyseRoot,
      catalog,
      homedir: path.join(fixturesRoot, "empty-home"),
    });
    expect(graph.nodes.some((n) => n.id === "skill-md")).toBe(true);
    expect(graph.nodes.filter((n) => n.id.startsWith("step:")).length).toBe(3);
    expect(graph.edges.some((e) => e.from === "skill-md")).toBe(true);
    expect(graph.nodes.some((n) => n.label.includes("ticket-handler"))).toBe(false);
  });

  it("returns an empty pipeline when the skill has no numbered workflow", () => {
    const catalog = discoverSkills({
      workspaceFolders: [path.join(fixturesRoot, "project")],
      homedir: path.join(fixturesRoot, "empty-home"),
    });
    const graph = parsePipeline({
      skillRoot: path.join(fixturesRoot, "project", ".claude", "skills", "handoff-target"),
      catalog,
      homedir: path.join(fixturesRoot, "empty-home"),
    });
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });
});
