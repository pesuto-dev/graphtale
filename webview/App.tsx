import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Background, Controls } from "@xyflow/react";
import { diagnosisNeededWhen, diagnosisTitle } from "@shared/protocol";
import { toFlow } from "./layout";
import { toCompactFlow } from "./compactLayout";
import { CatalogInventory } from "./CatalogInventory";
import { Inspector } from "./Inspector";
import { Legend } from "./Legend";
import {
  COMPACT_FIT_VIEW_OPTIONS,
  FIT_VIEW_OPTIONS,
  defaultEdgeOptions,
  edgeTypes,
  nodeTypes,
} from "./appConfig";
import { presentEdges } from "./edges";
import { useHostMessages } from "./useHostMessages";
import { useViewState } from "./useViewState";
import { vscode } from "./vscode";

export function App() {
  return (
    <ReactFlowProvider>
      <AppShell />
    </ReactFlowProvider>
  );
}

function AppShell() {
  const state = useViewState();
  useHostMessages(state);

  const showDiagnosis = state.view === "flow" && state.diagnosis.confidence !== "high";
  const display = state.view === "flow" ? state.procedure : state.graph;
  const selected = display.nodes.find((node) => node.id === state.selectedId);
  const flow =
    state.view === "flow" && state.compact
      ? toCompactFlow(display.nodes, display.edges, state.narrow ? 2 : 4)
      : toFlow(display.nodes, display.edges, state.direction, state.expandedIds);
  const agentCount = display.nodes.filter((node) => node.kind === "agent").length;
  const gateCount = display.nodes.filter((node) => node.kind === "gate").length;
  const scriptCount = display.nodes.filter((node) => node.kind === "script").length;
  const inventoryCount = state.view === "flow" && state.compact
    ? flow.nodes.length
    : display.nodes.length;

  return (
    <div className={state.inspectorOpen ? "app" : "app inspector-closed"}>
      <header className="toolbar">
        <div>
          <div className="title-row">
            <h1>{state.graph.skillName || "Graphtale"}</h1>
            <span className="status-pill on">viewer</span>
          </div>
          <div className="view-tabs">
            <button
              type="button"
              className={state.view === "flow" ? "active" : ""}
              onClick={() => state.switchView("flow")}
            >
              Flow
            </button>
            <button
              type="button"
              className={state.view === "catalog" ? "active" : ""}
              onClick={() => state.switchView("catalog")}
            >
              Catalog
            </button>
          </div>
          <p className="hint">
            {state.stale
              ? "Skill files changed in Cursor or VS Code. Refresh to update the graph."
              : state.view === "flow"
                ? state.compact
                  ? "Compact overview of the same instructions. Zoom or pan for detail."
                  : "Supported instruction structure, linked to its source. Dashed edges show inferred or unresolved relationships."
                : "Files and references found for this skill. Catalog does not imply execution order."}
          </p>
        </div>
        <div className="toolbar-stats">
          <span className="stat">
            <strong>{inventoryCount}</strong>
            {state.view === "flow" ? (state.compact ? "shown" : "steps") : "nodes"}
          </span>
          <span className="stat">
            <strong>{agentCount}</strong>
            agents
          </span>
          {state.view === "flow" ? (
            <span className="stat">
              <strong>{scriptCount > 0 ? scriptCount : gateCount}</strong>
              {scriptCount > 0 ? "scripts" : "gates"}
            </span>
          ) : null}
          <button
            type="button"
            className={state.stale ? "refresh-btn is-stale" : "refresh-btn"}
            onClick={() => vscode.postMessage({ type: "refresh" })}
          >
            {state.stale ? "Refresh · files changed" : "Refresh"}
          </button>
          {state.view === "flow" ? (
            <button
              type="button"
              className={state.compact ? "active" : ""}
              onClick={() => {
                state.setCompact((value) => !value);
                state.setExpandedIds([]);
                state.setFitNonce((nonce) => nonce + 1);
              }}
            >
              Compact
            </button>
          ) : null}
          {state.view === "flow" && !state.compact ? (
            <button type="button" onClick={state.toggleDirection}>
              Layout {state.direction === "LR" ? "left to right" : "top to bottom"}
            </button>
          ) : null}
        </div>
      </header>
      <div className="main main-procedure">
        {state.error ? <div className="error-banner" role="alert"><span>{state.error.message}</span>{state.error.retryable ? <button onClick={() => vscode.postMessage({ type: "refresh" })}>Retry</button> : null}</div> : null}
        <div className="graph-pane">
          {(state.graph.warnings?.length || state.procedure.warnings?.length) ? <details className="read-warnings"><summary>Some files or steps could not be fully read</summary><ul>{[...new Set([...(state.graph.warnings ?? []), ...(state.procedure.warnings ?? [])])].map(warning => <li key={warning}>{warning}</li>)}</ul></details> : null}
          {showDiagnosis ? (
            <div className={`diagnosis-banner confidence-${state.diagnosis.confidence}`}>
              <div className="diagnosis-copy">
                <strong>{diagnosisTitle(state.diagnosis.confidence)}</strong>
                <p>{state.diagnosis.message}</p>
                <p className="diagnosis-hint">{diagnosisNeededWhen(state.diagnosis.confidence)}</p>
                {state.copyState === "failed" && state.diagnosis.fixPrompt ? (
                  <pre className="fix-prompt-text" tabIndex={0}>
                    {state.diagnosis.fixPrompt}
                  </pre>
                ) : null}
              </div>
              <div className="diagnosis-actions">
              <button type="button" onClick={() => state.switchView("catalog")}>Inspect files in Catalog</button>
              <details><summary>Optional: clarify the step structure</summary>
              <button type="button" className="fix-prompt-btn" onClick={() => state.copyFixPrompt()}>
                {state.copyState === "copied"
                  ? "Copied. Paste in chat"
                  : state.copyState === "failed"
                    ? "Copy failed. Select the prompt text"
                    : "Copy clarification prompt"}
              </button></details></div>
            </div>
          ) : null}
          {state.view === "catalog" ? (
            <CatalogInventory
              nodes={display.nodes}
              selectedId={state.selectedId}
              onSelect={state.selectNode}
              onOpen={(nodeId) => vscode.postMessage({ type: "openFile", nodeId })}
            />
          ) : display.nodes.length === 0 ? (
            <div className="flow-empty"><p>Review this skill’s files and instructions in Catalog.</p><button onClick={() => state.switchView("catalog")}>Open Catalog</button></div>
          ) : (
            <>
              <div className="graph" ref={state.graphContainerRef} onKeyDownCapture={event => {
                if (event.key !== "Enter" && event.key !== " ") return;
                const element = (event.target as HTMLElement).closest<HTMLElement>(".react-flow__node");
                if (element?.dataset.id) { event.preventDefault(); event.stopPropagation(); state.selectNode(element.dataset.id); }
              }}>
                <ReactFlow
                  key={`${state.graph.rootPath}-${state.view}-${state.direction}-${state.compact}-${state.fitNonce}`}
                  nodes={flow.nodes.map((node) => ({
                    ...node,
                    selected: node.id === state.selectedId,
                  }))}
                  edges={presentEdges(flow.edges, state.selectedId)}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  defaultEdgeOptions={defaultEdgeOptions}
                  onNodeClick={state.onNodeClick}
                  onNodeDoubleClick={state.onNodeDoubleClick}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                  fitView
                  fitViewOptions={state.compact ? COMPACT_FIT_VIEW_OPTIONS : FIT_VIEW_OPTIONS}
                  minZoom={0.1}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={18} size={1} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </div>
              <Legend
                showGate={gateCount > 0}
                showProcedureHints
              />
            </>
          )}
        </div>
      </div>
      <Inspector
        open={state.inspectorOpen}
        onToggle={() => state.setInspectorOpen(value => !value)}
        node={selected}
        content={state.content}
        edges={display.edges}
        nodes={display.nodes}
        onSelectNode={state.selectNode}
      />
    </div>
  );
}
