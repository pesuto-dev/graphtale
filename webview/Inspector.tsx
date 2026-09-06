import Markdown from "react-markdown";
import type { FileContentPayload, SkillEdge, SkillNode } from "@shared/protocol";
import { kindLabel } from "@shared/kind";
import { vscode } from "./vscode";
import { ShapeMark } from "./ShapeMark";

export function Inspector({
  open,
  onToggle,
  node,
  content,
  edges,
  nodes,
  onSelectNode,
}: {
  open: boolean;
  onToggle: () => void;
  node: SkillNode | undefined;
  content: FileContentPayload | undefined;
  edges: SkillEdge[];
  nodes: SkillNode[];
  onSelectNode: (id: string) => void;
}) {
  if (!open) return <section className="inspector collapsed"><button onClick={onToggle} aria-expanded={false}>Show inspector</button><span className="hint">Select a step to inspect its source.</span></section>;
  if (!node) {
    return (
      <section className="inspector">
        <header className="inspector-head">
          <div>
            <h2>Inspector</h2><button onClick={onToggle} aria-expanded={true}>Hide inspector</button>
            <p className="hint">Select a node to read the file it belongs to.</p>
          </div>
        </header>
      </section>
    );
  }

  const text = content?.nodeId === node.id ? content.text : "";
  const wrapper = content?.nodeId === node.id ? content.wrapper : undefined;
  const outgoing = edges
    .filter((edge) => edge.from === node.id)
    .map((edge) => ({ edge, target: nodes.find((item) => item.id === edge.to) }))
    .filter((item): item is { edge: SkillEdge; target: SkillNode } => Boolean(item.target));

  const badge =
    node.kind === "gate" ? "branch" : node.isBlock ? "block" : "file";

  return (
    <section className="inspector">
      <header className="inspector-head">
        <div>
          <h2>{node.label}</h2>
          <p className="path">{node.path}{node.source ? ` · lines ${node.source.startLine}–${node.source.endLine}` : ""}</p>
        </div>
        <div className="inspector-actions">
          <button onClick={onToggle} aria-expanded={true}>Hide inspector</button>
          <span className="status-pill on">{badge}</span>
          {node.resourcePath ? <button onClick={() => vscode.postMessage({ type: "openFile", nodeId: node.id, target: "resource" })}>Open referenced resource</button> : null}
          <button
            type="button"
            onClick={() => vscode.postMessage({ type: "openFile", nodeId: node.id })}
          >
            {node.source ? "Open instruction" : "Open file"}
          </button>
        </div>
      </header>

      <div className="callout muted">
        {node.source ? "This is instruction text from the source, not an execution trace." : "This file belongs to the skill’s discovered inventory."}
        {node.kind === "gate" ? " Its outgoing branches are stated in the source." : ""}
      </div>
      {content?.nodeId === node.id && content.notice ? <p role="status" className="callout">{content.notice}</p> : null}

      <div className="inspector-meta">
        <ShapeMark kind={node.kind} />
        <span>{kindLabel(node.kind)}</span>
        {node.isEntry ? <span className="status-pill on">entry</span> : null}
      </div>

      {node.summary ? <p className="summary">{node.summary}</p> : null}

      {node.uses.length > 0 ? (
        <div className="uses">
          {node.uses.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className={`chip ${chip.targetId ? "chip-link" : ""}`}
              disabled={!chip.targetId}
              onClick={() => {
                if (chip.targetId) {
                  onSelectNode(chip.targetId);
                }
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      {wrapper ? (
        <div className="block-view">
          <pre
            className="dim"
            onDoubleClick={() => vscode.postMessage({ type: "openFile", nodeId: node.id, target: "wrapper" })}
          >
            {wrapper.prefix}
          </pre>
          <div className="md">
            <Markdown>{text}</Markdown>
          </div>
          <pre
            className="dim"
            onDoubleClick={() => vscode.postMessage({ type: "openFile", nodeId: node.id, target: "wrapper" })}
          >
            {wrapper.suffix}
          </pre>
        </div>
      ) : (
        <div className="md">
          <Markdown>{text}</Markdown>
        </div>
      )}

      {outgoing.length > 0 ? (
        <div className="outgoing">
          <p className="hint">Outgoing flow</p>
          <div className="uses">
            {outgoing.map(({ edge, target }) => (
              <button
                key={target.id}
                type="button"
                className="chip chip-link"
                onClick={() => onSelectNode(target.id)}
              >
                {edge.label ? `${edge.label} → ${target.label}` : target.label}{edge.relationship ? ` (${edge.relationship})` : ""}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
