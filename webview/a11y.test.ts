// @vitest-environment happy-dom
import { createElement, useState, type ReactNode } from "react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { afterEach, describe, expect, it } from "vitest";
import type { GraphView } from "@shared/protocol";
import { CatalogInventory } from "./CatalogInventory";
import { toCompactFlow } from "./compactLayout";
import { node } from "./compactTestHelpers";
import { graphNodeIdFromKeyTarget, isGraphActivationKey } from "./graphKeys";
import { SkillNodeView, compactAccessibleName, type SkillFlowNode } from "./SkillNodeView";
import { nextViewFromKey, viewTabId, ViewTabs } from "./ViewTabs";

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});

function mount(ui: ReactNode) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(ui));
  return host;
}

describe("view tabs", () => {
  it("moves with the arrow keys and wraps at the ends", () => {
    expect(nextViewFromKey("flow", "ArrowRight")).toBe("catalog");
    expect(nextViewFromKey("catalog", "ArrowRight")).toBe("flow");
    expect(nextViewFromKey("flow", "ArrowLeft")).toBe("catalog");
    expect(nextViewFromKey("catalog", "Home")).toBe("flow");
    expect(nextViewFromKey("flow", "End")).toBe("catalog");
    expect(nextViewFromKey("flow", "Enter")).toBeNull();
  });

  function TabsHarness() {
    const [view, setView] = useState<GraphView>("flow");
    return createElement(ViewTabs, { view, onChange: setView });
  }

  it("exposes a tablist and selects the next tab from the keyboard", () => {
    mount(createElement(TabsHarness));
    const tablist = document.querySelector("[role='tablist']");
    expect(tablist?.getAttribute("aria-label")).toBe("Skill views");
    const flow = document.getElementById(viewTabId("flow"));
    const catalog = document.getElementById(viewTabId("catalog"));
    expect(flow?.getAttribute("role")).toBe("tab");
    expect(flow?.getAttribute("aria-selected")).toBe("true");
    expect(flow?.getAttribute("tabindex")).toBe("0");
    expect(catalog?.getAttribute("aria-selected")).toBe("false");
    expect(catalog?.getAttribute("tabindex")).toBe("-1");
    expect(document.getElementById("graphtale-panel-flow")).toBeNull();
    expect(flow?.getAttribute("aria-controls")).toBe("graphtale-panel-flow");

    act(() => {
      flow?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    expect(catalog?.getAttribute("aria-selected")).toBe("true");
    expect(flow?.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(catalog);
  });
});

describe("catalog selection", () => {
  const nodes = [
    node("skill-md", "skill", { isEntry: true, label: "SKILL.md" }),
    node("agents/review.md", "agent", { label: "review.md" }),
  ];

  it("marks only the selected row as current", () => {
    mount(
      createElement(CatalogInventory, {
        nodes,
        selectedId: "agents/review.md",
        onSelect: () => undefined,
        onOpen: () => undefined,
      }),
    );
    const current = document.querySelectorAll("[aria-current='true']");
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain("review.md");
    expect(current[0]?.classList.contains("is-selected")).toBe(true);
  });
});

describe("compact node names", () => {
  it("keeps the full kind and label when the chip text is shortened", () => {
    const long = "1. Read the request and compare the evidence";
    expect(compactAccessibleName("reference", long)).toBe(`reference: ${long}`);
    const flow = toCompactFlow(
      [node("step:1", "reference", { label: long })],
      [],
    );
    expect(flow.nodes[0]?.ariaLabel).toBe(`reference: ${long}`);
    expect(flow.nodes[0]?.data.accessibleName).toBe(`reference: ${long}`);
    expect(flow.nodes[0]?.data.label.endsWith("…")).toBe(true);

    const nodeProps = {
      id: "step:1",
      type: "skill",
      data: flow.nodes[0]!.data,
      selected: false,
      dragging: false,
      zIndex: 1,
      selectable: true,
      deletable: false,
      draggable: false,
      isConnectable: false,
      positionAbsoluteX: 0,
      positionAbsoluteY: 0,
    } as NodeProps<SkillFlowNode>;
    mount(createElement(ReactFlowProvider, null, createElement(SkillNodeView, nodeProps)));
    expect(document.querySelector(".skill-node.is-compact")?.getAttribute("aria-label")).toBe(
      `reference: ${long}`,
    );
  });
});

describe("graph keyboard activation", () => {
  it("selects a focused step with Enter or Space and ignores expand controls", () => {
    expect(isGraphActivationKey("Enter")).toBe(true);
    expect(isGraphActivationKey(" ")).toBe(true);
    expect(isGraphActivationKey("ArrowRight")).toBe(false);

    const step = document.createElement("div");
    step.className = "react-flow__node";
    step.dataset.id = "step:2";
    const title = document.createElement("div");
    title.textContent = "2. Gather files";
    const expand = document.createElement("button");
    expand.dataset.expand = "step:2";
    step.append(title, expand);
    document.body.append(step);

    expect(graphNodeIdFromKeyTarget(title)).toBe("step:2");
    expect(graphNodeIdFromKeyTarget(step)).toBe("step:2");
    expect(graphNodeIdFromKeyTarget(expand)).toBeUndefined();

    const edge = document.createElement("g");
    edge.className = "react-flow__edge";
    edge.setAttribute("data-id", "skill-md-step:2");
    document.body.append(edge);
    expect(graphNodeIdFromKeyTarget(edge)).toBeUndefined();
  });
});
