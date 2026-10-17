import type { ReactElement } from "react";
import type { GraphView, LayoutDirection } from "@shared/protocol";
import type { AppViewModel } from "./appModel";
import type { ViewState } from "./useViewState";
import { ViewTabs } from "./ViewTabs";

export type AppToolbarProps = {
  skillName: string;
  view: GraphView;
  stale: boolean;
  compact: boolean;
  direction: LayoutDirection;
  hint: string;
  inventoryCount: number;
  agentCount: number;
  gateCount: number;
  scriptCount: number;
  onSwitchView: (next: GraphView) => void;
  onToggleCompact: () => void;
  onToggleDirection: () => void;
  onRefresh: () => void;
};

function countLabel(view: GraphView, compact: boolean): string {
  if (view !== "flow") {
    return "nodes";
  }
  return compact ? "shown" : "steps";
}

function ToolbarStats(props: AppToolbarProps): ReactElement {
  const flow = props.view === "flow";
  const secondaryCount = props.scriptCount > 0 ? props.scriptCount : props.gateCount;
  const secondaryLabel = props.scriptCount > 0 ? "scripts" : "gates";
  return (
    <div className="toolbar-stats">
      <span className="stat">
        <strong>{props.inventoryCount}</strong>
        {countLabel(props.view, props.compact)}
      </span>
      <span className="stat">
        <strong>{props.agentCount}</strong>
        agents
      </span>
      {flow ? (
        <span className="stat">
          <strong>{secondaryCount}</strong>
          {secondaryLabel}
        </span>
      ) : null}
      <button
        type="button"
        className={props.stale ? "refresh-btn is-stale" : "refresh-btn"}
        onClick={props.onRefresh}
      >
        {props.stale ? "Refresh · files changed" : "Refresh"}
      </button>
      {flow ? (
        <button type="button" className={props.compact ? "active" : ""} onClick={props.onToggleCompact}>
          Compact
        </button>
      ) : null}
      {flow && !props.compact ? (
        <button type="button" onClick={props.onToggleDirection}>
          Layout {props.direction === "LR" ? "left to right" : "top to bottom"}
        </button>
      ) : null}
    </div>
  );
}

export function toolbarProps(input: {
  state: ViewState;
  model: AppViewModel;
  onRefresh: () => void;
}): AppToolbarProps {
  const { state, model, onRefresh } = input;
  return {
    skillName: state.graph.skillName,
    view: state.view,
    stale: state.stale,
    compact: state.compact,
    direction: state.direction,
    hint: model.hint,
    inventoryCount: model.inventoryCount,
    agentCount: model.agentCount,
    gateCount: model.gateCount,
    scriptCount: model.scriptCount,
    onSwitchView: state.switchView,
    onToggleCompact: state.toggleCompact,
    onToggleDirection: state.toggleDirection,
    onRefresh,
  };
}

export function AppToolbar(props: AppToolbarProps): ReactElement {
  return (
    <header className="toolbar">
      <div>
        <div className="title-row">
          <h1>{props.skillName || "Graphtale"}</h1>
          <span className="status-pill on">viewer</span>
        </div>
        <ViewTabs view={props.view} onChange={props.onSwitchView} />
        <p className="hint">{props.hint}</p>
      </div>
      <ToolbarStats {...props} />
    </header>
  );
}
