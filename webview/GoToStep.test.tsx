/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SkillNode } from "@shared/protocol";
import { GoToStep } from "./GoToStep";

afterEach(() => cleanup());

function node(id: string, label: string): SkillNode {
  return { id, label, kind: "skill", path: `/skills/${id}`, summary: "", uses: [] };
}

const nodes = [
  node("step:1", "1. Read request"),
  node("step:2", "2. Gather files"),
  node("step:20", "20. Archive the review"),
  node("step:N2a", "N2a. Research the ticket"),
  node("step:N2b", "N2b. Verify the ticket"),
];

describe("GoToStep", () => {
  it("exposes a labeled combobox", () => {
    render(<GoToStep nodes={nodes} onGo={vi.fn()} />);
    const field = screen.getByRole("combobox", { name: "Go to step" });
    expect(field.getAttribute("aria-expanded")).toBe("false");
    expect(field.getAttribute("placeholder")).toBe("Title or number");
  });

  it("goes to an exact step number and ignores a longer number", async () => {
    const user = userEvent.setup();
    const onGo = vi.fn();
    render(<GoToStep nodes={nodes} onGo={onGo} />);
    await user.type(screen.getByRole("combobox", { name: "Go to step" }), "2{Enter}");
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(onGo).toHaveBeenCalledWith("step:2");
    expect(screen.getByRole("status").textContent).toContain("Showing 2. Gather files");
  });

  it("moves through title matches with the arrow keys", async () => {
    const user = userEvent.setup();
    const onGo = vi.fn();
    render(<GoToStep nodes={nodes} onGo={onGo} />);
    const field = screen.getByRole("combobox", { name: "Go to step" });
    await user.type(field, "N2");
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent?.replace(/\s+/g, " ").trim())).toEqual([
      "N2a Research the ticket",
      "N2b Verify the ticket",
    ]);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onGo).toHaveBeenCalledWith("step:N2b");
  });

  it("announces an empty result and clears it with Escape", async () => {
    const user = userEvent.setup();
    const onGo = vi.fn();
    render(<GoToStep nodes={nodes} onGo={onGo} />);
    const field = screen.getByRole("combobox", { name: "Go to step" });
    await user.type(field, "missing{Enter}");
    expect(onGo).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain('No step matches "missing"');
    await user.keyboard("{Escape}");
    expect((field as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("moves back up the list and reopens it after blur", async () => {
    const user = userEvent.setup();
    render(<GoToStep nodes={nodes} onGo={vi.fn()} />);
    const field = screen.getByRole("combobox", { name: "Go to step" });
    await user.type(field, "ticket");
    await user.keyboard("{ArrowDown}{ArrowUp}");
    expect(screen.getAllByRole("option")[0].getAttribute("aria-selected")).toBe("true");
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
    await user.click(field);
    expect(screen.getAllByRole("option").length).toBeGreaterThan(1);
    await user.keyboard("{Escape}");
    expect((field as HTMLInputElement).value).toBe("");
    field.focus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("opens the chosen step from the list", async () => {
    const user = userEvent.setup();
    const onGo = vi.fn();
    render(<GoToStep nodes={nodes} onGo={onGo} />);
    await user.type(screen.getByRole("combobox", { name: "Go to step" }), "research");
    await user.click(screen.getByRole("option", { name: /Research the ticket/ }));
    expect(onGo).toHaveBeenCalledWith("step:N2a");
  });
});
