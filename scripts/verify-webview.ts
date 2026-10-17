/** Browser-only UI checks. Start npm run preview first; this is not editor-host coverage. */
import * as path from "node:path";
import * as fs from "node:fs";
import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";
import { parseSkill } from "../src/parseSkill";
import { parseProcedure } from "../src/parseProcedure";

interface PreviewMessage {
  type?: string;
  nodeId?: string;
  target?: string;
}
type ProcedureParse = ReturnType<typeof parseProcedure>;

async function tabUntilGraph(page: Page): Promise<string[]> {
  const visited: string[] = [];
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("Tab");
    const place = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return "none";
      if (el.closest(".inspector")) return "inspector";
      if (el.closest(".react-flow__edge")) return "edge";
      if (el.closest(".react-flow__controls")) return "controls";
      if (el.closest(".react-flow__node")) return "graph";
      if (el.closest(".toolbar")) return "toolbar";
      return "other";
    });
    visited.push(place);
    if (place === "graph") break;
  }
  return visited;
}

function installPreview(root: string): { previewFile: string; previous: string } {
  const previewFile = path.join(root, "webview/preview-data.json");
  const previous = fs.readFileSync(previewFile, "utf8");
  const initialRoot = path.join(root, "fixtures/release-samples/numbered-review");
  const initial = parseProcedure({ skillRoot: initialRoot, catalog: [] });
  const payload = {
    type: "graph",
    graph: parseSkill({ skillRoot: initialRoot, catalog: [] }),
    procedure: initial.graph,
    diagnosis: initial.diagnosis,
    catalog: [],
    direction: "TB",
  };
  fs.writeFileSync(previewFile, JSON.stringify(payload));
  return { previewFile, previous };
}

async function showSkill(page: Page, skillRoot: string): Promise<ProcedureParse> {
  const parsed = parseProcedure({ skillRoot, catalog: [] });
  await page.evaluate((message) => {
    window.postMessage(message, "*");
  }, {
    type: "graph",
    graph: parseSkill({ skillRoot, catalog: [] }),
    procedure: parsed.graph,
    diagnosis: parsed.diagnosis,
    catalog: [],
    direction: "TB",
  });
  return parsed;
}

function posted(page: Page): Promise<PreviewMessage[]> {
  return page.evaluate(
    () => (globalThis as { __previewMessages?: PreviewMessage[] }).__previewMessages ?? [],
  );
}

async function checkOverview(page: Page, output: string): Promise<void> {
  assert.equal(await page.locator('[role="tablist"]').count(), 1);
  assert.equal(await page.getByRole("tab", { name: "Flow", exact: true }).getAttribute("aria-selected"), "true");
  assert.match((await page.locator(".react-flow__node").first().getAttribute("aria-label")) ?? "", /^skill: SKILL\.md$/);
  assert(await page.getByRole("button", { name: "Show inspector", exact: true }).isVisible());
  const boxes = await page.locator(".react-flow__node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
    }),
  );
  const canvas = await page.locator(".graph").boundingBox();
  const inside =
    canvas !== null &&
    boxes.every(
      (box) =>
        box.x >= canvas.x - 1 &&
        box.y >= canvas.y - 1 &&
        box.right <= canvas.x + canvas.width + 1 &&
        box.bottom <= canvas.y + canvas.height + 1,
    );
  assert(inside, "Overview contains every node");
  await page.screenshot({ path: path.join(output, "dark-overview.png") });
}

async function checkOpenInstruction(page: Page): Promise<void> {
  await page.locator('[data-id="step:1"]').click();
  await page.getByRole("button", { name: "Open instruction", exact: true }).click();
  const messages = await posted(page);
  assert(messages.some((message) => message.type === "openFile" && message.nodeId === "step:1"));
  await page.getByRole("button", { name: "Hide inspector", exact: true }).click();
}

async function checkTabs(page: Page): Promise<void> {
  const flowTab = page.getByRole("tab", { name: "Flow", exact: true });
  await flowTab.focus();
  await page.keyboard.press("ArrowRight");
  const catalogTab = page.getByRole("tab", { name: "Catalog", exact: true });
  assert.equal(await catalogTab.getAttribute("aria-selected"), "true");
  const outline = await catalogTab.evaluate((el) => getComputedStyle(el).outlineStyle);
  assert.notEqual(outline, "none");
  assert(await page.locator(".inventory").isVisible());
  assert.equal(await page.locator('.inventory-row[aria-current="true"]').count(), 1);
  await page.keyboard.press("ArrowLeft");
  assert.equal(await flowTab.getAttribute("aria-selected"), "true");
  await page.locator(".react-flow__node").first().waitFor();
}

