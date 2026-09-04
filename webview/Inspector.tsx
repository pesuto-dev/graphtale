import Markdown from "react-markdown";
import type { FileContentPayload, SkillEdge, SkillNode } from "@shared/protocol";
import { kindLabel } from "@shared/kind";
import { vscode } from "./vscode";
import { ShapeMark } from "./ShapeMark";

export function Inspector({
  node,
  content,
  edges,
  nodes,
  onSelectNode,
}: {
  node: SkillNode | undefined;
  content: FileContentPayload | undefined;
  edges: SkillEdge[];
  nodes: SkillNode[];
  onSelectNode: (id: string) => void;
}) {
  if (!node) {
    return (
      <section className="inspector">
        <header className="inspector-head">
          <div>
            <h2>Inspector</h2>
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
    node.kind === "gate" ? "validation" : node.isBlock ? "block" : "file";

  return (
    <section className="inspector">
      <header className="inspector-head">
        <div>
          <h2>{node.label}</h2>
          <p className="path">{node.path}</p>
        </div>
        <div className="inspector-actions">
          <span className="status-pill on">{badge}</span>
          <button
            type="button"
            onClick={() => vscode.postMessage({ type: "openFile", path: node.path })}
          >
            Open file
          </button>
        </div>
      </header>

      {node.kind === "gate" ? (
        <div className="callout muted">
          <strong>Validation step.</strong>
          Gates do not own a full skill file. They are checks the workflow must
          pass before the next agent or skill runs.
        </div>
      ) : node.isBlock ? (
        <div className="callout">
          <strong>Lock rule.</strong>
          This is a block. Only the agent segment is shown in full. Dim text is
          from SKILL.md. Open file edits the agent markdown in Cursor or VS Code.
        </div>
      ) : (
        <div className="callout muted">
          <strong>File open.</strong>
          Edit this markdown in Cursor or VS Code. Open file, or double-click
          the node. Refresh the graph after AI or editor changes.
        </div>
      )}

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
            onDoubleClick={() => vscode.postMessage({ type: "openFile", path: wrapper.path })}
          >
            {wrapper.prefix}
          </pre>
          <div className="md">
            <Markdown>{text}</Markdown>
          </div>
          <pre
            className="dim"
            onDoubleClick={() => vscode.postMessage({ type: "openFile", path: wrapper.path })}
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
                {edge.label ? `${edge.label} → ${target.label}` : target.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
