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
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { captureCdp, captureDisplay } from "./captureConfig";
import { connectWorkbench, playDemo, prepareWorkbench } from "./captureDrive";
import { assertGif, encodeGif, startRecording, stopRecording, type EncodePaths } from "./captureEncode";
import { DEMO_SKILL, demoSkillFile } from "./demoWorkspace";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function captureDemoGif(): Promise<void> {
  const display = captureDisplay(process.env);
  const paths: EncodePaths = {
    display,
    rawVideo: path.join(os.tmpdir(), "graphtale-demo.mp4"),
    outFile: path.join(root, "docs", "media", "demo.gif"),
  };
  writeDemoSkill(os.tmpdir());
  fs.mkdirSync(path.dirname(paths.outFile), { recursive: true });
  const page = await connectWorkbench(captureCdp(process.env));
  await prepareWorkbench(page, display);
  const recorder = startRecording(paths);
  try {
    await playDemo(page, display);
  } finally {
    await stopRecording(recorder);
  }
  encodeGif(paths);
  assertGif(paths.outFile);
}

function writeDemoSkill(tmpdir: string): void {
  const file = demoSkillFile(tmpdir);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, DEMO_SKILL, "utf8");
}

captureDemoGif().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
