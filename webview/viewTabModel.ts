import type { GraphView } from "@shared/protocol";

export const VIEW_TABS: GraphView[] = ["flow", "catalog"];

export function viewTabId(view: GraphView): string {
  return `graphtale-tab-${view}`;
}

export function viewPanelId(view: GraphView): string {
  return `graphtale-panel-${view}`;
}

function movedIndex(index: number, last: number, key: string): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") {
    return index === last ? 0 : index + 1;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return index === 0 ? last : index - 1;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return last;
  }
  return null;
}

/** Arrow keys move between Flow and Catalog. Home and End jump to the ends. */
export function nextViewFromKey(current: GraphView, key: string): GraphView | null {
  const index = VIEW_TABS.indexOf(current);
  if (index < 0) {
    return null;
  }
  const moved = movedIndex(index, VIEW_TABS.length - 1, key);
  if (moved === null) {
    return null;
  }
  return VIEW_TABS[moved] ?? null;
}
