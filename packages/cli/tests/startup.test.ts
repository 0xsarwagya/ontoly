import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

describe("CLI startup", () => {
  // The TypeScript compiler costs ~170 ms and ~75 MB to load. Only commands that build or analyze load it, on demand,
  // so nothing the binary imports statically may reach it. Needs a build, which CI runs before the tests.
  it.skipIf(!existsSync(cli))("starts without loading the TypeScript compiler", () => {
    const directory = mkdtempSync(join(tmpdir(), "ontoly-startup-"));
    const hooks = join(directory, "hooks.mjs");
    writeFileSync(
      hooks,
      `export async function resolve(specifier, context, next) {
        const result = await next(specifier, context);
        if (/\\/typescript\\/lib\\/typescript\\.js$/.test(result.url)) process.stderr.write("TYPESCRIPT_LOADED\\n");
        return result;
      }\n`,
    );
    const register = join(directory, "register.mjs");
    writeFileSync(register, `import { register } from "node:module";\nregister(${JSON.stringify(pathToFileURL(hooks).href)});\n`);

    const result = spawnSync(process.execPath, ["--import", pathToFileURL(register).href, cli, "--version"], { encoding: "utf8" });

    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^ontoly \d/);
    expect(result.stderr).not.toContain("TYPESCRIPT_LOADED");
  });
});
