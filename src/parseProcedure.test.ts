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
  describe("release parser regressions", () => {
    const regressionRoot = path.resolve(__dirname, "../fixtures/parser-regressions");

    it("does not invent a Question/Bug/Change branch from P/N identifiers", () => {
      const result = parseProcedure({ skillRoot: path.join(regressionRoot, "pn-cooking"), catalog: [] });
      expect(result.graph.nodes.filter((node) => node.id.startsWith("step:")).map((node) => node.label)).toEqual([
        "N3. Bake",
        "N4. Cool",
        "N5. Serve",
      ]);
      expect(result.graph.nodes.some((node) => node.kind === "gate")).toBe(false);
      expect(result.diagnosis.confidence).toBe("partial");
    });

    it("does not treat a numbered Examples list as a flow", () => {
      const result = parseProcedure({ skillRoot: path.join(regressionRoot, "examples-list"), catalog: [] });
      expect(result.diagnosis.confidence).toBe("none");
      expect(result.graph.nodes).toHaveLength(0);
    });

    it("detects numbered level-two headings directly in SKILL.md", () => {
      const result = parseProcedure({ skillRoot: path.join(regressionRoot, "numbered-headings"), catalog: [] });
      expect(result.diagnosis.confidence).toBe("high");
      expect(result.graph.nodes.filter((node) => node.id.startsWith("step:")).map((node) => node.label)).toEqual([
        "1. Gather",
        "2. Review",
        "3. Return",
      ]);
    });

    it("attributes SKILL.md fallback steps to SKILL.md, not an unusable workflow", () => {
      const root = path.join(regressionRoot, "fallback-source");
      const result = parseProcedure({ skillRoot: root, catalog: [] });
      expect(result.graph.nodes.filter((node) => node.id.startsWith("step:")).every((node) => node.path === path.join(root, "SKILL.md"))).toBe(true);
    });

    it("keeps list boundaries, nested alternatives, fenced examples, and repeated numbering distinct", () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-boundaries-"));
      writeSkill(root, {
        "SKILL.md": `---
name: boundaries
---

## Instructions

1. Select input
   1. Red is an alternative
   1. Blue is another alternative
2. Process input

\`\`\`md
1. This example is not a step
2. Neither is this
\`\`\`

1. Return result

## Examples

1. Also not a step
`,
      });
      const result = parseProcedure({ skillRoot: root, catalog: [] });
      const steps = result.graph.nodes.filter((node) => node.id.startsWith("step:"));
      expect(steps.map((node) => node.id)).toEqual(["step:1", "step:2", "step:3"]);
      expect(steps.map((node) => node.label)).toEqual(["1. Select input", "2. Process input", "1. Return result"]);
      expect(steps.every((node) => node.source?.path === path.join(root, "SKILL.md"))).toBe(true);
      expect(result.graph.edges.filter((edge) => edge.from.startsWith("step:")).every((edge) => edge.relationship === "explicit")).toBe(true);
    });
  });

  it("preserves P/N rows as source evidence without inventing a DAG", () => {
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
    expect(result.diagnosis.confidence).toBe("partial");
    const runtime = result.graph.nodes.filter((node) => node.id.startsWith("step:"));
    expect(runtime.map((node) => node.label)).toEqual([
      "P. preflight", "N1. resolve", "N2a. attachments", "N2b. evidence", "N2c. prior",
      "N3. classify", "N4. inspect", "N4v. verify", "N5. synthesis", "N5v. review", "N6. validate", "N7. write",
    ]);
    expect(runtime.every((node) => node.source?.path.endsWith("references/workflow.md"))).toBe(true);
    expect(runtime.every((node) => node.source && node.source.startLine === node.source.endLine)).toBe(true);
    expect(result.graph.nodes.some((node) => node.kind === "gate")).toBe(false);
    expect(result.graph.edges.filter((edge) => edge.from.startsWith("step:") || edge.to.startsWith("step:"))).toHaveLength(0);
    expect(result.graph.edges).toContainEqual(
      expect.objectContaining({ from: "skill-md", to: "procedure-source" }),
    );
    expect(result.graph.edges).toContainEqual(
      expect.objectContaining({ from: "skill-md", to: "procedure-source", relationship: "inferred" }),
    );
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
    const evidence = result.graph.nodes.find((n) => n.label === "N2b. evidence");
    expect(evidence?.kind).toBe("agent");
    expect(evidence?.path).toBe(path.join(root, "references", "workflow.md"));
    expect(evidence?.resourcePath).toBe(path.join(home, ".claude", "agents", "worker-evidence.md"));
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

  it("leaves unsupported P/N relationships unresolved", () => {
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
    expect(result.diagnosis.confidence).toBe("partial");
    expect(result.graph.edges.filter((edge) => edge.from.startsWith("step:") || edge.to.startsWith("step:"))).toHaveLength(0);
  });

  it("does not infer a Question gate from step identifiers or names", () => {
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
    expect(result.graph.nodes.some((node) => node.kind === "gate")).toBe(false);
    expect(result.diagnosis.confidence).toBe("partial");
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
