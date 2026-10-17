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
    return VIEW_TABS[index === last ? 0 : index + 1] ?? null;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return VIEW_TABS[index === 0 ? last : index - 1] ?? null;
  }
  if (key === "Home") {
    return VIEW_TABS[0] ?? null;
  }
  if (key === "End") {
    return VIEW_TABS[last] ?? null;
  }
  return null;
}
