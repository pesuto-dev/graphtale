import * as fs from "node:fs";
import * as path from "node:path";
import { readTextFile } from "./fileAccess";
import { STEP_SECTION_HEADINGS } from "./shared/protocol";
import { stripBom } from "./text";

/** Heading words that decide which sections hold steps and which sections are skipped. */
export interface Vocabulary {
  isStepSection: (title: string) => boolean;
  isSkipSection: (title: string) => boolean;
  /** Language codes added from languages.json, in file order. */
  languages: string[];
}

const ENGLISH_STEPS = new RegExp(`^(${STEP_SECTION_HEADINGS.join("|")})(?:\\b|$)`, "i");
const ENGLISH_SKIP = /\b(examples?|alternatives?|options?|appendix|notes|reference|choices)\b/i;
const LANGUAGES_LIMIT_BYTES = 64 * 1024;

export const ENGLISH: Vocabulary = {
  isStepSection: title => ENGLISH_STEPS.test(title),
  isSkipSection: title => ENGLISH_SKIP.test(title),
  languages: [],
};

export function languagesFile(homedir: string): string {
  return path.join(homedir, ".graphtale", "languages.json");
}

export interface LoadedVocabulary { vocabulary: Vocabulary; warning?: string }

/** English plus the languages the user registered. A broken file falls back to English with a warning. */
export function loadVocabulary(homedir: string): LoadedVocabulary {
  const file = languagesFile(homedir);
  if (!fs.existsSync(file)) return { vocabulary: ENGLISH };
  const read = readTextFile(file, LANGUAGES_LIMIT_BYTES);
  const ignored = `${file} was ignored: `;
  if (read.warning) return { vocabulary: ENGLISH, warning: `${ignored}${read.warning}` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripBom(read.text));
  } catch {
    return { vocabulary: ENGLISH, warning: `${ignored}it is not valid JSON. Only English headings are recognized.` };
  }
  const entries = languageEntries(parsed);
  if (!entries) return { vocabulary: ENGLISH, warning: `${ignored}expected { "languages": { "<code>": { "steps": [], "skip": [] } } }.` };
  return { vocabulary: withLanguages(entries) };
}

interface LanguageEntry { code: string; steps: string[]; skip: string[] }

function languageEntries(value: unknown): LanguageEntry[] | undefined {
  if (!isRecord(value) || !isRecord(value.languages)) return undefined;
  return Object.entries(value.languages).flatMap(([code, entry]) => {
    if (!isRecord(entry)) return [];
    return [{ code, steps: words(entry.steps), skip: words(entry.skip) }];
  });
}

function withLanguages(entries: LanguageEntry[]): Vocabulary {
  const steps = wordPattern(entries.flatMap(entry => entry.steps), "^");
  const skip = wordPattern(entries.flatMap(entry => entry.skip), "(?<![\\p{L}\\p{N}])");
  return {
    isStepSection: title => ENGLISH.isStepSection(title) || (steps?.test(title) ?? false),
    isSkipSection: title => ENGLISH.isSkipSection(title) || (skip?.test(title) ?? false),
    languages: entries.map(entry => entry.code),
  };
}

/** Whole-word, case-insensitive match that also works for accented letters. */
function wordPattern(list: string[], prefix: string): RegExp | undefined {
  if (list.length === 0) return undefined;
  const alternatives = list.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`${prefix}(?:${alternatives})(?![\\p{L}\\p{N}])`, "iu");
}

function words(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map(item => item.trim()) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
