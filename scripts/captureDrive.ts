import { spawnSync } from "node:child_process";
import { chromium, type Browser, type Frame, type Locator, type Page } from "playwright";
import { pointerCenter } from "./demoClip";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectWorkbench(cdpUrl: string): Promise<Page> {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const page = workbenchPage(browser);
  page.setDefaultTimeout(8000);
  return page;
}

export async function prepareWorkbench(page: Page, display: string): Promise<void> {
  await dismissSignIn(page);
  await showExplorer(page);
  await runPalette(page, display, "Close All Editors", "Close All Editors");
  await page.keyboard.press("Escape");
  await page.locator(".quick-input-widget").waitFor({ state: "hidden", timeout: 3000 });
  await sleep(250);
}

export async function playDemo(page: Page, display: string): Promise<void> {
  await openSkillFile(page);
  await hideSidebar(page);
  const frame = await openFlow(page, display);
  await highlightCompareEdits(frame, display);
}

function workbenchPage(browser: Browser): Page {
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page = pages.find((item) => item.url().includes("workbench"));
  if (!page) throw new Error("VS Code workbench was not on the debugging port");
  return page;
}

async function dismissSignIn(page: Page): Promise<void> {
  const skip = page.getByText("Continue without Signing In");
  const count = await skip.count();
  if (count === 0) return;
  await skip.first().click();
  await sleep(500);
}

async function showExplorer(page: Page): Promise<void> {
  const explorer = page.getByRole("treeitem", { name: ".cursor" });
  const count = await explorer.count();
  if (count > 0) return;
  await page.keyboard.press("Control+B");
}

async function runPalette(page: Page, display: string, query: string, label: string): Promise<void> {
  await page.keyboard.press("Escape");
  await sleep(120);
  await page.keyboard.press("Control+Shift+P");
  await sleep(280);
  await page.keyboard.type(query, { delay: 28 });
  await sleep(320);
  const item = page.getByText(label, { exact: false }).first();
  await movePointer(item, display);
  await item.click();
}

async function openSkillFile(page: Page): Promise<void> {
  await page.keyboard.press("Control+P");
  await sleep(350);
  await page.keyboard.type("SKILL.md", { delay: 70 });
  await sleep(450);
  await page.keyboard.press("Enter");
  await sleep(1000);
}

async function hideSidebar(page: Page): Promise<void> {
  const sidebar = page.getByRole("button", { name: "Toggle Primary Side Bar (Ctrl+B)" });
  const count = await sidebar.count();
  if (count === 0) return;
  await sidebar.first().click();
  await sleep(300);
}

async function openFlow(page: Page, display: string): Promise<Frame> {
  await page.keyboard.press("Control+Shift+P");
  await sleep(300);
  await page.keyboard.type("Agent Skill Flow", { delay: 42 });
  await sleep(400);
  const command = page.getByText("Graphtale: Open Agent Skill Flow", { exact: true });
  await movePointer(command, display);
  await command.click();
  const frame = await flowFrame(page);
  await sleep(1500);
  return frame;
}

async function highlightCompareEdits(frame: Frame, display: string): Promise<void> {
  const step = frame.locator(".react-flow__node", { hasText: "Compare edits" }).first();
  await movePointer(step, display);
  await step.click({ force: true });
  await sleep(650);
  const open = frame.getByRole("button", { name: "Open instruction" });
  await movePointer(open, display);
  await open.click();
  await sleep(3800);
}

async function flowFrame(page: Page): Promise<Frame> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const found = await firstNodeFrame(page.frames());
    if (found) return found;
    await sleep(200);
  }
  throw new Error("Graphtale Flow did not render");
}

async function firstNodeFrame(frames: Frame[]): Promise<Frame | undefined> {
  for (const frame of frames) {
    if (await hasFlowNodes(frame)) return frame;
  }
  return undefined;
}

async function hasFlowNodes(frame: Frame): Promise<boolean> {
  if (!frame.url().includes("index.html")) return false;
  const count = await frame.locator("#root .react-flow__node").count();
  return count > 0;
}

function exitStatus(status: number | null): string {
  if (status === null) return "null";
  return String(status);
}

async function movePointer(locator: Locator, display: string): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Recording target is not visible: bounding box is missing.");
  const center = pointerCenter(box);
  const result = spawnSync("xdotool", ["mousemove", "--sync", String(center.x), String(center.y)], {
    stdio: "ignore",
    env: { ...process.env, DISPLAY: display },
  });
  if (result.error) throw new Error(`xdotool failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`xdotool exited ${exitStatus(result.status)}`);
  await sleep(220);
}
