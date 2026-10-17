import type { ReactElement } from "react";
import type { GraphView } from "@shared/protocol";
import { useViewTabKeys } from "./useViewTabs";
import { VIEW_TABS, viewPanelId, viewTabId } from "./viewTabModel";

export { VIEW_TABS, nextViewFromKey, viewPanelId, viewTabId } from "./viewTabModel";

const LABELS: Record<GraphView, string> = {
  flow: "Flow",
  catalog: "Catalog",
};

export function ViewTabs({
  view,
  onChange,
}: {
  view: GraphView;
  onChange: (next: GraphView) => void;
}): ReactElement {
  const onKeyDown = useViewTabKeys(view, onChange);

  return (
    <div className="view-tabs" role="tablist" aria-label="Skill views" onKeyDown={onKeyDown}>
      {VIEW_TABS.map((id) => {
        const selected = view === id;
        return (
          <button
            key={id}
            id={viewTabId(id)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={viewPanelId(id)}
            tabIndex={selected ? 0 : -1}
            className={selected ? "active" : ""}
            onClick={() => {
              onChange(id);
            }}
          >
            {LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
