/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SkillNode } from "@shared/protocol";
import { CatalogInventory } from "./CatalogInventory";

afterEach(() => cleanup());

function node(partial: Pick<SkillNode, "id" | "label" | "kind" | "path" | "summary">): SkillNode {
  return { uses: [], ...partial };
}

const nodes: SkillNode[] = [
  node({
    id: "skill-md",
    label: "SKILL.md",
    kind: "skill",
    path: "/skills/review/SKILL.md",
    summary: "Review a change using its source evidence.",
  }),
  node({
    id: "scripts/resolve.py",
    label: "resolve.py",
    kind: "script",
    path: "/skills/review/scripts/resolve.py",
    summary: "Parses the ticket queue.",
  }),
  node({
    id: "skill:handoff-target",
    label: "handoff-target",
    kind: "skill",
    path: "/skills/handoff-target/SKILL.md",
    summary: "Writes the customer reply.",
  }),
];

function renderInventory(list: SkillNode[] = nodes) {
  const onSelect = vi.fn();
  const onOpen = vi.fn();
  render(<CatalogInventory nodes={list} selectedId={undefined} onSelect={onSelect} onOpen={onOpen} />);
  return { onSelect, onOpen };
}

describe("CatalogInventory", () => {
  it("labels the search field and lists every file", () => {
    renderInventory();
    expect(screen.getByLabelText("Search files")).toBeTruthy();
    expect(screen.getByRole("button", { name: /resolve\.py/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /handoff-target/ })).toBeTruthy();
  });

  it("filters by file name", async () => {
    const user = userEvent.setup();
    renderInventory();
    await user.type(screen.getByLabelText("Search files"), "resolve");
    expect(screen.getByRole("button", { name: /resolve\.py/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /handoff-target/ })).toBeNull();
  });

  it("filters by path", async () => {
    const user = userEvent.setup();
    renderInventory();
    await user.type(screen.getByLabelText("Search files"), "scripts/");
    expect(screen.getByRole("button", { name: /resolve\.py/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /SKILL\.md/ })).toBeNull();
  });

  it("filters by description", async () => {
    const user = userEvent.setup();
    renderInventory();
    await user.type(screen.getByLabelText("Search files"), "customer reply");
    expect(screen.getByRole("button", { name: /handoff-target/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /resolve\.py/ })).toBeNull();
  });

  it("shows an empty state when nothing matches", async () => {
    const user = userEvent.setup();
    renderInventory();
    await user.type(screen.getByLabelText("Search files"), "missing-file");
    expect(screen.getByRole("status").textContent).toContain('No files match "missing-file"');
    expect(screen.queryByRole("button", { name: /resolve\.py/ })).toBeNull();
  });

  it("restores the list when Escape clears the query", async () => {
    const user = userEvent.setup();
    renderInventory();
    const search = screen.getByLabelText("Search files");
    await user.type(search, "missing-file");
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: /resolve\.py/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /handoff-target/ })).toBeTruthy();
  });

  it("keeps the empty-folder message when the skill has no files", () => {
    renderInventory([]);
    expect(screen.getByText(/No skill files found/)).toBeTruthy();
    expect(screen.queryByText(/No files match/)).toBeNull();
  });

  it("selects a visible row from the keyboard", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderInventory();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Search files"));
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalled();
  });
});
