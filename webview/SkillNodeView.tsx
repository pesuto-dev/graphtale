import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { LayoutDirection, NodeKind, SkillNode } from "@shared/protocol";
import { kindClass, kindLabel, kindShape } from "@shared/kind";
import { ShapeMark } from "./ShapeMark";

export type SkillNodeData = SkillNode & {
  direction: LayoutDirection;
  expanded: boolean;
  /** Compact Flow overview chip (no expand / short chrome). */
  compact?: boolean;
};

/** Name exposed to assistive tech. Compact chips truncate the visible label. */
export function compactAccessibleName(kind: NodeKind, label: string): string {
  return `${kindLabel(kind)}: ${label}`;
}

export type SkillFlowNode = Node<SkillNodeData, "skill">;

function NodeMeta({ data }: { data: SkillNodeData }) {
  if (data.kind === "agent") {
    return <span className="agent-badge">agent</span>;
  }
  return (
    <>
      <span className="tag">{kindLabel(data.kind)}</span>
      {data.uses.length > 0 ? <span className="tag">{data.uses.length} uses</span> : null}
      {data.isBlock ? <span className="tag">block</span> : null}
      {data.pending ? <span className="tag">pending</span> : null}
    </>
  );
}

export function SkillNodeView({
  data,
  selected,
  sourcePosition,
  targetPosition,
}: NodeProps<SkillFlowNode>) {
  const direction = data.direction;
  const shape = kindShape(data.kind);
  const compact = Boolean(data.compact);
  const classes = [
    "skill-node",
    kindClass(data.kind),
    `shape-${shape}`,
    data.isEntry ? "is-entry" : "",
    data.pending ? "is-pending" : "",
    data.isBlock ? "is-block" : "",
    selected ? "is-selected" : "",
    data.expanded ? "is-expanded" : "",
    compact ? "is-compact" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Prefer layout-provided sides (Compact wrap uses Bottom/Top on row edges).
  const targetPos =
    targetPosition ?? (direction === "LR" ? Position.Left : Position.Top);
  const sourcePos =
    sourcePosition ?? (direction === "LR" ? Position.Right : Position.Bottom);

  if (compact) {
    return (
      <div className={classes}>
        <Handle type="target" id="in-left" position={Position.Left} />
        <Handle type="target" id="in-top" position={Position.Top} />
        <Handle type="target" id="in-bottom" position={Position.Bottom} />
        <Handle type="target" id="in-right" position={Position.Right} />
        <div className="skill-node-body skill-node-body-compact">
          <div className="skill-node-title-row">
            <ShapeMark kind={data.kind} />
            <div className="skill-node-title">{data.label}</div>
          </div>
        </div>
        <Handle type="source" id="out-right" position={Position.Right} />
        <Handle type="source" id="out-bottom" position={Position.Bottom} />
        <Handle type="source" id="out-top" position={Position.Top} />
        <Handle type="source" id="out-left" position={Position.Left} />
      </div>
    );
  }

  return (
    <div className={classes}>
      <Handle type="target" position={targetPos} />
      <div className="skill-node-body">
        <div className="skill-node-title-row">
          <ShapeMark kind={data.kind} />
          <div className="skill-node-title">{data.label}</div>
          {data.uses.length > 0 ? (
            <button
              type="button"
              className="expand-btn"
              data-expand={data.id}
              title={data.expanded ? "Collapse uses" : "Expand uses"}
              aria-label={data.expanded ? "Collapse uses" : "Expand uses"}
            >
              <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path
                  d={data.expanded ? "M3 8 L6 4 L9 8" : "M3 4 L6 8 L9 4"}
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="skill-node-meta">
          <NodeMeta data={data} />
        </div>
      </div>
      {data.expanded ? (
        <div className="skill-node-expand">
          {data.summary ? <p className="skill-node-summary">{data.summary}</p> : null}
          {data.uses.length > 0 ? (
            <div className="skill-node-uses">
              {data.uses.map((chip) => (
                <span
                  key={chip.label}
                  className={`chip ${chip.targetId ? "chip-link" : ""}`}
                  data-target-id={chip.targetId ?? ""}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <Handle type="source" position={sourcePos} />
    </div>
  );
}
