import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useReactFlow, type FitViewOptions } from "@xyflow/react";
import type { GraphView, LayoutDirection } from "@shared/protocol";
import { COMPACT_FIT_VIEW_OPTIONS, FIT_VIEW_OPTIONS } from "./appConfig";
import { STEP_FIT_LATE_MS, STEP_FIT_SOON_MS, STEP_FOCUS_MS, stepFocusOptions } from "./stepFocus";

export interface GraphFitInput {
  compact: boolean;
  view: GraphView;
  direction: LayoutDirection;
  expandedIds: string[];
  fitNonce: number;
  narrow: boolean;
  inspectorOpen: boolean;
  containerRef: RefObject<HTMLDivElement>;
}

interface StepFocusLock {
  id: string;
  until: number;
}

interface StepFitHandles {
  frame: number;
  soon: number;
  late: number;
}

type FitView = ReturnType<typeof useReactFlow>["fitView"];

function fitOptions(compact: boolean): FitViewOptions {
  return compact ? COMPACT_FIT_VIEW_OPTIONS : FIT_VIEW_OPTIONS;
}

function fitVisible(fitView: FitView, compact: boolean, focus: StepFocusLock | null): void {
  if (focus && Date.now() < focus.until) {
    void fitView(stepFocusOptions(focus.id));
    return;
  }
  void fitView(fitOptions(compact));
}

function scheduleGraphFit(run: () => void): () => void {
  const frame = requestAnimationFrame(run);
  const timer = setTimeout(run, 150);
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}

function scheduleStepFit(run: () => void): StepFitHandles {
  return {
    frame: window.requestAnimationFrame(run),
    soon: window.setTimeout(run, STEP_FIT_SOON_MS),
    late: window.setTimeout(run, STEP_FIT_LATE_MS),
  };
}

function clearStepFit(handles: StepFitHandles | undefined): void {
  if (!handles) {
    return;
  }
  window.cancelAnimationFrame(handles.frame);
  window.clearTimeout(handles.soon);
  window.clearTimeout(handles.late);
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

/** Keeps the graph in view, and returns a callback that centers one step. */
export function useGraphFit(input: GraphFitInput): (id: string) => void {
  const { fitView } = useReactFlow();
  const { compact, view, direction, expandedIds, fitNonce, narrow, inspectorOpen, containerRef } = input;
  const focusRef = useRef<StepFocusLock | null>(null);
  const jumpRef = useRef<StepFitHandles | undefined>(undefined);
  const run = useCallback((): void => {
    fitVisible(fitView, compact, focusRef.current);
  }, [fitView, compact]);

  useEffect(() => {
    return () => {
      clearStepFit(jumpRef.current);
    };
  }, []);

  useEffect(() => {
    return scheduleGraphFit(run);
  }, [view, direction, expandedIds, fitNonce, narrow, inspectorOpen, run]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    return watchGraphSize(element, run);
  }, [view, fitNonce, containerRef, run]);

  return (id: string): void => {
    focusRef.current = { id, until: Date.now() + STEP_FOCUS_MS };
    clearStepFit(jumpRef.current);
    jumpRef.current = scheduleStepFit(run);
  };
}
