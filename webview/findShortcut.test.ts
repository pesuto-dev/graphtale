import { describe, expect, it } from "vitest";
import { isFindShortcut, type FindShortcutEvent } from "./findShortcut";

const base: FindShortcutEvent = { key: "f", metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };

describe("isFindShortcut", () => {
  it("accepts Ctrl+F", () => {
    expect(isFindShortcut({ ...base, ctrlKey: true })).toBe(true);
  });

  it("accepts Cmd+F", () => {
    expect(isFindShortcut({ ...base, key: "F", metaKey: true })).toBe(true);
  });

  it("rejects Ctrl+Shift+F", () => {
    expect(isFindShortcut({ ...base, ctrlKey: true, shiftKey: true })).toBe(false);
  });

  it("rejects Ctrl+Alt+F", () => {
    expect(isFindShortcut({ ...base, ctrlKey: true, altKey: true })).toBe(false);
  });

  it("rejects F without a modifier", () => {
    expect(isFindShortcut(base)).toBe(false);
  });
});
