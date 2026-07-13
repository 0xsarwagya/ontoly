#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");
const CLI = join(PROJECT_ROOT, "packages", "cli", "dist", "cli.js");

main().catch((error) => {
  writeErr(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

function writeOut(message = "") {
  process.stdout.write(`${message}\n`);
}

function writeErr(message = "") {
  process.stderr.write(`${message}\n`);
}

async function main() {
  await validateInstall("architecture-review");
  await validateInstall("*");
  writeOut("Installed skill validation: PASS");
}

async function validateInstall(skill) {
  const workspace = await mkdtemp(join(tmpdir(), "ontoly-installed-skills-"));
  try {
    run("npx", [
      "skills",
      "add",
      PROJECT_ROOT,
      "--skill",
      skill,
      "--agent",
      "codex",
      "--copy",
      "--yes",
    ], workspace);

    run(process.execPath, [CLI, "skills", "validate", "--ci", "--no-color"], workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    writeErr(result.stdout.trim());
    writeErr(result.stderr.trim());
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}.`);
  }
}
