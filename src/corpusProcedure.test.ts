import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseProcedure } from "./parseProcedure";

const fixturesRoot = path.resolve(__dirname, "../fixtures");
const pnRoot = path.join(fixturesRoot, "analyse-ticket-pn");
const claudeCorpus = path.join(fixturesRoot, "user-skills", "claude");
const projectSkills = path.join(fixturesRoot, "project", ".claude", "skills");

function projectCatalog() {
  return fs
    .readdirSync(projectSkills, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const rootPath = path.join(projectSkills, entry.name);
      return {
        id: entry.name,
        name: entry.name,
        description: entry.name,
        rootPath,
      };
    });
}

describe("analyse-ticket-pn golden flow", () => {
  it("wraps SKILL.md → workflow → P…N7 with support and handoff", () => {
    const catalog = projectCatalog();
    const result = parseProcedure({
      skillRoot: pnRoot,
      catalog,
      homedir: path.join(fixturesRoot, "empty-home"),
    });

    expect(result.diagnosis.confidence).toBe("high");
    const ids = result.graph.nodes.map((n) => n.id);
    expect(ids).toContain("skill-md");
    expect(ids).toContain("procedure-source");
    expect(ids).toContain("step:P");
    expect(ids).toContain("step:N7");
    expect(ids).toContain("gate:question");

    const entry = result.graph.nodes.find((n) => n.isEntry);
    expect(entry?.id).toBe("skill-md");

    expect(result.graph.edges).toContainEqual(
      expect.objectContaining({ from: "skill-md", to: "procedure-source", label: "read on invoke" }),
    );
    expect(result.graph.edges.some((e) => e.from === "procedure-source" && e.to === "step:P")).toBe(
      true,
    );

    const supportLabels = result.graph.nodes.map((n) => n.label);
    expect(supportLabels.some((l) => /schema|output-template|classify/i.test(l))).toBe(true);

    expect(ids).toContain("skill:handoff-target");
    expect(
      result.graph.edges.some(
        (e) => e.to === "skill:handoff-target" && e.label === "handoff" && e.confidence === "low",
      ),
    ).toBe(true);

    const n5 = result.graph.nodes.find((n) => n.id === "step:N5");
    expect(n5?.kind).toBe("agent");
    expect(n5?.label).toBe("N5 · compose");
    const n7 = result.graph.nodes.find((n) => n.id === "step:N7");
    expect(n7?.label).toMatch(/N7\+N8/);

    const agents = result.graph.nodes.filter((n) => n.kind === "agent");
    expect(agents.map((n) => n.id).sort()).toEqual(
      ["step:N2b", "step:N3", "step:N4", "step:N5", "step:N5v"].sort(),
    );
    expect(result.graph.nodes.find((n) => n.id === "step:N3")?.label).toBe("N3 · classify");
    expect(result.graph.nodes.find((n) => n.id === "step:N2b")?.label).toBe("N2b · worker");

    expect(
      result.graph.edges.some((e) => e.from === "step:N5" && e.to === "step:N3"),
    ).toBe(false);
    expect(ids).toContain("support:references/classify.md");
    expect(
      result.graph.edges.some(
        (e) => e.to === "support:references/classify.md" && e.label === "criteria",
      ),
    ).toBe(true);
  });
});

describe("user-skills claude corpus", () => {
  const available = fs.existsSync(path.join(claudeCorpus, "analyse-ticket", "SKILL.md"));

  it.skipIf(!available)("parses every claude skill without throwing", () => {
    for (const name of fs.readdirSync(claudeCorpus)) {
      const skillRoot = path.join(claudeCorpus, name);
      if (!fs.existsSync(path.join(skillRoot, "SKILL.md"))) {
        continue;
      }
      expect(() => parseProcedure({ skillRoot, catalog: [] })).not.toThrow();
    }
  });

  it.skipIf(!available)("analyse-ticket has entry wrap and PN spine", () => {
    const catalog = [
      ...projectCatalog(),
      {
        id: "ticket-handler",
        name: "ticket-handler",
        description: "handoff",
        rootPath: path.join(claudeCorpus, "ticket-handler"),
      },
    ];
    const result = parseProcedure({
      skillRoot: path.join(claudeCorpus, "analyse-ticket"),
      catalog,
    });
    expect(result.diagnosis.confidence).toBe("high");
    const ids = result.graph.nodes.map((n) => n.id);
    expect(ids).toContain("skill-md");
    expect(ids).toContain("procedure-source");
    expect(ids).toContain("step:P");
    expect(ids).toContain("step:N7");
    expect(ids).toContain("gate:question");
  });

  it.skipIf(!available)("ticket-handler and devops-tickets are useful procedures", () => {
    for (const name of ["ticket-handler", "devops-tickets"]) {
      const result = parseProcedure({
        skillRoot: path.join(claudeCorpus, name),
        catalog: [],
      });
      expect(result.graph.nodes.length).toBeGreaterThan(2);
      expect(result.graph.nodes.some((n) => n.isEntry && n.id === "skill-md")).toBe(true);
      const runtimeSteps = result.graph.nodes.filter((n) => n.id.startsWith("step:"));
      expect(runtimeSteps.length).toBeGreaterThan(0);
    }
  });
});
