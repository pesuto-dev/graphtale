import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSkill } from "./parseSkill";
import { parseProcedure } from "./parseProcedure";

function writeSkill(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, "utf8");
  }
}

describe("parseSkill catalog noise", () => {
  it("omits __pycache__, *.pyc, and migrate_* scripts from the catalog graph", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-catalog-"));
    writeSkill(root, {
      "SKILL.md": `---
name: noisy
description: test
---

# noisy

See [workflow.md](workflow.md).
`,
      "workflow.md": "# steps\n",
      "scripts/context.py": "print(1)\n",
      "scripts/migrate_legacy.py": "print(0)\n",
      "scripts/__pycache__/context.cpython-314.pyc": "x",
    });

    const graph = parseSkill({ skillRoot: root, catalog: [] });
    const labels = graph.nodes.map((n) => n.label);
    expect(labels).toContain("context.py");
    expect(labels).toContain("workflow.md");
    expect(labels).not.toContain("migrate_legacy.py");
    expect(labels.some((l) => l.endsWith(".pyc"))).toBe(false);
  });

  it("surfaces agent mentions from workflow as catalog agent nodes", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-catalog-agents-"));
    writeSkill(root, {
      "SKILL.md": `---
name: analyse-ticket
description: test
---

Procedure in [references/workflow.md](references/workflow.md).
`,
      "references/workflow.md": `# workflow

\`\`\`
N2b evidence     agent worker-evidence
N4  inspect      agent inspector
N5v review       agent reviewer
\`\`\`
`,
    });

    const graph = parseSkill({
      skillRoot: root,
      catalog: [],
      homedir: path.resolve(__dirname, "../fixtures/empty-home"),
    });
    const agents = graph.nodes.filter((n) => n.kind === "agent");
    expect(agents.map((n) => n.label).sort()).toEqual(
      ["inspector", "reviewer", "worker-evidence"].sort(),
    );
  });
});

