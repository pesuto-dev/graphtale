/**
 * Record docs/media/demo.gif from a running VS Code window with Graphtale installed.
 *
 * The script writes the example skill to {os.tmpdir()}/graphtale-demo-ws
 * (.cursor/skills/review-change/SKILL.md). Open that folder in the workbench
 * before recording. The workbench must already be listening on CDP_URL
 * (default http://127.0.0.1:9222) under DISPLAY (default :99), with ffmpeg
 * and xdotool available:
 *   DISPLAY=:99 npx tsx scripts/capture-demo-gif.ts
 * The clip is a README asset. .vscodeignore keeps docs/media out of the VSIX.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Frame, type Locator, type Page } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const display = process.env.DISPLAY || ":99";
const cdp = process.env.CDP_URL || "http://127.0.0.1:9222";
const outFile = path.join(root, "docs/media/demo.gif");
const rawVideo = path.join(os.tmpdir(), "graphtale-demo.mp4");

const skill = `---
name: review-change
description: Review a change using its source evidence.
---

## Instructions

1. Read request

2. Gather files

3. Compare edits

4. Check evidence

5. Write findings

6. Return review
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(cmd: string, args: string[]): void {
  const result = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, DISPLAY: display } });
  if (result.status !== 0) throw new Error(`${cmd} exited ${result.status ?? "null"}`);
}

async function point(locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Recording target is not visible: bounding box is missing.");
  }
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  spawn("xdotool", ["mousemove", "--sync", String(x), String(y)], {
    stdio: "ignore",
    env: { ...process.env, DISPLAY: display },
  });
  await sleep(220);
}

async function workbench(): Promise<Page> {
  const browser = await chromium.connectOverCDP(cdp);
  const page = browser.contexts().flatMap((context) => context.pages()).find((item) => item.url().includes("workbench"));
  if (!page) throw new Error("VS Code workbench was not on the debugging port");
  page.setDefaultTimeout(8000);
  return page;
}

async function dismissSignIn(page: Page): Promise<void> {
  const skip = page.getByText("Continue without Signing In");
  if (await skip.count()) {
    await skip.first().click();
    await sleep(500);
  }
}

async function palette(page: Page, query: string, label: string): Promise<void> {
  await page.keyboard.press("Escape");
  await sleep(120);
  await page.keyboard.press("Control+Shift+P");
  await sleep(280);
  await page.keyboard.type(query, { delay: 28 });
  await sleep(320);
  const item = page.getByText(label, { exact: false }).first();
  await point(item);
  await item.click();
}

async function appFrame(page: Page): Promise<Frame> {
  for (let attempt = 0; attempt < 40; attempt++) {
    for (const frame of page.frames()) {
      if ((await frame.locator("#root .react-flow__node").count().catch(() => 0)) > 0) return frame;
    }
    await sleep(200);
  }
  throw new Error("Graphtale Flow did not render");
}

function startRecording(): ChildProcess {
  fs.rmSync(rawVideo, { force: true });
  return spawn(
    "ffmpeg",
    ["-y", "-f", "x11grab", "-video_size", "1280x800", "-framerate", "20", "-i", display, "-c:v", "libx264", "-pix_fmt", "yuv420p", rawVideo],
    { stdio: "ignore", env: { ...process.env, DISPLAY: display } },
  );
}

async function stopRecording(recorder: ChildProcess): Promise<void> {
  recorder.kill("SIGINT");
  await new Promise<void>((resolve) => {
    recorder.once("exit", () => resolve());
    setTimeout(resolve, 4000);
  });
}

function encodeGif(): void {
  const palette = path.join(os.tmpdir(), "graphtale-demo-palette.png");
  const filter = "fps=10,scale=800:-1:flags=lanczos";
  run("ffmpeg", ["-y", "-i", rawVideo, "-vf", `${filter},palettegen=max_colors=96:stats_mode=diff`, "-update", "1", palette]);
  run("ffmpeg", ["-y", "-i", rawVideo, "-i", palette, "-lavfi", `${filter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, outFile]);
}

async function demo(page: Page): Promise<void> {
  await dismissSignIn(page);
  const explorer = page.getByRole("treeitem", { name: ".cursor" });
  if ((await explorer.count()) === 0) await page.keyboard.press("Control+B");
  await palette(page, "Close All Editors", "Close All Editors");
  await page.keyboard.press("Escape");
  await page.locator(".quick-input-widget").waitFor({ state: "hidden", timeout: 3000 }).catch(() => undefined);
  await sleep(250);
  const recorder = startRecording();
  await sleep(700);
  try {
    await page.keyboard.press("Control+P");
    await sleep(350);
    await page.keyboard.type("SKILL.md", { delay: 70 });
    await sleep(450);
    await page.keyboard.press("Enter");
    await sleep(1000);
    const sidebar = page.getByRole("button", { name: "Toggle Primary Side Bar (Ctrl+B)" });
    if (await sidebar.count()) {
      await sidebar.first().click();
      await sleep(300);
    }
    await page.keyboard.press("Control+Shift+P");
    await sleep(300);
    await page.keyboard.type("Agent Skill Flow", { delay: 42 });
    await sleep(400);
    const command = page.getByText("Graphtale: Open Agent Skill Flow", { exact: true });
    await point(command);
    await command.click();
    const frame = await appFrame(page);
    await sleep(1500);
    const step = frame.locator(".react-flow__node", { hasText: "Compare edits" }).first();
    await point(step);
    await step.click({ force: true });
    await sleep(650);
    const open = frame.getByRole("button", { name: "Open instruction" });
    await point(open);
    await open.click();
    await sleep(3800);
  } finally {
    await stopRecording(recorder);
  }
}

function prepareWorkspace(): void {
  const skillDir = path.join(os.tmpdir(), "graphtale-demo-ws/.cursor/skills/review-change");
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skill, "utf8");
}

async function main(): Promise<void> {
  prepareWorkspace();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const page = await workbench();
  await demo(page);
  encodeGif();
  const size = fs.statSync(outFile).size;
  const probed = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", outFile], { encoding: "utf8" });
  const duration = Number(probed.stdout.trim());
  console.log(`Wrote ${path.relative(root, outFile)} (${size} bytes, ${duration.toFixed(2)}s)`);
  if (!(duration >= 10 && duration <= 15) || size >= 3 * 1024 * 1024) {
    throw new Error(`clip out of range: ${duration}s ${size} bytes`);
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
