import { isMap, parseDocument, type YAMLError } from "yaml";
import { frontmatterNeverCloses, stripBom } from "./text";

export interface Frontmatter {
  name: string;
  description: string;
  error?: string;
}

const NOT_A_MAPPING = "YAML frontmatter must be a mapping, not a single value.";

export function parseFrontmatter(text: string): Frontmatter {
  const source = stripBom(text);
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  const body = match?.[1];
  if (!body) return closedFrontmatter(source);
  const doc = parseDocument(body);
  if (doc.errors.length > 0) return { name: "", description: "", error: formatYamlError(doc.errors[0], 2) };
  if (doc.contents == null) return { name: "", description: "" };
  if (!isMap(doc.contents)) return { name: "", description: "", error: NOT_A_MAPPING };
  const parsed: unknown = doc.toJS();
  if (!isRecord(parsed)) return { name: "", description: "", error: NOT_A_MAPPING };
  return {
    name: typeof parsed.name === "string" ? parsed.name : "",
    description: typeof parsed.description === "string" ? parsed.description : "",
  };
}

function closedFrontmatter(source: string): Frontmatter {
  if (frontmatterNeverCloses(source)) {
    return { name: "", description: "", error: "Frontmatter is missing its closing ---." };
  }
  return { name: "", description: "" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parser line numbers are relative to the YAML body, which starts after the opening fence. */
function formatYamlError(error: YAMLError, bodyStartLine: number): string {
  const yamlLine = error.linePos?.[0]?.line;
  const fileLine = typeof yamlLine === "number" ? bodyStartLine + yamlLine - 1 : undefined;
  const detail = error.message
    .split("\n")[0]
    .slice(0, 500)
    .replace(/:?\s*at line \d+, column \d+:?\s*$/i, "")
    .replace(/\.+$/, "")
    .trim();
  const reason = detail || "Check its syntax in SKILL.md";
  return fileLine ? `Invalid YAML frontmatter at line ${String(fileLine)}: ${reason}.` : `Invalid YAML frontmatter: ${reason}.`;
}