describe("parseProcedure", () => {
  it("builds a high-confidence DAG from a P/N ASCII workflow graph", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-proc-"));
    writeSkill(root, {
      "SKILL.md": `---
name: analyse-ticket
description: test
---

# analyse-ticket

Procedure in [references/workflow.md](references/workflow.md).
`,
      "references/workflow.md": `# workflow

\`\`\`
P   preflight        scripts/context.py                    -> RepoContext
N1  resolve          scripts/resolve.py                    -> Bundle
      N2a attachments  scripts/attachments.py              -> AttachmentText
      N2b evidence     agent worker-evidence               -> EvidenceReport
      N2c prior        scripts/context.py --prior          -> PriorVerdict
N3  classify         this loop, references/classify.md     -> Classification
N4  inspect          agent inspector                       -> Report
N4v verify           scripts/verify_code.py                -> suspects
N5  synthesis        this loop                             -> AnalysisDraft
N5v review           agent reviewer                        -> Verdict
N6  validate         scripts/validate_output.py
N7  write            scripts/write_report.py
\`\`\`
`,
      "scripts/context.py": "",
      "scripts/resolve.py": "",
      "scripts/attachments.py": "",
      "scripts/verify_code.py": "",
      "scripts/validate_output.py": "",
      "scripts/write_report.py": "",
      "references/classify.md": "# classify\n",
    });

    const result = parseProcedure({ skillRoot: root, catalog: [] });
    expect(result.diagnosis.confidence).toBe("high");
    const ids = result.graph.nodes.map((n) => n.id);
    expect(ids).toContain("skill-md");
    expect(ids).toContain("procedure-source");
    expect(ids).toContain("step:P");
    expect(ids).toContain("step:N1");
    expect(ids).toContain("step:N2a");
    expect(ids).toContain("step:N4");
    expect(ids).toContain("step:N7");
    expect(result.graph.edges).toContainEqual(
      expect.objectContaining({ from: "skill-md", to: "procedure-source" }),
    );
    expect(result.graph.edges).toContainEqual(
      expect.objectContaining({ from: "step:P", to: "step:N1" }),
    );
    expect(result.graph.edges).toContainEqual(
      expect.objectContaining({ from: "step:N1", to: "step:N2a" }),
    );
    expect(result.graph.edges.some((e) => e.from === "gate:question" && e.to === "step:N4")).toBe(
      true,
    );
    expect(result.graph.edges.some((e) => e.from === "step:N6" && e.to === "step:N7")).toBe(true);

    const agents = result.graph.nodes.filter((n) => n.kind === "agent");
    expect(agents.map((n) => n.id).sort()).toEqual(
      ["step:N2b", "step:N3", "step:N4", "step:N5", "step:N5v"].sort(),
    );
    expect(result.graph.nodes.find((n) => n.id === "step:N3")?.label).toBe("N3 · classify");
    expect(result.graph.edges.some((e) => e.from === "step:N5" && e.to === "step:N3")).toBe(false);
  });

  it("resolves agent resources under ~/.claude/agents when present", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "skill-home-"));
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-agents-"));
    writeSkill(home, {
      ".claude/agents/worker-evidence.md": "---\nname: worker-evidence\n---\n\n# evidence\n",
    });
    writeSkill(root, {
      "SKILL.md": `---
name: with-agents
description: test
---

Procedure in [references/workflow.md](references/workflow.md).
`,
      "references/workflow.md": `# workflow

\`\`\`
P   preflight        scripts/context.py                    -> RepoContext
N1  resolve          scripts/resolve.py                    -> Bundle
N2b evidence         agent worker-evidence                 -> EvidenceReport
N3  classify         this loop                             -> Classification
\`\`\`
`,
      "scripts/context.py": "",
      "scripts/resolve.py": "",
    });

    const result = parseProcedure({ skillRoot: root, catalog: [], homedir: home });
    const evidence = result.graph.nodes.find((n) => n.id === "step:N2b");
    expect(evidence?.kind).toBe("agent");
    expect(evidence?.path).toBe(path.join(home, ".claude", "agents", "worker-evidence.md"));
  });

  it("keeps the legacy numbered workflow as a high-confidence procedure", () => {
    const analyseRoot = path.resolve(__dirname, "../fixtures/analyse-ticket");
    const result = parseProcedure({
      skillRoot: analyseRoot,
      catalog: [],
      homedir: path.resolve(__dirname, "../fixtures/empty-home"),
    });
    expect(result.diagnosis.confidence).toBe("high");
    expect(result.graph.nodes.length).toBeGreaterThan(3);
  });

  it("does not double-wire N5v on a sequential P/N graph without N2", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-seq-n5v-"));
    writeSkill(root, {
      "SKILL.md": `---
name: seq-n5v
description: test
---

Procedure in [references/workflow.md](references/workflow.md).
`,
      "references/workflow.md": `# workflow

\`\`\`
P   ingest           scripts/ingest.py                     -> Bundle
N1  gather           scripts/gather.py                     -> Notes
N5  compose          this loop                             -> Draft
N5v review           agent report-reviewer                 -> Verdict
N6  check            scripts/check.py
N7  write            scripts/write_report.py
\`\`\`
`,
      "scripts/ingest.py": "",
      "scripts/gather.py": "",
      "scripts/check.py": "",
      "scripts/write_report.py": "",
    });
    const result = parseProcedure({ skillRoot: root, catalog: [] });
    const n5ToN5v = result.graph.edges.filter((e) => e.from === "step:N5" && e.to === "step:N5v");
    expect(n5ToN5v).toEqual([
      expect.objectContaining({ from: "step:N5", to: "step:N5v", label: "conditional" }),
    ]);
    expect(result.graph.edges.some((e) => e.from === "step:N1" && e.to === "step:N5")).toBe(true);
    expect(result.graph.edges.some((e) => e.from === "step:N5v" && e.to === "step:N6")).toBe(true);
  });

  it("routes a Question gate without a direct N3→N4 skip when N2 is absent", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-gate-seq-"));
    writeSkill(root, {
      "SKILL.md": `---
name: gate-seq
description: test
---

Procedure in [references/workflow.md](references/workflow.md).
`,
      "references/workflow.md": `# workflow

\`\`\`
P   preflight        scripts/context.py                    -> RepoContext
N1  resolve          scripts/resolve.py                    -> Bundle
N3  classify         this loop                             -> Classification
N4  inspect          agent inspector                       -> Report
N5  answer           this loop                             -> Draft
N6  check            scripts/check.py
N7  close            scripts/close.py
\`\`\`
`,
      "scripts/context.py": "",
      "scripts/resolve.py": "",
      "scripts/check.py": "",
      "scripts/close.py": "",
    });
    const result = parseProcedure({ skillRoot: root, catalog: [] });
    expect(result.graph.edges.some((e) => e.from === "step:N3" && e.to === "gate:question")).toBe(
      true,
    );
    expect(result.graph.edges.some((e) => e.from === "step:N3" && e.to === "step:N4")).toBe(false);
    expect(result.graph.edges.some((e) => e.from === "gate:question" && e.to === "step:N4")).toBe(
      true,
    );
    expect(result.graph.edges.some((e) => e.from === "step:N4" && e.to === "step:N5")).toBe(true);
  });

  it("returns partial diagnosis when only a workflow link exists", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-partial-"));
    writeSkill(root, {
      "SKILL.md": `---
name: thin
description: test
---

# thin

See [workflow.md](workflow.md) for details someday.
`,
      "workflow.md": "# TODO write the real steps\n",
    });
    const result = parseProcedure({ skillRoot: root, catalog: [] });
    expect(result.diagnosis.confidence).toBe("partial");
    expect(result.graph.nodes.some((n) => n.isEntry)).toBe(true);
    expect(result.diagnosis.fixPrompt).toContain("thin");
  });
});
