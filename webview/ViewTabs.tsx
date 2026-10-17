import { useEffect, useRef, type KeyboardEvent } from "react";
import type { GraphView } from "@shared/protocol";

export const VIEW_TABS: GraphView[] = ["flow", "catalog"];

export function viewTabId(view: GraphView): string {
  return `graphtale-tab-${view}`;
}

export function viewPanelId(view: GraphView): string {
  return `graphtale-panel-${view}`;
}

/** Arrow keys move between Flow and Catalog. Home and End jump to the ends. */
export function nextViewFromKey(current: GraphView, key: string): GraphView | null {
  const index = VIEW_TABS.indexOf(current);
  if (index < 0) {
    return null;
  }
  const last = VIEW_TABS.length - 1;
  if (key === "ArrowRight" || key === "ArrowDown") {
    return VIEW_TABS[index === last ? 0 : index + 1];
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return VIEW_TABS[index === 0 ? last : index - 1];
  }
  if (key === "Home") {
    return VIEW_TABS[0];
  }
  if (key === "End") {
    return VIEW_TABS[last];
  }
  return null;
}

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
}) {
  const pendingFocus = useRef<GraphView | null>(null);

  useEffect(() => {
    const next = pendingFocus.current;
    if (!next) {
      return;
    }
    pendingFocus.current = null;
    document.getElementById(viewTabId(next))?.focus();
  }, [view]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = nextViewFromKey(view, event.key);
    if (!next) {
      return;
    }
    event.preventDefault();
    pendingFocus.current = next;
    if (next !== view) {
      onChange(next);
      return;
    }
    document.getElementById(viewTabId(next))?.focus();
  }

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
            onClick={() => onChange(id)}
          >
            {LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
