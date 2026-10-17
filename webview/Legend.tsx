import type { NodeKind } from "@shared/protocol";
import { kindLabel } from "@shared/kind";
import { ShapeMark } from "./ShapeMark";

const KINDS: NodeKind[] = ["skill", "agent", "reference", "script", "shared"];

export function Legend({
  showGate = false,
  showProcedureHints = false,
}: {
  showGate?: boolean;
  showProcedureHints?: boolean;
}) {
  const kinds: NodeKind[] = showGate ? ["skill", "gate", "agent", "reference", "script", "shared"] : KINDS;
  return (
    <div className="legend">
      {kinds.map((kind) => (
        <span key={kind} className="legend-item">
          <ShapeMark kind={kind} />
          {kindLabel(kind)}
        </span>
      ))}
      <span className="legend-item">
        <span className="legend-line" />
        explicit
      </span>
      <span className="legend-item">
        <span className="legend-line dashed" />
        {showProcedureHints ? "inferred / unresolved" : "inferred"}
      </span>
      <span className="legend-item">
        <span className="legend-line adjacent" />
        selected path
      </span>
    </div>
  );
}
