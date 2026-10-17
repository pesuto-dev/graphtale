/** @vitest-environment jsdom */
import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { afterEach, describe, expect, it } from "vitest";
import type { GraphView } from "@shared/protocol";
import { CatalogInventory } from "./CatalogInventory";
import { toCompactFlow } from "./compactLayout";
import { node } from "./compactTestHelpers";
import { graphNodeIdFromKeyTarget, isGraphActivationKey } from "./graphKeys";
import { SkillNodeView, compactAccessibleName, type SkillFlowNode } from "./SkillNodeView";
import { nextViewFromKey, viewTabId, ViewTabs } from "./ViewTabs";

afterEach(() => cleanup());

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
    return <ViewTabs view={view} onChange={setView} />;
  }

  it("exposes a tablist and selects the next tab from the keyboard", async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    const tablist = screen.getByRole("tablist", { name: "Skill views" });
    expect(tablist).toBeTruthy();
    const flow = screen.getByRole("tab", { name: "Flow" });
    const catalog = screen.getByRole("tab", { name: "Catalog" });
    expect(flow.getAttribute("aria-selected")).toBe("true");
    expect(flow.getAttribute("tabindex")).toBe("0");
    expect(flow.id).toBe(viewTabId("flow"));
    expect(flow.getAttribute("aria-controls")).toBe("graphtale-panel-flow");
    expect(catalog.getAttribute("aria-selected")).toBe("false");
    expect(catalog.getAttribute("tabindex")).toBe("-1");

    flow.focus();
    await user.keyboard("{ArrowRight}");
    expect(catalog.getAttribute("aria-selected")).toBe("true");
    expect(flow.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(catalog);
  });
});

describe("catalog selection", () => {
  const nodes = [
    node("skill-md", "skill", { isEntry: true, label: "SKILL.md" }),
    node("agents/review.md", "agent", { label: "review.md" }),
  ];

  it("marks only the selected row as current", () => {
    render(
      <CatalogInventory
        nodes={nodes}
        selectedId="agents/review.md"
        onSelect={() => undefined}
        onOpen={() => undefined}
      />,
    );
    const current = screen.getAllByRole("button").filter((button) => button.getAttribute("aria-current") === "true");
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain("review.md");
    expect(current[0]?.classList.contains("is-selected")).toBe(true);
  });
});

describe("compact node names", () => {
  it("keeps the full name on the focusable node when the chip text is shortened", () => {
    const long = "1. Read the request and compare the evidence";
    expect(compactAccessibleName("reference", long)).toBe(`reference: ${long}`);
    const flow = toCompactFlow([node("step:1", "reference", { label: long })], []);
    const placed = flow.nodes[0];
    if (!placed) {
      throw new Error("compact flow has no node");
    }
    expect(placed.ariaLabel).toBe(`reference: ${long}`);
    expect(placed.data.label.endsWith("…")).toBe(true);

    const nodeProps = {
      id: "step:1",
      type: "skill",
      data: placed.data,
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
    render(
      <ReactFlowProvider>
        <SkillNodeView {...nodeProps} />
      </ReactFlowProvider>,
    );
    const chip = document.querySelector(".skill-node.is-compact");
    expect(chip?.getAttribute("aria-label")).toBeNull();
    expect(chip?.textContent).toContain(placed.data.label);
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
