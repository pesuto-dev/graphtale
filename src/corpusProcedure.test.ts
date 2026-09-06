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
  it("keeps source evidence without manufacturing runtime relationships", () => {
    const catalog = projectCatalog();
    const result = parseProcedure({
      skillRoot: pnRoot,
      catalog,
      homedir: path.join(fixturesRoot, "empty-home"),
    });

    expect(result.diagnosis.confidence).toBe("partial");
    const ids = result.graph.nodes.map((n) => n.id);
    expect(ids).toContain("skill-md");
    expect(ids).toContain("procedure-source");
    expect(result.graph.nodes.filter((node) => node.id.startsWith("step:")).map((node) => node.label)).toEqual([
      "P. ingest", "N1. split", "N2a. left", "N2b. worker", "N2c. right", "N3. classify",
      "N4. inspect", "N4v. verify", "N5. compose", "N5v. review", "N6. check", "N7. render + N8 write",
    ]);

    const entry = result.graph.nodes.find((n) => n.isEntry);
    expect(entry?.id).toBe("skill-md");

    expect(result.graph.edges).toContainEqual(
      expect.objectContaining({ from: "skill-md", to: "procedure-source", label: "source" }),
    );
    expect(result.graph.edges.some((e) => e.from === "procedure-source" && e.to === "step:P")).toBe(
      false,
    );
    expect(result.graph.edges.filter((edge) => edge.from.startsWith("step:") || edge.to.startsWith("step:"))).toHaveLength(0);
    expect(ids).not.toContain("gate:question");
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

  it.skipIf(!available)("analyse-ticket retains source evidence for detected steps", () => {
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
    const steps = result.graph.nodes.filter(node => node.id.startsWith("step:"));
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every(node => node.source?.path === node.path)).toBe(true);
    expect(result.graph.edges.filter(edge => edge.from.startsWith("step:")).every(edge =>
      edge.relationship === "explicit" && edge.source !== undefined,
    )).toBe(true);
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
