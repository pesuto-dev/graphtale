import { describe, expect, it } from "vitest";
import { captureCdp, captureDisplay } from "./captureConfig";

describe("captureDisplay", () => {
  it("defaults to display :99", () => {
    expect(captureDisplay({})).toBe(":99");
  });

  it("keeps a display set in the environment", () => {
    expect(captureDisplay({ DISPLAY: ":1" })).toBe(":1");
  });
});

describe("captureCdp", () => {
  it("defaults to the local debugging port", () => {
    expect(captureCdp({})).toBe("http://127.0.0.1:9222");
  });

  it("keeps a debugging url set in the environment", () => {
    expect(captureCdp({ CDP_URL: "http://127.0.0.1:9333" })).toBe("http://127.0.0.1:9333");
  });
});
