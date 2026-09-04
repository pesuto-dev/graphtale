import type { NodeKind } from "@shared/protocol";
import { kindClass, kindShape } from "@shared/kind";

export function ShapeMark({ kind }: { kind: NodeKind }) {
  return (
    <span
      className={`shape-mark shape-${kindShape(kind)} ${kindClass(kind)}`}
      aria-hidden="true"
    />
  );
}
