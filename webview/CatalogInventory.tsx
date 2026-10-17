import type { ReactElement, Ref } from "react";
import type { SkillNode } from "@shared/protocol";
import { kindLabel } from "@shared/kind";
import { CatalogSearch } from "./CatalogSearch";
import { inventoryCounts, type InventoryCounts, type InventoryGroup } from "./inventoryGroups";
import { ShapeMark } from "./ShapeMark";
import { useCatalogSearch } from "./useCatalogSearch";

export type CatalogInventoryProps = {
  nodes: SkillNode[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onOpen: (nodeId: string) => void;
  searchRef?: Ref<HTMLInputElement>;
};

export function CatalogInventory({
  nodes,
  selectedId,
  onSelect,
  onOpen,
  searchRef,
}: CatalogInventoryProps): ReactElement {
  const search = useCatalogSearch(nodes);
  return (
    <div className="inventory">
      <InventoryHead counts={inventoryCounts(nodes)} />
      <CatalogSearch
        query={search.query}
        status={search.status}
        inputRef={searchRef}
        onQuery={search.onQuery}
        onKeyDown={search.onKeyDown}
      />
      <InventoryBody
        total={nodes.length}
        query={search.query}
        groups={search.groups}
        selectedId={selectedId}
        onSelect={onSelect}
        onOpen={onOpen}
      />
    </div>
  );
}

function InventoryHead({ counts }: { counts: InventoryCounts }): ReactElement {
  return (
    <header className="inventory-head">
      <div>
        <h2>Inventory</h2>
        <p className="hint">
          What this skill contains on disk. Open a file, or switch to Flow for supported instruction
          structure.
        </p>
      </div>
      <InventoryStats counts={counts} />
    </header>
  );
}

function InventoryStats({ counts }: { counts: InventoryCounts }): ReactElement {
  return (
    <div className="inventory-stats">
      <Stat value={counts.agents} label="agents" />
      <Stat value={counts.scripts} label="scripts" />
      <Stat value={counts.references} label="refs" />
      <Stat value={counts.handoffs} label="handoffs" />
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }): ReactElement {
  return (
    <span className="stat">
      <strong>{value}</strong>
      {label}
    </span>
  );
}

type InventoryBodyProps = {
  total: number;
  query: string;
  groups: InventoryGroup[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onOpen: (nodeId: string) => void;
};

function InventoryBody(props: InventoryBodyProps): ReactElement {
  return (
    <div className="inventory-body">
      {props.total === 0 ? (
        <p className="inventory-empty">
          No skill files found in this folder. Open a directory that contains <code>SKILL.md</code>.
        </p>
      ) : props.groups.length === 0 ? (
        <p className="inventory-empty">No files match &ldquo;{props.query.trim()}&rdquo;.</p>
      ) : (
        props.groups.map((group) => (
          <InventoryGroup
            key={group.id}
            group={group}
            selectedId={props.selectedId}
            onSelect={props.onSelect}
            onOpen={props.onOpen}
          />
        ))
      )}
    </div>
  );
}

type InventoryGroupProps = {
  group: InventoryGroup;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onOpen: (nodeId: string) => void;
};

function InventoryGroup({ group, selectedId, onSelect, onOpen }: InventoryGroupProps): ReactElement {
  return (
    <section className="inventory-group">
      <header className="inventory-group-head">
        <h3>{group.title}</h3>
        <span className="stat-pill">{group.nodes.length}</span>
      </header>
      <ul>
        {group.nodes.map((node) => (
          <InventoryRow
            key={node.id}
            node={node}
            selected={node.id === selectedId}
            onSelect={onSelect}
            onOpen={onOpen}
          />
        ))}
      </ul>
    </section>
  );
}

type InventoryRowProps = {
  node: SkillNode;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (nodeId: string) => void;
};

function InventoryRow({ node, selected, onSelect, onOpen }: InventoryRowProps): ReactElement {
  const className = selected ? "inventory-row is-selected" : "inventory-row";
  return (
    <li>
      <button
        type="button"
        className={className}
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => onOpen(node.id)}
      >
        <span className="inventory-row-main">
          <ShapeMark kind={node.kind} />
          <span className="inventory-label">{node.label}</span>
          <span className="inventory-kind">{kindLabel(node.kind)}</span>
        </span>
        {node.summary ? <span className="inventory-summary">{node.summary}</span> : null}
        <span className="inventory-path" title={node.path}>
          {node.path}
        </span>
      </button>
    </li>
  );
}
