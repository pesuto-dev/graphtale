import { useEffect, useRef, type KeyboardEvent } from "react";
import type { GraphView } from "@shared/protocol";
import { nextViewFromKey, viewPanelId, viewTabId, VIEW_TABS } from "./viewTabs";

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
