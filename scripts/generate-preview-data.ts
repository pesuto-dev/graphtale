/**
 * Writes webview/preview-data.json from real parsers (read-only; never mutates skills).
 * Default fixture: fixtures/analyse-ticket-pn (synthetic P/N golden).
 *
 * Usage:
 *   npx tsx scripts/generate-preview-data.ts
 *   PREVIEW_SKILL=fixtures/analyse-ticket npx tsx scripts/generate-preview-data.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverSkills } from "../src/discover.ts";
import { parseProcedure } from "../src/parseProcedure.ts";
import { parseSkill } from "../src/parseSkill.ts";
import type { HostToWebview } from "../src/shared/protocol.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillRoot = path.resolve(
  root,
  process.env.PREVIEW_SKILL ?? "fixtures/analyse-ticket-pn",
);
const outFile = path.join(root, "webview/preview-data.json");
const emptyHome = path.join(root, "fixtures/empty-home");
const projectFolder = path.join(root, "fixtures/project");

const catalog = discoverSkills({
  workspaceFolders: [projectFolder],
  homedir: emptyHome,
});

const graph = parseSkill({
  skillRoot,
  catalog,
  homedir: emptyHome,
});
const { graph: procedure, diagnosis } = parseProcedure({
  skillRoot,
  catalog,
  homedir: emptyHome,
});

const message: HostToWebview = {
  type: "graph",
  graph,
  procedure,
  pipeline: procedure,
  diagnosis,
  catalog,
  direction: "TB",
};

fs.writeFileSync(outFile, JSON.stringify(message, null, 2) + "\n", "utf8");
console.log(
  `Wrote ${path.relative(root, outFile)} from ${path.relative(root, skillRoot)} ` +
    `(catalog ${graph.nodes.length} nodes, procedure ${procedure.nodes.length} nodes, ${diagnosis.confidence})`,
);
