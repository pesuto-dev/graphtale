import { BaseEdge, type EdgeProps } from "@xyflow/react";

export type CompactWrapData = {
  wrapY: number;
  gutterX: number;
  enter: "left" | "top";
};

function roundedWrapPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  wrapY: number,
  gutterX: number,
  enter: "left" | "top",
): string {
  const radius = 10;
  const highwayY = Math.max(wrapY, sourceY + radius + 2);
  const goingLeft = (enter === "left" ? gutterX : targetX) < sourceX;
  const hSign = goingLeft ? -1 : 1;

  if (enter === "left") {
    const gx = Math.min(gutterX, targetX - 8);
    return [
      `M ${sourceX} ${sourceY}`,
      `L ${sourceX} ${highwayY - radius}`,
      `Q ${sourceX} ${highwayY} ${sourceX + hSign * radius} ${highwayY}`,
      `L ${gx - hSign * radius} ${highwayY}`,
      `Q ${gx} ${highwayY} ${gx} ${highwayY + radius}`,
      `L ${gx} ${targetY - radius}`,
      `Q ${gx} ${targetY} ${gx + radius} ${targetY}`,
      `L ${targetX} ${targetY}`,
    ].join(" ");
  }

  return [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX} ${highwayY - radius}`,
    `Q ${sourceX} ${highwayY} ${sourceX + hSign * radius} ${highwayY}`,
    `L ${targetX - hSign * radius} ${highwayY}`,
    `Q ${targetX} ${highwayY} ${targetX} ${highwayY + radius}`,
    `L ${targetX} ${targetY}`,
  ].join(" ");
}

function wrapData(data: unknown): CompactWrapData | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.wrapY !== "number" || typeof record.gutterX !== "number") {
    return undefined;
  }
  const enter = record.enter === "left" ? "left" : "top";
  return { wrapY: record.wrapY, gutterX: record.gutterX, enter };
}

/** Long wrap: drop into the gap, slide, enter the next row from the left (col 0) or from above. */
export function CompactWrapEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const meta = wrapData(data);
  const wrapY = meta?.wrapY ?? sourceY + 28;
  const gutterX = meta?.gutterX ?? Math.min(sourceX, targetX) - 24;
  const enter = meta?.enter ?? "top";
  const path = roundedWrapPath(sourceX, sourceY, targetX, targetY, wrapY, gutterX, enter);
  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />;
}
