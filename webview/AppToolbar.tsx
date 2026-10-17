import type { ReactElement, Ref } from "react";
import type { GraphView, LayoutDirection, SkillNode } from "@shared/protocol";
import type { AppViewModel } from "./appModel";
import { GoToStep } from "./GoToStep";
import { nodesPresentOnFlow } from "./stepMatch";
import type { ViewState } from "./useViewState";
import { ViewTabs } from "./ViewTabs";

export interface AppToolbarProps {
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
  stepNodes: SkillNode[];
  onGoToStep: (id: string) => void;
  stepSearchRef: Ref<HTMLInputElement>;
}

function countLabel(view: GraphView, compact: boolean): string {
  if (view !== "flow") {
    return "nodes";
  }
  return compact ? "shown" : "steps";
}

function refreshClass(stale: boolean): string {
  return stale ? "refresh-btn is-stale" : "refresh-btn";
}

function refreshLabel(stale: boolean): string {
  return stale ? "Refresh · files changed" : "Refresh";
}

function SecondaryStat(props: AppToolbarProps): ReactElement | null {
  if (props.view !== "flow") {
    return null;
  }
  const scripts = props.scriptCount > 0;
  return (
    <span className="stat">
      <strong>{scripts ? props.scriptCount : props.gateCount}</strong>
      {scripts ? "scripts" : "gates"}
    </span>
  );
}

function CompactButton(props: AppToolbarProps): ReactElement | null {
  if (props.view !== "flow") {
    return null;
  }
  return (
    <button type="button" className={props.compact ? "active" : ""} onClick={props.onToggleCompact}>
      Compact
    </button>
  );
}

function DirectionButton(props: AppToolbarProps): ReactElement | null {
  if (props.view !== "flow" || props.compact) {
    return null;
  }
  const label = props.direction === "LR" ? "left to right" : "top to bottom";
  return (
    <button type="button" onClick={props.onToggleDirection}>
      Layout {label}
    </button>
  );
}

function StepSearch(props: AppToolbarProps): ReactElement | null {
  if (props.view !== "flow" || props.stepNodes.length === 0) {
    return null;
  }
  return <GoToStep nodes={props.stepNodes} onGo={props.onGoToStep} inputRef={props.stepSearchRef} />;
}

function ToolbarStats(props: AppToolbarProps): ReactElement {
  return (
    <div className="toolbar-stats">
      <StepSearch {...props} />
      <span className="stat">
        <strong>{props.inventoryCount}</strong>
        {countLabel(props.view, props.compact)}
      </span>
      <span className="stat">
        <strong>{props.agentCount}</strong>
        agents
      </span>
      <SecondaryStat {...props} />
      <button type="button" className={refreshClass(props.stale)} onClick={props.onRefresh}>
        {refreshLabel(props.stale)}
      </button>
      <CompactButton {...props} />
      <DirectionButton {...props} />
    </div>
  );
}

export function toolbarProps(input: {
  state: ViewState;
  model: AppViewModel;
  onRefresh: () => void;
  stepSearchRef: Ref<HTMLInputElement>;
}): AppToolbarProps {
  const { state, model, onRefresh, stepSearchRef } = input;
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
    stepNodes: nodesPresentOnFlow(model.display.nodes, model.flow.nodes),
    onGoToStep: state.goToNode,
    stepSearchRef,
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
