import type { ReactElement, Ref } from "react";
import type { SkillNode } from "@shared/protocol";
import { kindLabel } from "@shared/kind";
import { CatalogSearch } from "./CatalogSearch";
import { inventoryCounts, type InventoryGroup } from "./inventoryGroups";
import { ShapeMark } from "./ShapeMark";
import { useCatalogSearch } from "./useCatalogSearch";

export type { InventoryCounts, InventoryGroup, InventoryGroupId } from "./inventoryGroups";
export { groupInventory, inventoryCounts } from "./inventoryGroups";

function InventoryStats({ counts }: { counts: ReturnType<typeof inventoryCounts> }): ReactElement {
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
        onClick={() => {
          onSelect(node.id);
        }}
        onDoubleClick={() => {
          onOpen(node.id);
        }}
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

function NoMatch({ query }: { query: string }): ReactElement {
  return <p className="inventory-empty">No files match &ldquo;{query.trim()}&rdquo;.</p>;
}

interface InventoryBodyProps {
  total: number;
  query: string;
  groups: InventoryGroup[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onOpen: (nodeId: string) => void;
}

function InventoryBody(props: InventoryBodyProps): ReactElement {
  let body: ReactElement;
  if (props.total === 0) {
    body = <InventoryEmpty />;
  } else if (props.groups.length === 0) {
    body = <NoMatch query={props.query} />;
  } else {
    body = (
      <>
        {props.groups.map((group) => (
          <InventoryGroupSection
            key={group.id}
            group={group}
            selectedId={props.selectedId}
            onSelect={props.onSelect}
            onOpen={props.onOpen}
          />
        ))}
      </>
    );
  }
  return <div className="inventory-body">{body}</div>;
}

export interface CatalogInventoryProps {
  nodes: SkillNode[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onOpen: (nodeId: string) => void;
  searchRef?: Ref<HTMLInputElement>;
}

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
      <InventoryHeader nodes={nodes} />
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
