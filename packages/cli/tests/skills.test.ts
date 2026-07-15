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
    expect(architectureReview?.version).toBe("0.1.0-alpha.18");
    expect(architectureReview?.minimumOntolyVersion).toBe("0.1.0-alpha.18");
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

  it("keeps Codex, Claude, and Generic skill consumers compatible with bounded partial outputs", async () => {
    const report = await validateOntolySkills(process.cwd());
    const partialOutput = boundedPartialCapabilityOutput();

    expect(report.status).toBe("PASS");
    for (const agent of ["Codex", "Claude", "Generic"]) {
      expect(partialOutput.summary).toContain("deterministic partial plan");
      expect(partialOutput.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "CAPABILITY_PARTIAL_PLAN" }),
      ]));
      expect(partialOutput.statistics.budget).toMatchObject({
        status: "PARTIAL",
        reason: "NODE_BUDGET_EXCEEDED",
      });
      expect(partialOutput.evidence[0]).toMatchObject({
        kind: "path",
        confidence: expect.any(Number),
      });
      expect(partialOutput.confidence).toMatchObject({
        level: "medium",
        score: expect.any(Number),
      });
      expect(agent).toMatch(/Codex|Claude|Generic/);
    }
  });
});

function boundedPartialCapabilityOutput() {
  return {
    summary: "Implementation plan for \"sleep duration thresholds\" returned a deterministic partial plan.",
    evidence: [
      {
        kind: "path",
        description: "Semantic expansion identifies adjacent implementation boundaries.",
        confidence: 0.85,
        nodes: [
          { id: "model:SleepDurationThreshold", type: "Model", name: "SleepDurationThreshold", file: "src/sleep/thresholds.ts" },
        ],
        edges: [
          { id: "edge:references:fixture", type: "REFERENCES", from: "method:SleepObservationService.recordStatistics", to: "model:SleepDurationThreshold" },
        ],
      },
    ],
    affectedNodes: {
      Services: [
        { id: "service:SleepObservationService", type: "Service", name: "SleepObservationService", file: "src/sleep/sleep-observation.service.ts" },
      ],
    },
    affectedFiles: [
      "src/sleep/sleep-observation.service.ts",
      "src/sleep/thresholds.ts",
    ],
    affectedPackages: [],
    statistics: {
      budget: {
        status: "PARTIAL",
        nodeBudget: 3,
        timeoutMs: 250,
        visitedNodes: 3,
        remainingNodes: 7,
        reason: "NODE_BUDGET_EXCEEDED",
      },
    },
    confidence: {
      score: 0.8,
      level: "medium",
      explanation: "Computed from bounded graph evidence and one partial diagnostic.",
      factors: [
        { kind: "path", confidence: 0.85, description: "Semantic expansion identifies adjacent implementation boundaries." },
      ],
    },
    diagnostics: [
      {
        code: "CAPABILITY_PARTIAL_PLAN",
        severity: "warning",
        message: "Implementation plan hit the node budget and returned partial evidence.",
      },
    ],
    recommendations: [
      "Continue with ontoly evidence \"sleep duration thresholds\" or raise --budget after reviewing this partial plan.",
    ],
    graph: {
      source: "Ontoly Software Graph",
      repository: "fixture",
      graphHash: "fixturehash",
    },
  };
}
