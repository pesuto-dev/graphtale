import { addLink, type EdgeState } from "./pnLinks";

const PN_ID = "(P|N\\d+[a-z]?)";

export function addProseEdges(state: EdgeState): void {
  for (let index = 0; index < state.lines.length; index++) {
    const line = (state.lines[index] ?? "").trim();
    acceptProseLine(state, line, index + 1);
  }
}

function acceptProseLine(state: EdgeState, line: string, lineNumber: number): void {
  if (addArrow(state, line, lineNumber)) return;
  if (/^\s*(P|N\d+[a-z]?)\s*(?:->|→)/i.test(line)) {
    state.invalid = true;
    return;
  }
  if (addSequential(state, line, lineNumber)) return;
  if (addParallelProse(state, line, lineNumber)) return;
  if (addJoinProse(state, line, lineNumber)) return;
  addConditional(state, line, lineNumber);
}

function addArrow(state: EdgeState, line: string, lineNumber: number): boolean {
  const edge = line.match(/^(P|N\d+[a-z]?)\s*(?:->|→)\s*(P|N\d+[a-z]?)(?:\s+\(([^)]+)\))?\s*$/i);
  if (!edge) return false;
  addLink(state, { fromId: edge[1] ?? "", toId: edge[2] ?? "", line: lineNumber, label: edge[3] });
  return true;
}

function addSequential(state: EdgeState, line: string, lineNumber: number): boolean {
  const sequential = line.match(new RegExp(`^${PN_ID}\\s+(?:then|next|(?:is\\s+)?followed by|continue(?:s)?\\s+(?:with|to)|go(?:es)?\\s+to)\\s+${PN_ID}\\.?$`, "i"));
  if (!sequential) return false;
  addLink(state, { fromId: sequential[1] ?? "", toId: sequential[2] ?? "", line: lineNumber });
  return true;
}

function addParallelProse(state: EdgeState, line: string, lineNumber: number): boolean {
  const parallel = line.match(new RegExp(`^From\\s+${PN_ID},\\s*(?:run|start|perform)\\s+(.+?)\\s+in\\s+parallel\\.?$`, "i"));
  if (!parallel) return false;
  const targets = listIds(parallel[2] ?? "");
  if (!targets) {
    state.invalid = true;
    return true;
  }
  for (const target of targets) addLink(state, { fromId: parallel[1] ?? "", toId: target, line: lineNumber });
  return true;
}

function addJoinProse(state: EdgeState, line: string, lineNumber: number): boolean {
  const join = line.match(new RegExp(`^After\\s+(.+?),\\s*(?:continue|go)\\s+(?:with|to)\\s+${PN_ID}\\.?$`, "i"));
  if (!join) return false;
  const sources = listIds(join[1] ?? "");
  if (!sources) {
    state.invalid = true;
    return true;
  }
  for (const source of sources) addLink(state, { fromId: source, toId: join[2] ?? "", line: lineNumber });
  return true;
}

function addConditional(state: EdgeState, line: string, lineNumber: number): void {
  const conditional = line.match(new RegExp(`^From\\s+${PN_ID},\\s*if\\s+(.+?),\\s*continue\\s+(?:with|to)\\s+${PN_ID};\\s*otherwise,\\s*(?:continue\\s+(?:with|to)\\s+)?${PN_ID}\\.?$`, "i"));
  if (!conditional) return;
  addLink(state, { fromId: conditional[1] ?? "", toId: conditional[3] ?? "", line: lineNumber, label: `if ${conditional[2] ?? ""}` });
  addLink(state, { fromId: conditional[1] ?? "", toId: conditional[4] ?? "", line: lineNumber, label: "otherwise" });
}

function listIds(value: string): string[] | undefined {
  const ids = [...value.matchAll(new RegExp(PN_ID, "gi"))].map((match) => match[1] ?? "").filter((id) => id);
  const rest = value.replace(new RegExp(PN_ID, "gi"), "").replace(/\b(?:and|,|\s)+\b/gi, "").trim();
  return ids.length > 0 && rest === "" ? ids : undefined;
}
