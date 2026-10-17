const ACTIVATION_SKIP = "button, a, input, textarea, select, summary, [data-expand]";

export function isGraphActivationKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

/**
 * Enter or Space on a focused step selects it. Buttons inside the node
 * (expand) keep their own activation, so a click is not required first.
 */
export function graphNodeIdFromKeyTarget(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  if (target.closest(ACTIVATION_SKIP)) {
    return undefined;
  }
  const id = target.closest<HTMLElement>(".react-flow__node")?.dataset.id;
  return id || undefined;
}
