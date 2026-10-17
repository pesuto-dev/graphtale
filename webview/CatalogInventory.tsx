import type { ReactElement } from "react";
import type { SkillNode } from "@shared/protocol";
import { kindLabel } from "@shared/kind";
import { ShapeMark } from "./ShapeMark";

export type InventoryGroupId = "entry" | "agents" | "scripts" | "references" | "handoffs" | "other";

export type InventoryGroup = {
  id: InventoryGroupId;
  title: string;
  nodes: SkillNode[];
};

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
      const _exhaustive: never = node.kind;
      return _exhaustive;
    }
  }
}

const ORDER: InventoryGroupId[] = [
  "entry",
  "agents",
  "scripts",
  "references",
  "handoffs",
  "other",
];

const TITLES: Record<InventoryGroupId, string> = {
  entry: "Entry",
  agents: "Agents",
  scripts: "Scripts",
  references: "References & schemas",
  handoffs: "Handoffs",
  other: "Other",
};

export function groupInventory(nodes: SkillNode[]): InventoryGroup[] {
  const buckets = new Map<InventoryGroupId, SkillNode[]>();
  for (const id of ORDER) {
    buckets.set(id, []);
  }
  for (const node of nodes) {
    buckets.get(groupIdFor(node))?.push(node);
  }
  for (const list of buckets.values()) {
    list.sort((a, b) => a.label.localeCompare(b.label));
  }
  return ORDER.map((id) => ({
    id,
    title: TITLES[id],
    nodes: buckets.get(id) ?? [],
  })).filter((group) => group.nodes.length > 0);
}

export type InventoryCounts = {
  agents: number;
  scripts: number;
  references: number;
  handoffs: number;
};

export function inventoryCounts(nodes: SkillNode[]): InventoryCounts {
  return {
    agents: nodes.filter((item) => item.kind === "agent").length,
    scripts: nodes.filter((item) => item.kind === "script").length,
    references: nodes.filter((item) => item.kind === "reference" || item.kind === "shared").length,
    handoffs: nodes.filter((item) => item.kind === "skill" && !item.isEntry && item.id !== "skill-md").length,
  };
}

function InventoryStats({ counts }: { counts: InventoryCounts }): ReactElement {
  return (
    <div className="inventory-stats">
      <span className="stat"><strong>{counts.agents}</strong>agents</span>
      <span className="stat"><strong>{counts.scripts}</strong>scripts</span>
      <span className="stat"><strong>{counts.references}</strong>refs</span>
      <span className="stat"><strong>{counts.handoffs}</strong>handoffs</span>
    </div>
  );
}

function InventoryRow({
  node,
  selected,
  onSelect,
  onOpen,
}: {
  node: SkillNode;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (nodeId: string) => void;
}): ReactElement {
  return (
    <li>
      <button
        type="button"
        className={selected ? "inventory-row is-selected" : "inventory-row"}
        aria-current={selected ? "true" : undefined}
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => onOpen(node.id)}
      >
        <span className="inventory-row-main">
          <ShapeMark kind={node.kind} />
          <span className="inventory-label">{node.label}</span>
          <span className="inventory-kind">{kindLabel(node.kind)}</span>
        </span>
        {node.summary ? <span className="inventory-summary">{node.summary}</span> : null}
        <span className="inventory-path" title={node.path}>{node.path}</span>
      </button>
    </li>
  );
}

function InventoryEmpty(): ReactElement {
  return (
    <p className="inventory-empty">
      No skill files found in this folder. Open a directory that contains <code>SKILL.md</code>.
    </p>
  );
}

function InventoryGroupSection({
  group,
  selectedId,
  onSelect,
  onOpen,
}: {
  group: InventoryGroup;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onOpen: (nodeId: string) => void;
}): ReactElement {
  return (
    <section className="inventory-group">
      <header className="inventory-group-head">
        <h3>{group.title}</h3>
        <span className="stat-pill">{group.nodes.length}</span>
      </header>
      <ul>
        {group.nodes.map((item) => (
          <InventoryRow
            key={item.id}
            node={item}
            selected={item.id === selectedId}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}

function InventoryHeader({ nodes }: { nodes: SkillNode[] }): ReactElement {
  return (
    <header className="inventory-head">
      <div>
        <h2>Inventory</h2>
        <p className="hint">
          What this skill contains on disk. Open a file, or switch to Flow for supported instruction
          structure.
        </p>
      </div>
      <InventoryStats counts={inventoryCounts(nodes)} />
    </header>
  );
}

export function CatalogInventory({
  nodes,
  selectedId,
  onSelect,
  onOpen,
}: {
  nodes: SkillNode[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onOpen: (nodeId: string) => void;
}): ReactElement {
  const groups = groupInventory(nodes);
  return (
    <div className="inventory">
      <InventoryHeader nodes={nodes} />
      <div className="inventory-body">
        {groups.length === 0 ? (
          <InventoryEmpty />
        ) : (
          groups.map((group) => (
            <InventoryGroupSection
              key={group.id}
              group={group}
              selectedId={selectedId}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </div>
  );
}
