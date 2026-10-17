import type { Edge } from "@xyflow/react";

export function presentEdges(edges: Edge[], selectedId: string | undefined): Edge[] {
  return edges.map((edge) => {
    const compact = edge.className?.includes("edge-compact") ?? false;
    const adjacent =
      selectedId !== undefined && (edge.source === selectedId || edge.target === selectedId);
    const markerEnd = edge.markerEnd;
    return {
      ...edge,
      className: adjacent ? `${edge.className ?? ""} edge-adjacent`.trim() : edge.className,
      style: {
        ...(edge.style ?? {}),
        strokeWidth: adjacent ? (compact ? 3 : 2.5) : compact ? edge.style?.strokeWidth : 2,
        ...(adjacent
          ? {
              stroke: "var(--accent)",
              strokeDasharray: "6 6",
            }
          : {}),
      },
      markerEnd:
        adjacent && markerEnd && typeof markerEnd === "object"
          ? { ...markerEnd, color: "var(--accent)" }
          : markerEnd,
    };
  });
}
