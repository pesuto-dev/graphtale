import { useEffect, useRef, type KeyboardEventHandler } from "react";
import type { GraphView } from "@shared/protocol";
import { nextViewFromKey, viewTabId } from "./viewTabModel";

/** Roving tabindex: arrows change the tab, then focus follows the selection. */
export function useViewTabKeys(
  view: GraphView,
  onChange: (next: GraphView) => void,
): KeyboardEventHandler<HTMLDivElement> {
  const pendingFocus = useRef<GraphView | null>(null);

  useEffect(() => {
    const next = pendingFocus.current;
    if (!next) {
      return;
    }
    pendingFocus.current = null;
    document.getElementById(viewTabId(next))?.focus();
  }, [view]);

  return (event) => {
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
  };
}
