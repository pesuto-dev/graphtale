/** How long a “go to step” fit keeps winning over a whole-graph fit. */
export const STEP_FOCUS_MS = 700;

/** Fit a single node in the middle of the pane without filling the screen. */
export function stepFocusOptions(nodeId: string): StepFocusOptions {
  return {
    nodes: [{ id: nodeId }],
    padding: 0.45,
    duration: 180,
    minZoom: 0.2,
    maxZoom: 1.2,
  };
}

export type StepFocusOptions = {
  nodes: { id: string }[];
  padding: number;
  duration: number;
  minZoom: number;
  maxZoom: number;
};
