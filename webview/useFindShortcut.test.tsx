/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { GraphView } from "@shared/protocol";
import { useFindShortcut } from "./useFindShortcut";

afterEach(() => cleanup());

function Probe({ view }: { view: GraphView }) {
  const catalogRef = useRef<HTMLInputElement>(null);
  const stepRef = useRef<HTMLInputElement>(null);
  useFindShortcut(view, catalogRef, stepRef);
  return (
    <>
      <input ref={catalogRef} aria-label="Search files" />
      <input ref={stepRef} aria-label="Go to step" />
    </>
  );
}

function pressFind(init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
}

describe("useFindShortcut", () => {
  it("focuses Go to step on Ctrl+F and Catalog search on Cmd+F", () => {
    const view = render(<Probe view="flow" />);
    pressFind({ key: "f", ctrlKey: true });
    expect(document.activeElement).toBe(screen.getByLabelText("Go to step"));

    view.rerender(<Probe view="catalog" />);
    pressFind({ key: "F", metaKey: true });
    expect(document.activeElement).toBe(screen.getByLabelText("Search files"));
  });

  it("ignores Ctrl+Shift+F", () => {
    render(<Probe view="flow" />);
    pressFind({ key: "f", ctrlKey: true, shiftKey: true });
    expect(document.activeElement).not.toBe(screen.getByLabelText("Go to step"));
  });

  it("still focuses after a capture listener cancels the browser find", () => {
    render(<Probe view="flow" />);
    const cancelFind = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "f") {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", cancelFind, true);
    pressFind({ key: "f", ctrlKey: true });
    window.removeEventListener("keydown", cancelFind, true);
    expect(document.activeElement).toBe(screen.getByLabelText("Go to step"));
  });
});
