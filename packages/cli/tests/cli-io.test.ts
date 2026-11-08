import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

function repositoryWithOneFunction(): string {
  const directory = mkdtempSync(join(tmpdir(), "ontoly-cli-io-"));
  writeFileSync(join(directory, "index.ts"), "export function helper(): string {\n  return \"ok\";\n}\n");
  return directory;
}

function runCli(args: readonly string[], input = ""): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [cli, ...args], { cwd: repositoryWithOneFunction(), input, encoding: "utf8" });
}

// Needs a build, which CI runs before the tests.
describe.skipIf(!existsSync(cli))("CLI input handling", () => {
  it("keeps the argument after a boolean flag as the query", () => {
    const result = runCli(["search", "--json", "helper"]);

    expect(JSON.parse(String(result.stdout)).query).toBe("helper");
  });

  it("answers an MCP request that has no trailing newline", () => {
    const result = runCli(["mcp"], "{\"capability\":\"GraphStatistics\"}");

    expect(JSON.parse(String(result.stdout)).capability).toBe("GraphStatistics");
  });
});
