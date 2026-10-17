import type { KeyboardEventHandler } from "react";
import { graphNodeIdFromKeyTarget, isGraphActivationKey } from "./graphKeys";

/** Enter or Space on a focused step selects it. Controls inside the node keep their own keys. */
export function useGraphActivation(
  selectNode: (id: string) => void,
): KeyboardEventHandler<HTMLDivElement> {
  return (event) => {
    if (!isGraphActivationKey(event.key)) {
      return;
    }
    const id = graphNodeIdFromKeyTarget(event.target);
    if (!id) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    selectNode(id);
  };
}
