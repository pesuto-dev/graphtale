import { describe, expect, it } from "vitest";
import { CLIP_MAX_BYTES, CLIP_MAX_SECONDS, CLIP_MIN_SECONDS, clipProblem, pointerCenter } from "./demoClip";

describe("pointerCenter", () => {
  it("aims at the middle of a box", () => {
    expect(pointerCenter({ x: 10, y: 20, width: 4, height: 8 })).toEqual({ x: 12, y: 24 });
  });

  it("rounds a half-pixel center", () => {
    expect(pointerCenter({ x: 0, y: 0, width: 1, height: 1 })).toEqual({ x: 1, y: 1 });
  });
});

describe("clipProblem", () => {
  it("accepts a clip inside the readme limits", () => {
    expect(clipProblem(12.2, 741_070)).toBeUndefined();
  });

  it("rejects a clip shorter than 10 seconds", () => {
    expect(clipProblem(CLIP_MIN_SECONDS - 0.1, 100)).toMatch(/duration/);
  });

  it("rejects a clip longer than 15 seconds", () => {
    expect(clipProblem(CLIP_MAX_SECONDS + 0.1, 100)).toMatch(/duration/);
  });

  it("rejects a non-finite duration", () => {
    expect(clipProblem(Number.NaN, 100)).toMatch(/duration/);
  });

  it("rejects a clip of 3 MiB or larger", () => {
    expect(clipProblem(12, CLIP_MAX_BYTES)).toMatch(/size/);
  });

  it("rejects a negative size", () => {
    expect(clipProblem(12, -1)).toMatch(/size/);
  });
});
