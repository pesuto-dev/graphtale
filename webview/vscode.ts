export type VsCodeApi = {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
};

declare function acquireVsCodeApi(): VsCodeApi;

function resolveVsCodeApi(): VsCodeApi {
  const fromGlobal = (globalThis as { acquireVsCodeApi?: () => VsCodeApi }).acquireVsCodeApi;
  if (typeof fromGlobal === "function") {
    return fromGlobal();
  }
  return acquireVsCodeApi();
}

export const vscode = resolveVsCodeApi();
