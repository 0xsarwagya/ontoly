import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildSoftwareGraph } from "@0xsarwagya/ontoly-compiler";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultCompilerPasses } from "../src/passes";

const FIXTURE: Readonly<Record<string, string>> = {
  "package.json": JSON.stringify({ name: "identity-fixture" }),
  "src/aardvark.ts": "export function aardvark(): string { return zebra(); }\nimport { zebra } from \"./zebra\";\n",
  "src/zebra.ts": "export function zebra(): string { return \"z\"; }\nexport function Zulu(): void {}\n",
  "src/Apple.ts": "import { missing } from \"./missing\";\nexport const apple = missing;\n",
  "src/ångström.ts": "export function ångström(): number { return 1; }\n",
};

async function buildFixtureAt(...segments: readonly string[]): Promise<string> {
  const root = join(await mkdtemp(join(tmpdir(), "ontoly-identity-")), ...segments);
  for (const [file, contents] of Object.entries(FIXTURE)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), contents, "utf8");
  }
  const graph = await buildSoftwareGraph({ root, cache: false, write: false, passes: defaultCompilerPasses() });
  return graph.metadata.deterministicHash;
}

function collateAs(locale: string): void {
  const collator = new Intl.Collator(locale);
  vi.spyOn(String.prototype, "localeCompare").mockImplementation(function (this: string, that: string) {
    return collator.compare(this, that);
  });
}

describe("graph identity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the same under different locales and checkout paths", async () => {
    collateAs("en-US");
    const english = await buildFixtureAt("one", "checkout");
    collateAs("da-DK");
    const danish = await buildFixtureAt("two", "deeper", "other-checkout");

    expect(danish).toBe(english);
  }, 180_000);
});
