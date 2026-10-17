import type { SkillNode } from "@shared/protocol";

export type InventoryGroupId = "entry" | "agents" | "scripts" | "references" | "handoffs" | "other";

export interface InventoryGroup {
  id: InventoryGroupId;
  title: string;
  nodes: SkillNode[];
}

export interface InventoryCounts {
  agents: number;
  scripts: number;
  references: number;
  handoffs: number;
}

const ORDER: InventoryGroupId[] = ["entry", "agents", "scripts", "references", "handoffs", "other"];

const TITLES: Record<InventoryGroupId, string> = {
  entry: "Entry",
  agents: "Agents",
  scripts: "Scripts",
  references: "References & schemas",
  handoffs: "Handoffs",
  other: "Other",
};

export function groupInventory(nodes: SkillNode[]): InventoryGroup[] {
  const buckets = emptyBuckets();
  for (const node of nodes) {
    buckets.get(groupIdFor(node))?.push(node);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => a.label.localeCompare(b.label));
  }
  return ORDER.map((id) => ({ id, title: TITLES[id], nodes: buckets.get(id) ?? [] })).filter(
    (group) => group.nodes.length > 0,
  );
}

export function inventoryCounts(nodes: SkillNode[]): InventoryCounts {
  return {
    agents: nodes.filter((node) => node.kind === "agent").length,
    scripts: nodes.filter((node) => node.kind === "script").length,
    references: nodes.filter((node) => node.kind === "reference" || node.kind === "shared").length,
    handoffs: nodes.filter(isHandoff).length,
  };
}

function emptyBuckets(): Map<InventoryGroupId, SkillNode[]> {
  const buckets = new Map<InventoryGroupId, SkillNode[]>();
  for (const id of ORDER) {
    buckets.set(id, []);
  }
  return buckets;
}

function groupIdFor(node: SkillNode): InventoryGroupId {
  if (node.isEntry || node.id === "skill-md") {
    return "entry";
  }
  switch (node.kind) {
    case "agent":
      return "agents";
    case "script":
      return "scripts";
    case "reference":
    case "shared":
      return "references";
    case "skill":
      return "handoffs";
    case "gate":
      return "other";
    default: {
      const exhaustive: never = node.kind;
      return exhaustive;
    }
  }
}

function isHandoff(node: SkillNode): boolean {
  return node.kind === "skill" && !node.isEntry && node.id !== "skill-md";
}
