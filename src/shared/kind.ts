import type { NodeKind } from "./protocol";

export type ShapeKind = "diamond" | "rect" | "pill" | "hex";

export function kindLabel(kind: NodeKind): string {
  switch (kind) {
    case "skill":
      return "skill";
    case "reference":
      return "reference";
    case "agent":
      return "agent";
    case "script":
      return "script";
    case "shared":
      return "shared";
    case "gate":
      return "validation";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function kindShape(kind: NodeKind): ShapeKind {
  switch (kind) {
    case "gate":
      return "diamond";
    case "agent":
      return "hex";
    case "script":
      return "rect";
    case "skill":
    case "reference":
    case "shared":
      return "pill";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function kindClass(kind: NodeKind): string {
  switch (kind) {
    case "skill":
      return "kind-skill";
    case "reference":
      return "kind-reference";
    case "agent":
      return "kind-agent";
    case "script":
      return "kind-script";
    case "shared":
      return "kind-shared";
    case "gate":
      return "kind-gate";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
