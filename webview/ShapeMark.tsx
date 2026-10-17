import type { ReactNode } from "react";
import type { NodeKind } from "@shared/protocol";
import { kindClass, kindShape } from "@shared/kind";

function KindIcon({ kind }: { kind: NodeKind }): ReactNode {
  switch (kind) {
    case "skill":
      return (
        <path
          d="M8 1.5l1.7 4.3 4.3 1.7-4.3 1.7L8 13.5 6.3 9.2 2 7.5l4.3-1.7z"
          fill="currentColor"
        />
      );
    case "agent":
      return (
        <>
          <rect x="2.5" y="4" width="11" height="9" rx="3.5" fill="currentColor" />
          <circle cx="6" cy="8.5" r="1.1" fill="var(--k)" />
          <circle cx="10" cy="8.5" r="1.1" fill="var(--k)" />
          <path d="M8 4V1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      );
    case "script":
      return (
        <path
          d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "reference":
      return (
        <path
          d="M3 3h4a1.5 1.5 0 011.5 1.5V13 M13 3H9.5A1.5 1.5 0 008 4.5V13M3 3v9h4.5M13 3v9H8.5"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinejoin="round"
        />
      );
    case "gate":
      return (
        <path
          d="M3.5 8.5l3 3 6-7"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "shared":
      return (
        <>
          <circle cx="5" cy="8" r="2.2" fill="currentColor" />
          <circle cx="11.5" cy="4.5" r="2" fill="currentColor" />
          <circle cx="11.5" cy="11.5" r="2" fill="currentColor" />
        </>
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/** Round kind badge. The node itself keeps pill / rect / hex / diamond. */
export function ShapeMark({ kind }: { kind: NodeKind }) {
  return (
    <span
      className={`shape-mark shape-${kindShape(kind)} ${kindClass(kind)}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16">
        <KindIcon kind={kind} />
      </svg>
    </span>
  );
}
