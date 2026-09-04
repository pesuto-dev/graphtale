export function selectionAfterReload(
  previousRoot: string,
  nextRoot: string,
  previousSelectedId: string | undefined,
  nodes: Array<{ id: string; isEntry?: boolean }>,
): { resetView: boolean; selectedId: string | undefined } {
  const entry = nodes.find((node) => node.isEntry)?.id ?? nodes[0]?.id;
  const sameSkill = previousRoot !== "" && previousRoot === nextRoot;
  if (sameSkill && previousSelectedId && nodes.some((node) => node.id === previousSelectedId)) {
    return { resetView: false, selectedId: previousSelectedId };
  }
  if (sameSkill) {
    return { resetView: false, selectedId: entry };
  }
  return { resetView: true, selectedId: entry };
}
