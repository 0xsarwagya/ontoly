import { describe, expect, it } from "vitest";
import {
  doctorOntolySkills,
  listOntolySkills,
  validateOntolySkills,
} from "../src/skills";

describe("Ontoly Agent Skills", () => {
  it("lists installable skills with versions and capability requirements", async () => {
    const skills = await listOntolySkills(process.cwd());
    const architectureReview = skills.find((skill) => skill.id === "architecture-review");

    expect(skills.length).toBeGreaterThanOrEqual(14);
    expect(architectureReview?.version).toBe("0.1.0-alpha.2");
    expect(architectureReview?.minimumOntolyVersion).toBe("0.1.0-alpha.10");
    expect(architectureReview?.enhancement).toBe("LLM Enhancement");
    expect(architectureReview?.capabilities).toContain("ExplainArchitecture");
    expect(architectureReview?.capabilities).toContain("EvidencePack");
  });

  it("validates skill structure, references, templates, and agent evaluation checks", async () => {
    const report = await validateOntolySkills(process.cwd());

    expect(report.status).toBe("PASS");
    expect(report.validSkills).toBe(report.totalSkills);
    expect(report.issues).toEqual([]);
    expect(report.agentEvaluation.status).toBe("PASS");
    expect(report.agentEvaluation.aggregate.usesOntoly).toBe(100);
    expect(report.agentEvaluation.aggregate.usesMcp).toBe(100);
    expect(report.agentEvaluation.aggregate.requiresLlmEnhancement).toBe(100);
  });

  it("doctors the skill catalog with actionable recommendations", async () => {
    const report = await doctorOntolySkills(process.cwd());

    expect(report.status).toBe("PASS");
    expect(report.recommendations).toContain("Skills are ready. Run ontoly skills validate before release.");
  });
});
