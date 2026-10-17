import { useEffect, type RefObject } from "react";
import { useReactFlow, type FitViewOptions } from "@xyflow/react";
import type { GraphView, LayoutDirection } from "@shared/protocol";
import { COMPACT_FIT_VIEW_OPTIONS, FIT_VIEW_OPTIONS } from "./appConfig";

export type GraphFitInput = {
  compact: boolean;
  view: GraphView;
  direction: LayoutDirection;
  expandedIds: string[];
  fitNonce: number;
  narrow: boolean;
  inspectorOpen: boolean;
  containerRef: RefObject<HTMLDivElement>;
};

function fitOptions(compact: boolean): FitViewOptions {
  return compact ? COMPACT_FIT_VIEW_OPTIONS : FIT_VIEW_OPTIONS;
}

function scheduleGraphFit(
  fitView: ReturnType<typeof useReactFlow>["fitView"],
  compact: boolean,
): () => void {
  const run = (): void => {
    void fitView(fitOptions(compact));
  };
  const frame = requestAnimationFrame(run);
  const timer = setTimeout(run, 150);
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}

function watchGraphSize(element: HTMLElement, onResize: () => void): () => void {
  let last = { w: Math.round(element.clientWidth), h: Math.round(element.clientHeight) };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new ResizeObserver(() => {
    const next = { w: Math.round(element.clientWidth), h: Math.round(element.clientHeight) };
    if (next.w === last.w && next.h === last.h) {
      return;
    }
    last = next;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(onResize, 120);
  });
  observer.observe(element);
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    observer.disconnect();
  };
}

/** Keeps the whole graph in the pane after layout changes and panel resizes. */
export function useGraphFit(input: GraphFitInput): void {
  const { fitView } = useReactFlow();
  const { compact, view, direction, expandedIds, fitNonce, narrow, inspectorOpen, containerRef } = input;

  useEffect(() => {
    return scheduleGraphFit(fitView, compact);
  }, [view, direction, expandedIds, fitNonce, compact, narrow, inspectorOpen, fitView]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    return watchGraphSize(element, () => {
      void fitView(fitOptions(compact));
    });
  }, [fitView, compact, view, fitNonce, containerRef]);
}
