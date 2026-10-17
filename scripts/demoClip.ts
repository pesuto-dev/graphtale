export const CLIP_MIN_SECONDS = 10;
export const CLIP_MAX_SECONDS = 15;
export const CLIP_MAX_BYTES = 3 * 1024 * 1024;

export interface PointerBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PointerPoint {
  x: number;
  y: number;
}

export function pointerCenter(box: PointerBox): PointerPoint {
  return {
    x: Math.round(box.x + box.width / 2),
    y: Math.round(box.y + box.height / 2),
  };
}

/** Undefined when the clip may be published. Otherwise a short reason. */
export function clipProblem(durationSeconds: number, sizeBytes: number): string | undefined {
  if (durationOutOfRange(durationSeconds)) {
    return `duration ${String(durationSeconds)}s is outside ${String(CLIP_MIN_SECONDS)}-${String(CLIP_MAX_SECONDS)}s`;
  }
  if (sizeOutOfRange(sizeBytes)) {
    return `size ${String(sizeBytes)} bytes is not below ${String(CLIP_MAX_BYTES)} bytes`;
  }
  return undefined;
}

function durationOutOfRange(durationSeconds: number): boolean {
  return !Number.isFinite(durationSeconds) || durationSeconds < CLIP_MIN_SECONDS || durationSeconds > CLIP_MAX_SECONDS;
}

function sizeOutOfRange(sizeBytes: number): boolean {
  return !Number.isFinite(sizeBytes) || sizeBytes < 0 || sizeBytes >= CLIP_MAX_BYTES;
}
