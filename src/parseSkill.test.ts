import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverSkills } from "./discover";
import { parseSkill } from "./parseSkill";

const fixturesRoot = path.resolve(__dirname, "../fixtures");
const analyseRoot = path.join(fixturesRoot, "analyse-ticket");

describe("discoverSkills", () => {
  it("finds fixture skills from a workspace folder", () => {
    const skills = discoverSkills({
      workspaceFolders: [path.join(fixturesRoot, "project")],
      homedir: path.join(fixturesRoot, "empty-home"),
    });
    const names = skills.map((skill) => skill.name);
    expect(names).toContain("handoff-target");
    expect(names).toContain("sample-intake");
    expect(names).not.toContain("analyse-ticket");
  });
});

describe("parseSkill", () => {
  it("maps analyse-ticket SKILL.md to the numbered First Steps file", () => {
    const catalog = discoverSkills({
      workspaceFolders: [path.join(fixturesRoot, "project")],
      homedir: path.join(fixturesRoot, "empty-home"),
    });
    const graph = parseSkill({
      skillRoot: analyseRoot,
      catalog,
      homedir: path.join(fixturesRoot, "empty-home"),
    });

    const labels = graph.nodes.map((node) => node.label);
    expect(graph.skillName).toBe("analyse-ticket");
    expect(labels).toContain("SKILL.md");
    expect(labels).not.toContain("ticket-handler");
    expect(labels).not.toContain("topdesk");
  });
});
