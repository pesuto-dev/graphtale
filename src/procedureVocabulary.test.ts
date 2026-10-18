import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, expect, it } from "vitest";
import { parseProcedure } from "./parseProcedure";
import { ENGLISH, languagesFile, loadVocabulary } from "./procedureVocabulary";
import { STEP_SECTION_HEADINGS } from "./shared/protocol";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

function writeLanguages(home: string, body: string): void {
  fs.mkdirSync(path.dirname(languagesFile(home)), { recursive: true });
  fs.writeFileSync(languagesFile(home), body);
}

const DUTCH_SKILL = "# Skill\n\n## Werkwijze\n\n1. Lees de melding.\n2. Classificeer.\n\n## Voorbeelden\n\n1. Een voorbeeld.\n";
const DUTCH = JSON.stringify({ languages: { nl: { steps: ["Werkwijze"], skip: ["Voorbeelden"] } } });

function parseDutch(home: string) {
  const root = tempDir("vocab-skill-");
  fs.writeFileSync(path.join(root, "SKILL.md"), DUTCH_SKILL);
  return parseProcedure({ skillRoot: root, catalog: [], homedir: home });
}

it("recognizes every listed English step heading", () => {
  expect(STEP_SECTION_HEADINGS.every(heading => ENGLISH.isStepSection(heading))).toBe(true);
});

it("uses English only when no languages file exists", () => {
  const loaded = loadVocabulary(tempDir("vocab-home-"));
  expect(loaded.vocabulary).toBe(ENGLISH);
  expect(loaded.warning).toBeUndefined();
});

it("reads step and skip headings for a registered language", () => {
  const home = tempDir("vocab-home-");
  writeLanguages(home, DUTCH);
  const result = parseDutch(home);
  expect(result.graph.nodes.filter(node => node.id.startsWith("step:")).map(node => node.label)).toEqual([
    "1. Lees de melding.",
    "2. Classificeer.",
  ]);
  expect(result.diagnosis.confidence).toBe("high");
  expect(result.diagnosis.fixPrompt).toContain("adds: nl");
});

it("matches registered headings as whole words, including accented letters", () => {
  const home = tempDir("vocab-home-");
  writeLanguages(home, JSON.stringify({ languages: { fr: { steps: ["Étapes"], skip: ["Exemples"] } } }));
  const { vocabulary } = loadVocabulary(home);
  expect(vocabulary.isStepSection("étapes à suivre")).toBe(true);
  expect(vocabulary.isStepSection("Étapesx")).toBe(false);
  expect(vocabulary.isSkipSection("Quelques exemples")).toBe(true);
});

it("falls back to English with a warning when the file is not valid JSON", () => {
  const home = tempDir("vocab-home-");
  writeLanguages(home, "{ nope");
  const loaded = loadVocabulary(home);
  expect(loaded.vocabulary).toBe(ENGLISH);
  expect(loaded.warning).toMatch(/not valid JSON/);
});

it("falls back to English with a warning when the shape is wrong", () => {
  const home = tempDir("vocab-home-");
  writeLanguages(home, JSON.stringify({ nl: ["Werkwijze"] }));
  expect(loadVocabulary(home).warning).toMatch(/expected/);
});

it("accepts a languages file that starts with a byte-order mark", () => {
  const home = tempDir("vocab-home-");
  writeLanguages(home, `\ufeff${DUTCH}`);
  const loaded = loadVocabulary(home);
  expect(loaded.warning).toBeUndefined();
  expect(loaded.vocabulary.languages).toEqual(["nl"]);
});

it("reads a registered language from a CRLF skill", () => {
  const home = tempDir("vocab-home-");
  writeLanguages(home, DUTCH);
  const root = tempDir("vocab-skill-");
  fs.writeFileSync(path.join(root, "SKILL.md"), DUTCH_SKILL.replace(/\n/g, "\r\n"));
  const result = parseProcedure({ skillRoot: root, catalog: [], homedir: home });
  expect(result.graph.nodes.filter(node => node.id.startsWith("step:"))).toHaveLength(2);
  expect(result.diagnosis.confidence).toBe("high");
});
