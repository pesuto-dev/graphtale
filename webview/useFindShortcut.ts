import { useEffect, type RefObject } from "react";
import type { GraphView } from "@shared/protocol";
import { isFindShortcut } from "./findShortcut";

export function useFindShortcut(
  view: GraphView,
  catalogInput: RefObject<HTMLInputElement | null>,
  stepInput: RefObject<HTMLInputElement | null>,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isFindShortcut(event)) {
        return;
      }
      const input = view === "catalog" ? catalogInput.current : stepInput.current;
      if (!input) {
        return;
      }
      event.preventDefault();
      input.focus();
      input.select();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, catalogInput, stepInput]);
}
