import { expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import type { SkillEdge, SkillNode } from "@shared/protocol";
import { columnsFromLevels } from "./compactColumns";
import { filterForCompact } from "./compactFilter";
import { compactNodeBoxesOverlap } from "./compactGeometry";
import { compactLevels, toCompactFlow } from "./compactLayout";
import { dagreLrRanks } from "./layout";
import { parseProcedure } from "../src/parseProcedure";

export function node(
  id: string,
  kind: SkillNode["kind"],
  extra: Partial<SkillNode> = {},
): SkillNode {
  return {
    id,
    label: id,
    kind,
    path: `/${id}`,
    summary: "",
    uses: [],
    ...extra,
  };
}

export const spineNodes: SkillNode[] = [
  node("skill-md", "skill", { isEntry: true, label: "SKILL.md" }),
  node("procedure-source", "reference", { label: "workflow.md" }),
  node("step:P", "script", { label: "P · context.py" }),
  node("step:N1", "script", { label: "N1 · resolve.py" }),
  node("step:N2a", "script"),
  node("step:N2b", "agent"),
  node("step:N2c", "script"),
  node("step:N3", "agent"),
  node("gate:question", "gate"),
  node("step:N4", "agent"),
  node("step:N4v", "script"),
  node("step:N5", "agent"),
  node("step:N7", "script"),
  node("skill:handoff-target", "skill", { label: "handoff-target" }),
];

export const spineEdges: SkillEdge[] = [
  { from: "skill-md", to: "procedure-source", label: "read on invoke" },
  { from: "procedure-source", to: "step:P" },
  { from: "step:P", to: "step:N1" },
  { from: "step:N1", to: "step:N2a", label: "parallel" },
  { from: "step:N1", to: "step:N2b", label: "parallel" },
  { from: "step:N1", to: "step:N2c", label: "parallel" },
  { from: "step:N2a", to: "step:N3" },
  { from: "step:N2b", to: "step:N3" },
  { from: "step:N2c", to: "step:N3" },
  { from: "step:N3", to: "gate:question" },
  { from: "gate:question", to: "step:N4", label: "Bug | Change" },
  { from: "gate:question", to: "step:N5", label: "Question", confidence: "low" },
  { from: "step:N4", to: "step:N4v" },
  { from: "step:N4v", to: "step:N5" },
  { from: "step:N5", to: "step:N7" },
  { from: "step:N7", to: "skill:handoff-target", label: "handoff", confidence: "low", inferred: true },
];

const emptyHome = path.resolve(__dirname, "../fixtures/empty-home");

export function rankIds(ranks: SkillNode[][]): string[][] {
  return ranks.map((rank) => rank.map((n) => n.id));
}

export function rowIds(columns: ReturnType<typeof columnsFromLevels>[]): string[][][] {
  return columns.map((row) => row.map((c) => c.nodes.map((n) => n.id)));
}

export function parseFixture(rel: string) {
  return parseProcedure({
    skillRoot: path.resolve(__dirname, rel),
    catalog: [
      {
        id: "handoff-target",
        name: "handoff-target",
        description: "handoff",
        rootPath: path.resolve(__dirname, "../fixtures/project/.claude/skills/handoff-target"),
      },
    ],
    homedir: emptyHome,
  });
}

export function assertHealthyCompact(nodes: SkillNode[], edges: SkillEdge[]): ReturnType<typeof toCompactFlow> {
  const filtered = filterForCompact(nodes, edges);
  const flow = toCompactFlow(nodes, edges);
  expect(compactNodeBoxesOverlap(flow.nodes)).toBe(false);
  expect(rankIds(compactLevels(filtered.nodes, filtered.edges))).toEqual(
    rankIds(dagreLrRanks(filtered.nodes, filtered.edges)),
  );
  const allowed = new Set(filtered.edges.map((edge) => `${edge.from}->${edge.to}`));
  for (const edge of flow.edges) {
    expect(allowed.has(`${edge.source}->${edge.target}`)).toBe(true);
  }
  expect(flow.nodes.map((n) => n.id).sort()).toEqual(filtered.nodes.map((n) => n.id).sort());
  return flow;
}

const demoRoot = path.resolve(__dirname, "../fixtures/demo-skills");
export const demoSkillNames = fs
  .readdirSync(demoRoot, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && fs.existsSync(path.join(demoRoot, entry.name, "SKILL.md")),
  )
  .map((entry) => entry.name)
  .sort();
