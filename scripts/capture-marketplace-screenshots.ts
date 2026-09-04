/**
 * Captures marketplace screenshots from the browser preview harness.
 *
 * Usage:
 *   npm run compile:webview
 *   npx tsx scripts/capture-marketplace-screenshots.ts
 *   npx tsx scripts/capture-marketplace-screenshots.ts --demos
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.join(root, "node_modules/vite/bin/vite.js");
const outDir = path.join(root, "assets/marketplace");
const previewDataFile = path.join(root, "webview/preview-data.json");
const emptyHome = path.join(root, "fixtures/empty-home");
const projectFolder = path.join(root, "fixtures/project");
const viewport = { width: 1280, height: 720 };
const demoViewport = { width: 1440, height: 900 };
const demoDir = path.join(root, "assets/demo-skills");
const captureDemos = process.argv.includes("--demos");

type Shot = {
  file: string;
  skill: string;
  query: string;
  waitFor?: string;
  click?: string;
  /** Defaults to marketplace listing dir. Compact baseline is not a listing shot. */
  destDir?: string;
};

const marketplaceShots: Shot[] = [
  {
    file: "procedure-analyse-ticket.png",
    skill: "fixtures/analyse-ticket-pn",
    query: "view=flow",
    waitFor: ".react-flow__node",
  },
  {
    file: "catalog-analyse-ticket.png",
    skill: "fixtures/analyse-ticket-pn",
    query: "view=catalog",
    waitFor: ".inventory",
  },
  {
    file: "procedure-none-diagnosis.png",
    skill: "fixtures/public-skills/prose-only",
    query: "view=flow",
    waitFor: ".diagnosis-banner",
  },
  {
    file: "analyse-ticket-compact.png",
    skill: "fixtures/analyse-ticket-pn",
    query: "view=flow&compact=1",
    waitFor: ".react-flow__node.rf-compact",
    destDir: path.join(root, "assets/compact-baseline"),
  },
];

const demoRoot = path.join(root, "fixtures/demo-skills");
const demoSkills = fs
  .readdirSync(demoRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(demoRoot, entry.name, "SKILL.md")))
  .map((entry) => entry.name)
  .sort();

const demoShots: Shot[] = demoSkills.flatMap((name) => {
  const skill = `fixtures/demo-skills/${name}`;
  return [
    {
      file: `${name}-compact.png`,
      skill,
      query: "view=flow&compact=1",
      waitFor: ".react-flow__node.rf-compact",
      destDir: demoDir,
    },
    {
      file: `${name}-tb.png`,
      skill,
      query: "view=flow",
      waitFor: ".react-flow__node",
      destDir: demoDir,
    },
    {
      file: `${name}-lr.png`,
      skill,
      query: "view=flow",
      waitFor: ".react-flow__node",
      click: 'button:has-text("Layout")',
      destDir: demoDir,
    },
  ];
});

const shots = captureDemos ? demoShots : marketplaceShots;

async function writePreviewData(skillRelative: string): Promise<void> {
  const { discoverSkills } = await import("../src/discover.ts");
  const { parseProcedure } = await import("../src/parseProcedure.ts");
  const { parseSkill } = await import("../src/parseSkill.ts");

  const skillRoot = path.join(root, skillRelative);
  const catalog = discoverSkills({
    workspaceFolders: [projectFolder],
    homedir: emptyHome,
  });
  const graph = parseSkill({ skillRoot, catalog, homedir: emptyHome });
  const { graph: procedure, diagnosis } = parseProcedure({
    skillRoot,
    catalog,
    homedir: emptyHome,
  });

  const message = {
    type: "graph",
    graph,
    procedure,
    pipeline: procedure,
    diagnosis,
    catalog,
    direction: "TB",
  };

  fs.writeFileSync(previewDataFile, JSON.stringify(message, null, 2) + "\n", "utf8");
}

function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(2_000, () => {
        req.destroy();
        retry();
      });
    };
    const retry = (): void => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Preview server did not start within ${timeoutMs}ms (${url})`));
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  });
}

function waitForViteReady(
  child: ChildProcessWithoutNullStreams,
  timeoutMs = 30_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Vite dev server did not log a ready URL"));
    }, timeoutMs);
    const onData = (chunk: Buffer): void => {
      if (/Local:\s+http/i.test(chunk.toString())) {
        clearTimeout(timer);
        child.stdout.off("data", onData);
        child.stderr.off("data", onData);
        resolve();
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
  });
}

function startPreviewServer(port: number): ChildProcessWithoutNullStreams {
  const child = spawn(process.execPath, [viteBin, "--port", String(port), "--strictPort"], {
    cwd: root,
    stdio: "pipe",
    env: { ...process.env, BROWSER: "none" },
  });
  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    if (/Local:/.test(text)) {
      process.stdout.write(text);
    }
  });
  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });
  return child;
}

async function pickPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Could not allocate preview port"));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function captureShot(page: Page, baseUrl: string, shot: Shot): Promise<void> {
  await writePreviewData(shot.skill);
  await page.goto(`${baseUrl}/preview.html?${shot.query}`, { waitUntil: "networkidle" });
  if (shot.waitFor) {
    await page.locator(shot.waitFor).first().waitFor({ state: "visible", timeout: 15_000 });
  }
  if (shot.click) {
    await page.locator(shot.click).click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(400);
  const destDir = shot.destDir ?? outDir;
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, shot.file);
  await page.screenshot({
    path: dest,
    fullPage: false,
  });
  console.log(`Wrote ${path.relative(root, dest)} (${shot.skill}, ${shot.query})`);
}

async function main(): Promise<void> {
  fs.mkdirSync(outDir, { recursive: true });
  const port = await pickPort();
  const baseUrl = `http://localhost:${port}`;
  const server = startPreviewServer(port);

  try {
    await waitForViteReady(server);
    await waitForServer(`${baseUrl}/preview.html`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: captureDemos ? demoViewport : viewport,
    });
    await page.emulateMedia({ colorScheme: "dark" });

    for (const shot of shots) {
      await captureShot(page, baseUrl, shot);
    }

    await browser.close();
  } finally {
    server.stdout?.destroy();
    server.stderr?.destroy();
    server.kill("SIGKILL");
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
