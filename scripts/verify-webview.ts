/** Browser-only UI checks. Start npm run preview first; this is not editor-host coverage. */
import * as path from "node:path";
import * as fs from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { parseSkill } from "../src/parseSkill";
import { parseProcedure } from "../src/parseProcedure";
async function main() {
const root = process.cwd();
const output = path.join(root, "artifacts/webview-check");
fs.mkdirSync(output, { recursive: true });
const previewFile = path.join(root, "webview/preview-data.json");
const previous = fs.readFileSync(previewFile, "utf8");
const initialRoot = path.join(root, "fixtures/release-samples/numbered-review");
const initial = parseProcedure({ skillRoot: initialRoot, catalog: [] });
fs.writeFileSync(previewFile, JSON.stringify({ type: "graph", graph: parseSkill({ skillRoot: initialRoot, catalog: [] }), procedure: initial.graph, diagnosis: initial.diagnosis, catalog: [], direction: "TB" }));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
try {
  await page.goto(process.env.PREVIEW_URL ?? "http://127.0.0.1:5194/preview.html?view=flow&compact=1");
  await page.locator('.react-flow__node').first().waitFor();
  await page.waitForTimeout(350);
  assert(await page.getByRole('button', { name: 'Show inspector', exact: true }).isVisible());
  const boxes = await page.locator('.react-flow__node').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; }));
  const canvas = await page.locator('.graph').boundingBox();
  assert(canvas && boxes.every(b => b.x >= canvas.x - 1 && b.y >= canvas.y - 1 && b.right <= canvas.x + canvas.width + 1 && b.bottom <= canvas.y + canvas.height + 1), 'Overview contains every node');
  await page.screenshot({ path: path.join(output, 'dark-overview.png') });
  await page.locator('[data-id="step:1"]').click();
  await page.getByRole('button', { name: 'Open instruction', exact: true }).click();
  assert(await page.evaluate(() => (globalThis as any).__previewMessages.some((m: any) => m.type === 'openFile' && m.nodeId === 'step:1')));
  await page.getByRole('button', { name: 'Hide inspector', exact: true }).click();
  await page.keyboard.press('Tab');
  await page.getByRole('button', { name: 'Catalog', exact: true }).focus();
  const outline = await page.getByRole('button', { name: 'Catalog', exact: true }).evaluate(el => getComputedStyle(el).outlineStyle);
  assert.notEqual(outline, 'none');
  await page.keyboard.press('Enter');
  assert(await page.locator('.inventory').isVisible());
  const sample = path.join(root, 'fixtures/release-samples/asset-report');
  const parsed = parseProcedure({ skillRoot: sample, catalog: [] });
  await page.evaluate(message => window.postMessage(message, '*'), { type: 'graph', graph: parseSkill({ skillRoot: sample, catalog: [] }), procedure: parsed.graph, diagnosis: parsed.diagnosis, catalog: [], direction: 'TB' });
  await page.locator('[data-id="step:1"]').click();
  await page.getByRole('button', { name: 'Open referenced resource', exact: true }).click();
  assert(await page.evaluate(() => (globalThis as any).__previewMessages.some((m: any) => m.type === 'openFile' && m.target === 'resource')));
  await page.evaluate(() => window.postMessage({ type: 'error', message: 'Could not read test file. Previous view preserved.', retryable: true }, '*'));
  await page.getByRole('alert').waitFor({ state: 'visible' });
  await page.setViewportSize({ width: 320, height: 820 });
  const retryLines = await page.getByRole('button', { name: 'Retry', exact: true }).evaluate(button => {
    const range = document.createRange();
    range.selectNodeContents(button);
    return range.getClientRects().length;
  });
  assert.equal(retryLines, 1, 'Narrow error banner keeps Retry on one line');
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Narrow error banner does not overflow');
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.equal(await page.locator('.react-flow__node').count(), parsed.graph.nodes.length);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Hide inspector', exact: true }).click();
  await page.setViewportSize({ width: 420, height: 820 });
  await page.evaluate(() => { const styles = { '--vscode-editor-background': '#ffffff', '--vscode-foreground': '#222222', '--vscode-descriptionForeground': '#555555', '--vscode-editorWidget-background': '#f3f3f3', '--vscode-sideBar-background': '#f3f3f3', '--vscode-panel-border': '#cccccc', '--vscode-focusBorder': '#007acc' }; for (const [key, value] of Object.entries(styles)) document.documentElement.style.setProperty(key, value); });
  await page.waitForTimeout(250);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'No horizontal page overflow');
  const narrowCanvas = await page.locator('.graph').boundingBox();
  const narrowBoxes = await page.locator('.react-flow__node').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, right: r.right }; }));
  assert(narrowCanvas && narrowBoxes.every(b => b.x >= narrowCanvas.x - 1 && b.right <= narrowCanvas.x + narrowCanvas.width + 1), 'Narrow Compact overview contains every column');
  await page.screenshot({ path: path.join(output, 'light-narrow.png') });
  const prose = path.join(root, 'fixtures/release-samples/prose-translator');
  const empty = parseProcedure({ skillRoot: prose, catalog: [] });
  await page.evaluate(message => window.postMessage(message, '*'), { type: 'graph', graph: parseSkill({ skillRoot: prose, catalog: [] }), procedure: empty.graph, diagnosis: empty.diagnosis, catalog: [], direction: 'TB' });
  await page.getByRole('button', { name: 'Inspect files in Catalog', exact: true }).click();
  assert(await page.locator('.inventory').isVisible());
  assert.deepEqual(errors, []);
  console.log('Passed browser checks: overview bounds, collapse, source/resource messages, keyboard focus, error/retry, light/narrow layout, empty-state Catalog.');
} finally { await browser.close(); fs.writeFileSync(previewFile, previous); }

}
main().catch(error => { console.error(error); process.exitCode = 1; });
