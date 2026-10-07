import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { doctorRepository } from "../src/index";

describe("doctorRepository", () => {
  it("finds the graph where ontoly build writes it, not only in .ontoly", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-doctor-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");
    await mkdir(join(root, "ontoly-output"), { recursive: true });
    await writeFile(join(root, "ontoly-output", "SoftwareGraph.json"), "{}", "utf8");

    const graph = (await doctorRepository(root)).find((check) => check.name === "graph artifacts");

    expect(graph?.ok).toBe(true);
    expect(graph?.message).toBe(join(root, "ontoly-output", "SoftwareGraph.json"));
  });

  it("reports a missing graph at the path a default build will write", async () => {
    const root = await mkdtemp(join(tmpdir(), "ontoly-doctor-missing-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ name: "fixture" }), "utf8");

    const graph = (await doctorRepository(root)).find((check) => check.name === "graph artifacts");

    expect(graph?.ok).toBe(false);
    expect(graph?.message).toBe(join(root, "ontoly-output", "SoftwareGraph.json"));
  });
});