async function selectFocusedStep(page: Page, key: "Enter" | " "): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const visited = await tabUntilGraph(page);
  assert.equal(visited.at(-1), "graph");
  if (key === "Enter") {
    assert.equal(visited.includes("edge"), false);
    assert.equal(visited.includes("inspector"), false);
    assert.equal(visited[0], "toolbar");
  }
  await page.keyboard.press(key);
  await page.getByRole("button", { name: "Hide inspector", exact: true }).waitFor();
  await page.getByRole("button", { name: "Hide inspector", exact: true }).click();
}

async function checkResource(page: Page, root: string): Promise<ProcedureParse> {
  const sample = path.join(root, "fixtures/release-samples/asset-report");
  const parsed = await showSkill(page, sample);
  await page.locator('[data-id="step:1"]').click();
  await page.getByRole("button", { name: "Open referenced resource", exact: true }).click();
  const messages = await posted(page);
  assert(messages.some((message) => message.type === "openFile" && message.target === "resource"));
  return parsed;
}

async function checkNarrowError(page: Page, parsed: ProcedureParse): Promise<void> {
  await page.evaluate(() => {
    window.postMessage(
      { type: "error", message: "Could not read test file. Previous view preserved.", retryable: true },
      "*",
    );
  });
  await page.getByRole("alert").waitFor({ state: "visible" });
  await page.setViewportSize({ width: 320, height: 820 });
  const retryLines = await page.getByRole("button", { name: "Retry", exact: true }).evaluate((button) => {
    const range = document.createRange();
    range.selectNodeContents(button);
    return range.getClientRects().length;
  });
  assert.equal(retryLines, 1, "Narrow error banner keeps Retry on one line");
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "Narrow error banner does not overflow",
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.equal(await page.locator(".react-flow__node").count(), parsed.graph.nodes.length);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Hide inspector", exact: true }).click();
}

async function checkLightNarrow(page: Page, output: string): Promise<void> {
  await page.setViewportSize({ width: 420, height: 820 });
  await page.evaluate(() => {
    const styles: Record<string, string> = {
      "--vscode-editor-background": "#ffffff",
      "--vscode-foreground": "#222222",
      "--vscode-descriptionForeground": "#555555",
      "--vscode-editorWidget-background": "#f3f3f3",
      "--vscode-sideBar-background": "#f3f3f3",
      "--vscode-panel-border": "#cccccc",
      "--vscode-focusBorder": "#007acc",
    };
    for (const [key, value] of Object.entries(styles)) {
      document.documentElement.style.setProperty(key, value);
    }
  });
  await page.waitForTimeout(250);
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    "No horizontal page overflow",
  );
  const narrowCanvas = await page.locator(".graph").boundingBox();
  const narrowBoxes = await page.locator(".react-flow__node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, right: r.right };
    }),
  );
  const inside =
    narrowCanvas !== null &&
    narrowBoxes.every((box) => box.x >= narrowCanvas.x - 1 && box.right <= narrowCanvas.x + narrowCanvas.width + 1);
  assert(inside, "Narrow Compact overview contains every column");
  await page.screenshot({ path: path.join(output, "light-narrow.png") });
}

async function checkEmptyCatalog(page: Page, root: string): Promise<void> {
  const prose = path.join(root, "fixtures/release-samples/prose-translator");
  await showSkill(page, prose);
  await page.getByRole("button", { name: "Inspect files in Catalog", exact: true }).click();
  assert(await page.locator(".inventory").isVisible());
}

async function main(): Promise<void> {
  const root = process.cwd();
  const output = path.join(root, "artifacts/webview-check");
  fs.mkdirSync(output, { recursive: true });
  const { previewFile, previous } = installPreview(root);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(process.env.PREVIEW_URL ?? "http://127.0.0.1:5194/preview.html?view=flow&compact=1");
    await page.locator(".react-flow__node").first().waitFor();
    await page.waitForTimeout(350);
    await checkOverview(page, output);
    await checkOpenInstruction(page);
    await checkTabs(page);
    await selectFocusedStep(page, "Enter");
    await selectFocusedStep(page, " ");
    const parsed = await checkResource(page, root);
    await checkNarrowError(page, parsed);
    await checkLightNarrow(page, output);
    await checkEmptyCatalog(page, root);
    assert.deepEqual(errors, []);
    console.log(
      "Passed browser checks: overview bounds, collapse, source/resource messages, tablist, catalog current row, compact names, keyboard focus, error/retry, light/narrow layout, empty-state Catalog.",
    );
  } finally {
    await browser.close();
    fs.writeFileSync(previewFile, previous);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
