export function captureDisplay(env: NodeJS.ProcessEnv): string {
  const value = env.DISPLAY;
  if (typeof value !== "string" || value.length === 0) return ":99";
  return value;
}

export function captureCdp(env: NodeJS.ProcessEnv): string {
  const value = env.CDP_URL;
  if (typeof value !== "string" || value.length === 0) return "http://127.0.0.1:9222";
  return value;
}
