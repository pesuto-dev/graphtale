import * as path from "node:path";
import { expect, it } from "vitest";
import { backupSteps, type BackupInput } from "./repairBackup";

function commands(skillDir: string, homedir: string): { bash: string; powershell: string; folder: string; target: string } {
  const folder = path.resolve(skillDir);
  const home = path.resolve(homedir);
  const input: BackupInput = { skillName: "demo", skillFile: path.join(folder, "SKILL.md"), homedir: home };
  const steps = backupSteps(input);
  const bash = steps.find((line) => line.includes("macOS/Linux")) ?? "";
  const powershell = steps.find((line) => line.includes("PowerShell")) ?? "";
  expect(bash).not.toBe("");
  expect(powershell).not.toBe("");
  return { bash, powershell, folder, target: path.join(home, ".graphtale", "backups", "demo") };
}

it("keeps a command substitution in a path literal", () => {
  const { bash, powershell, folder, target } = commands("/tmp/skill$(id)", "/tmp/home$(whoami)");
  expect(bash).toContain(`mkdir -p '${target}' && cp -R '${folder}' '${target}'/$(date +%Y%m%d-%H%M%S)`);
  expect(powershell).toContain(`Join-Path '${target}' (Get-Date -Format yyyyMMdd-HHmmss)`);
  expect(powershell).toContain(`Copy-Item -Recurse '${folder}'`);
});

it("keeps a backtick in a path literal", () => {
  const dir = "/tmp/skill`tick`";
  const { bash, powershell, folder, target } = commands(dir, "/tmp/home`tick`");
  expect(bash).toContain(`'${folder}'`);
  expect(bash).toContain(`'${target}'`);
  expect(powershell).toContain(`'${folder}'`);
  expect(powershell).toContain(`'${target}'`);
});

it("keeps a double quote in a path literal", () => {
  const { bash, powershell, folder, target } = commands('/tmp/skill"q"', '/tmp/home"q"');
  expect(bash).toContain(`'${folder}'`);
  expect(bash).toContain(`'${target}'`);
  expect(powershell).toContain(`'${folder}'`);
  expect(powershell).toContain(`'${target}'`);
});

it("escapes a single quote in POSIX and PowerShell paths", () => {
  const { bash, powershell, folder, target } = commands("/tmp/skill'a'", "/tmp/home'b'");
  expect(bash).toContain(`'${folder.replaceAll("'", "'\\''")}'`);
  expect(bash).toContain(`'${target.replaceAll("'", "'\\''")}'`);
  expect(powershell).toContain(`'${folder.replaceAll("'", "''")}'`);
  expect(powershell).toContain(`'${target.replaceAll("'", "''")}'`);
});

it("keeps a variable expansion in a path literal", () => {
  const { bash, powershell, folder, target } = commands("/tmp/skill$HOME", "/tmp/home$USER");
  expect(bash).toContain(`cp -R '${folder}' '${target}'/$(date +%Y%m%d-%H%M%S)`);
  expect(powershell).toContain(`New-Item -ItemType Directory -Force '${target}'`);
  expect(powershell).toContain(`Copy-Item -Recurse '${folder}'`);
});
