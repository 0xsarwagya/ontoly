#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const reportPath = path.join(root, "NEW_USER_REPORT.md");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ontoly-new-user-"));
const exampleRoot = path.join(tempRoot, "basic");
const cli = path.join(root, "packages", "cli", "dist", "cli.js");
const steps = [];

fs.cpSync(path.join(root, "examples", "basic"), exampleRoot, {
  recursive: true,
  filter: (source) => !source.includes(`${path.sep}ontoly-output`) && !source.includes(`${path.sep}.ontoly`),
});

try {
  runStep("CLI help", ["node", cli, "--help"]);
  runStep("Build Software Graph", ["node", cli, "build", exampleRoot, "--json"]);
  runStep("Search UserService", ["node", cli, "search", "UserService", "--root", exampleRoot, "--json"]);
  runStep("Impact UserService", ["node", cli, "impact", "UserService", "--root", exampleRoot, "--json"]);
  runStep("Build Semantics", ["node", cli, "semantics", "build", exampleRoot, "--output", ".ontoly", "--json"]);
  runStep("Evidence authentication", ["node", cli, "evidence", "authentication", "--root", exampleRoot, "--json"]);
  runStep("List MCP capabilities", ["node", cli, "mcp", "--list"]);
  runStep("Validate Skills", ["node", cli, "skills", "validate", "--ci"]);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

const pass = steps.every((step) => step.exitCode === 0);
const lines = [
  "# New User Report",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Repository: ${root}`,
  "",
  "## Verdict",
  "",
  pass ? "PASS" : "FAIL",
  "",
  "## Workflow",
  "",
  "| Step | Exit | Duration | Notes |",
  "| --- | ---: | ---: | --- |",
  ...steps.map((step) =>
    `| ${escapePipe(step.name)} | ${step.exitCode} | ${step.durationMs}ms | ${escapePipe(step.note)} |`
  ),
  "",
  "## Confusing Steps",
  "",
  pass
    ? "- None observed in the source-checkout smoke path."
    : "- One or more documented commands failed; inspect the notes above.",
  "",
  "## Scope",
  "",
  "- Uses the built source checkout CLI at `packages/cli/dist/cli.js`.",
  "- Copies `examples/basic` into a temporary directory so the example tree stays clean.",
  "- Exercises install-adjacent first-run behavior after `pnpm install` and `pnpm build` have completed.",
  "- Does not start a long-running MCP server; it verifies capability listing with `ontoly mcp --list`.",
  "",
];

fs.writeFileSync(reportPath, `${lines.join("\n")}\n`);
console.log(`${pass ? "New user smoke: PASS" : "New user smoke: FAIL"} (${reportPath})`);
process.exit(pass ? 0 : 1);

function runStep(name, command) {
  const start = Date.now();
  const result = spawnSync(command[0], command.slice(1), {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const durationMs = Date.now() - start;
  const output = `${result.stdout}\n${result.stderr}`.trim();
  steps.push({
    name,
    exitCode: result.status ?? 1,
    durationMs,
    note: summarize(output),
  });
}

function summarize(output) {
  if (!output) {
    return "No output.";
  }
  const line = output
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item.length > 0);
  return line ? line.slice(0, 180) : "No output.";
}

function escapePipe(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}
