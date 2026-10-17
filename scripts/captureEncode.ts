import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { clipProblem } from "./demoClip";

export interface EncodePaths {
  display: string;
  rawVideo: string;
  outFile: string;
}

export function startRecording(paths: EncodePaths): ChildProcess {
  fs.rmSync(paths.rawVideo, { force: true });
  return spawn("ffmpeg", grabArgs(paths), {
    stdio: "ignore",
    env: displayEnv(paths.display),
  });
}

export async function stopRecording(recorder: ChildProcess): Promise<void> {
  recorder.kill("SIGINT");
  const exited = await exitedWithin(recorder, 4000);
  if (!exited) throw new Error("ffmpeg did not exit after SIGINT");
}

export function encodeGif(paths: EncodePaths): void {
  const palette = path.join(path.dirname(paths.rawVideo), "graphtale-demo-palette.png");
  const filter = "fps=10,scale=800:-1:flags=lanczos";
  run("ffmpeg", ["-y", "-i", paths.rawVideo, "-vf", `${filter},palettegen=max_colors=96:stats_mode=diff`, "-update", "1", palette], paths.display);
  run("ffmpeg", ["-y", "-i", paths.rawVideo, "-i", palette, "-lavfi", paletteUse(filter), paths.outFile], paths.display);
}

export function assertGif(file: string): void {
  const sizeBytes = fs.statSync(file).size;
  const durationSeconds = probeDuration(file);
  const problem = clipProblem(durationSeconds, sizeBytes);
  if (problem) throw new Error(`clip out of range: ${problem}`);
  console.log(`Wrote ${file} (${sizeBytes} bytes, ${durationSeconds.toFixed(2)}s)`);
}

function grabArgs(paths: EncodePaths): string[] {
  return [
    "-y", "-f", "x11grab", "-video_size", "1280x800", "-framerate", "20",
    "-i", paths.display, "-c:v", "libx264", "-pix_fmt", "yuv420p", paths.rawVideo,
  ];
}

function paletteUse(filter: string): string {
  return `${filter}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
}

function displayEnv(display: string): NodeJS.ProcessEnv {
  return { ...process.env, DISPLAY: display };
}

function run(command: string, args: string[], display: string): void {
  const result = spawnSync(command, args, { stdio: "inherit", env: displayEnv(display) });
  if (result.error) throw new Error(`${command} failed: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} exited ${result.status ?? "null"}`);
}

function probeDuration(file: string): number {
  const probed = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  if (probed.error) throw new Error(`ffprobe failed: ${probed.error.message}`);
  if (probed.status !== 0) throw new Error(`ffprobe exited ${probed.status ?? "null"}`);
  if (typeof probed.stdout !== "string") throw new Error("ffprobe returned no duration");
  const duration = Number(probed.stdout.trim());
  if (!Number.isFinite(duration)) throw new Error(`ffprobe duration is not a number: ${probed.stdout.trim()}`);
  return duration;
}

function exitedWithin(recorder: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (recorder.exitCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    recorder.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}
