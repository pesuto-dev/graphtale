import type { KeyboardEventHandler, ReactElement } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import { diagnosisNeededWhen, diagnosisTitle, type ProcedureDiagnosis } from "@shared/protocol";
import type { AppViewModel } from "./appModel";
import {
  COMPACT_FIT_VIEW_OPTIONS,
  FIT_VIEW_OPTIONS,
  defaultEdgeOptions,
  edgeTypes,
  nodeTypes,
} from "./appConfig";
import { CatalogInventory } from "./CatalogInventory";
import { presentEdges } from "./edges";
import { Legend } from "./Legend";
import { useGraphActivation } from "./useGraphActivation";
import type { ViewState } from "./useViewState";
import { vscode } from "./vscode";

type CopyState = ViewState["copyState"];

function ErrorBanner({
  message,
  retryable,
  onRetry,
}: {
  message: string;
  retryable: boolean;
  onRetry: () => void;
}): ReactElement {
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      {retryable ? <button onClick={onRetry}>Retry</button> : null}
    </div>
  );
}

function ReadWarnings({ warnings }: { warnings: string[] }): ReactElement | null {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <details className="read-warnings">
      <summary>Some files or steps could not be fully read</summary>
      <ul>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </details>
  );
}

function copyLabel(copyState: CopyState): string {
  if (copyState === "copied") {
    return "Copied. Paste in chat";
  }
  if (copyState === "failed") {
    return "Copy failed. Select the prompt text";
  }
  return "Copy clarification prompt";
}

function DiagnosisBanner({
  diagnosis,
  copyState,
  onOpenCatalog,
  onCopy,
}: {
  diagnosis: ProcedureDiagnosis;
  copyState: CopyState;
  onOpenCatalog: () => void;
  onCopy: () => void;
}): ReactElement {
  const showPrompt = copyState === "failed" && diagnosis.fixPrompt.length > 0;
  return (
    <div className={`diagnosis-banner confidence-${diagnosis.confidence}`}>
      <div className="diagnosis-copy">
        <strong>{diagnosisTitle(diagnosis.confidence)}</strong>
        <p>{diagnosis.message}</p>
        <p className="diagnosis-hint">{diagnosisNeededWhen(diagnosis.confidence)}</p>
        {showPrompt ? (
          <pre className="fix-prompt-text" tabIndex={0}>
            {diagnosis.fixPrompt}
          </pre>
        ) : null}
      </div>
      <div className="diagnosis-actions">
        <button type="button" onClick={onOpenCatalog}>
          Inspect files in Catalog
        </button>
        <details>
          <summary>Optional: clarify the step structure</summary>
          <button type="button" className="fix-prompt-btn" onClick={onCopy}>
            {copyLabel(copyState)}
          </button>
        </details>
      </div>
    </div>
  );
}

function FlowCanvas({ state, model }: { state: ViewState; model: AppViewModel }): ReactElement {
  const nodes = model.flow.nodes.map((node) => ({
    ...node,
    selected: node.id === state.selectedId,
  }));
  return (
    <ReactFlow
      key={`${state.graph.rootPath}-${state.view}-${state.direction}-${String(state.compact)}-${String(state.fitNonce)}`}
      nodes={nodes}
      edges={presentEdges(model.flow.edges, state.selectedId)}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={defaultEdgeOptions}
      onNodeClick={state.onNodeClick}
      onNodeDoubleClick={state.onNodeDoubleClick}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable
      edgesFocusable={false}
      elementsSelectable
      fitView
      fitViewOptions={state.compact ? COMPACT_FIT_VIEW_OPTIONS : FIT_VIEW_OPTIONS}
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={18} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

function SkillGraph({
  state,
  model,
  onGraphKeyDown,
}: {
  state: ViewState;
  model: AppViewModel;
  onGraphKeyDown: KeyboardEventHandler<HTMLDivElement>;
}): ReactElement {
  return (
    <>
      <div className="graph" ref={state.graphContainerRef} onKeyDownCapture={onGraphKeyDown}>
        <FlowCanvas state={state} model={model} />
      </div>
      <Legend showGate={model.gateCount > 0} showProcedureHints />
    </>
  );
}

function FlowBody({
  state,
  model,
  onGraphKeyDown,
}: {
  state: ViewState;
  model: AppViewModel;
  onGraphKeyDown: KeyboardEventHandler<HTMLDivElement>;
}): ReactElement {
  if (state.view === "catalog") {
    return (
      <CatalogInventory
        nodes={model.display.nodes}
        selectedId={state.selectedId}
        onSelect={state.selectNode}
        onOpen={(nodeId) => {
          vscode.postMessage({ type: "openFile", nodeId });
        }}
      />
    );
  }
  if (model.display.nodes.length === 0) {
    return (
      <div className="flow-empty">
        <p>Review this skill’s files and instructions in Catalog.</p>
        <button
          onClick={() => {
            state.switchView("catalog");
          }}
        >
          Open Catalog
        </button>
      </div>
    );
  }
  return <SkillGraph state={state} model={model} onGraphKeyDown={onGraphKeyDown} />;
}

export function FlowPane({
  state,
  model,
  onRefresh,
}: {
  state: ViewState;
  model: AppViewModel;
  onRefresh: () => void;
}): ReactElement {
  const onGraphKeyDown = useGraphActivation(state.selectNode);
  return (
    <>
      {state.error ? (
        <ErrorBanner message={state.error.message} retryable={state.error.retryable} onRetry={onRefresh} />
      ) : null}
      <div className="graph-pane">
        <ReadWarnings warnings={model.warnings} />
        {model.showDiagnosis ? (
          <DiagnosisBanner
            diagnosis={state.diagnosis}
            copyState={state.copyState}
            onOpenCatalog={() => {
              state.switchView("catalog");
            }}
            onCopy={state.copyFixPrompt}
          />
        ) : null}
        <FlowBody state={state} model={model} onGraphKeyDown={onGraphKeyDown} />
      </div>
    </>
  );
}
