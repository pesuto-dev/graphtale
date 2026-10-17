import { useState, type KeyboardEvent, type Ref } from "react";
import type { SkillNode } from "@shared/protocol";
import { kindLabel } from "@shared/kind";
import { filterCatalogNodes } from "./findInView";
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

export function CatalogInventory({
  nodes,
  selectedId,
  onSelect,
  onOpen,
  searchRef,
}: {
  nodes: SkillNode[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onOpen: (nodeId: string) => void;
  searchRef?: Ref<HTMLInputElement>;
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const filtered = filterCatalogNodes(nodes, query);
  const groups = groupInventory(filtered);
  const counts = {
    agents: nodes.filter((n) => n.kind === "agent").length,
    scripts: nodes.filter((n) => n.kind === "script").length,
    references: nodes.filter((n) => n.kind === "reference" || n.kind === "shared").length,
    handoffs: nodes.filter((n) => n.kind === "skill" && !n.isEntry && n.id !== "skill-md").length,
  };

  return (
    <div className="inventory">
      <header className="inventory-head">
        <div>
          <h2>Inventory</h2>
          <p className="hint">
            What this skill contains on disk. Open a file, or switch to Flow for supported instruction
            structure.
          </p>
        </div>
        <div className="inventory-stats">
          <span className="stat">
            <strong>{counts.agents}</strong>agents
          </span>
          <span className="stat">
            <strong>{counts.scripts}</strong>scripts
          </span>
          <span className="stat">
            <strong>{counts.references}</strong>refs
          </span>
          <span className="stat">
            <strong>{counts.handoffs}</strong>handoffs
          </span>
        </div>
      </header>
      <div className="inventory-search search-field">
        <label htmlFor="catalog-search">Search files</label>
        <input
          id="catalog-search"
          ref={searchRef}
          type="search"
          value={query}
          placeholder="Name, path, or description"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={trimmed ? "catalog-search-status" : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Escape" && query) {
              event.preventDefault();
              setQuery("");
            }
          }}
        />
        {trimmed ? (
          <p id="catalog-search-status" className="inventory-search-status" role="status">
            {filtered.length === 0
              ? `No files match "${trimmed}".`
              : `${filtered.length} of ${nodes.length} files`}
          </p>
        ) : null}
      </div>
      <div className="inventory-body">
        {nodes.length === 0 ? (
          <p className="inventory-empty">
            No skill files found in this folder. Open a directory that contains{" "}
            <code>SKILL.md</code>.
          </p>
        ) : groups.length === 0 ? (
          <p className="inventory-empty">No files match &ldquo;{trimmed}&rdquo;.</p>
        ) : (
          groups.map((group) => (
            <section key={group.id} className="inventory-group">
              <header className="inventory-group-head">
                <h3>{group.title}</h3>
                <span className="stat-pill">{group.nodes.length}</span>
              </header>
              <ul>
                {group.nodes.map((node) => {
                  const selected = node.id === selectedId;
                  return (
                    <li key={node.id}>
                      <button
                        type="button"
                        className={selected ? "inventory-row is-selected" : "inventory-row"}
                        onClick={() => onSelect(node.id)}
                        onDoubleClick={() => onOpen(node.id)}
                      >
                        <span className="inventory-row-main">
                          <ShapeMark kind={node.kind} />
                          <span className="inventory-label">{node.label}</span>
                          <span className="inventory-kind">{kindLabel(node.kind)}</span>
                        </span>
                        {node.summary ? (
                          <span className="inventory-summary">{node.summary}</span>
                        ) : null}
                        <span className="inventory-path" title={node.path}>
                          {node.path}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
