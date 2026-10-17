import type { ReactElement } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { deriveAppView } from "./appModel";
import { AppToolbar, toolbarProps } from "./AppToolbar";
import { FlowPane } from "./FlowPane";
import { Inspector } from "./Inspector";
import { useHostMessages } from "./useHostMessages";
import { useViewState } from "./useViewState";
import { viewPanelId, viewTabId } from "./ViewTabs";
import { vscode } from "./vscode";

export function App(): ReactElement {
  return (
    <ReactFlowProvider>
      <AppShell />
    </ReactFlowProvider>
  );
}

function AppShell(): ReactElement {
  const state = useViewState();
  useHostMessages(state);
  const model = deriveAppView(state);
  const refresh = (): void => {
    vscode.postMessage({ type: "refresh" });
  };
  return (
    <div className={state.inspectorOpen ? "app" : "app inspector-closed"}>
      <AppToolbar {...toolbarProps({ state, model, onRefresh: refresh })} />
      <div
        className="main main-procedure"
        role="tabpanel"
        id={viewPanelId(state.view)}
        aria-labelledby={viewTabId(state.view)}
      >
        <FlowPane state={state} model={model} onRefresh={refresh} />
      </div>
      <Inspector
        open={state.inspectorOpen}
        onToggle={() => {
          state.setInspectorOpen((value) => !value);
        }}
        node={model.selected}
        content={state.content}
        edges={model.display.edges}
        nodes={model.display.nodes}
        onSelectNode={state.selectNode}
      />
    </div>
  );
}
