import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  doctorOntolySkills,
  listOntolySkills,
  validateInstalledOntolySkills,
  validateOntolySkills,
} from "../src/skills";

const __rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const CURRENT_VERSION = JSON.parse(
  readFileSync(join(__rootDir, "package.json"), "utf8"),
).version as string;

describe("Ontoly Agent Skills", () => {
  it("lists installable skills with versions and capability requirements", async () => {
    const skills = await listOntolySkills(process.cwd());
    const architectureReview = skills.find((skill) => skill.id === "architecture-review");

    expect(skills.length).toBeGreaterThanOrEqual(14);
    expect(architectureReview?.version).toBe(CURRENT_VERSION);
    expect(architectureReview?.minimumOntolyVersion).toBe(CURRENT_VERSION);
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

describe("installed Ontoly Agent Skills", () => {
  let sandbox: string;
  let home: string;

  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), "ontoly-skills-"));
    home = join(sandbox, "home");
    vi.stubEnv("HOME", home);
    vi.stubEnv("USERPROFILE", home);
    vi.stubEnv("CLAUDE_CONFIG_DIR", "");
    vi.stubEnv("CODEX_HOME", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("validates Ontoly skills in the user-level agent directories and ignores other skills", async () => {
    const claudeSkills = join(home, ".claude", "skills");
    const agentsSkills = join(home, ".agents", "skills");
    installSkill(claudeSkills, "architecture-review");
    installSkill(agentsSkills, "impact-analysis");
    symlinkSync(join(agentsSkills, "impact-analysis"), join(claudeSkills, "impact-analysis"), "junction");
    mkdirSync(join(claudeSkills, "unrelated"));
    writeFileSync(join(claudeSkills, "unrelated", "SKILL.md"), "---\nname: unrelated\ndescription: Not an Ontoly skill.\n---\n");

    const reports = await validateInstalledOntolySkills({ cliVersion: CURRENT_VERSION });

    expect(reports.map((report) => report.skillsRoot)).toEqual([claudeSkills, agentsSkills]);
    expect(reports.map((report) => report.skills.map((skill) => skill.id))).toEqual([
      ["architecture-review", "impact-analysis"],
      ["impact-analysis"],
    ]);
    expect(reports.map((report) => report.status)).toEqual(["PASS", "PASS"]);
    expect(reports.flatMap((report) => report.issues)).toEqual([]);
  });

  it("reports installed skills that need a newer CLI", async () => {
    installSkill(join(home, ".claude", "skills"), "architecture-review", "99.0.0");
    installSkill(join(home, ".claude", "skills"), "impact-analysis", "1.0.0-rc.5");

    for (const cliVersion of [CURRENT_VERSION, "99.0.0-rc.1"]) {
      const [report] = await validateInstalledOntolySkills({ cliVersion });

      expect(report?.status).toBe("FAIL");
      expect(report?.validSkills).toBe(1);
      expect(report?.issues).toEqual([
        expect.objectContaining({
          skill: "architecture-review",
          message: `Requires Ontoly 99.0.0 or newer; this CLI is ${cliVersion}. Upgrade the Ontoly CLI.`,
        }),
      ]);
    }
  });

  it("writes reports only to an explicit output directory", async () => {
    const project = join(sandbox, "project");
    installSkill(join(project, ".agents", "skills"), "architecture-review");
    const cwd = process.cwd();
    process.chdir(project);
    try {
      expect((await validateOntolySkills()).status).toBe("PASS");
      expect(await validateInstalledOntolySkills()).toEqual([]);
    } finally {
      process.chdir(cwd);
    }
    expect(readdirSync(project)).toEqual([".agents"]);

    const output = join(sandbox, "reports");
    await validateOntolySkills(project, { output });
    expect(readdirSync(output).sort()).toEqual([
      "agent-evaluation.json",
      "agent-evaluation.md",
      "regression-baseline.json",
      "report.json",
      "report.md",
    ]);
  });
});

function installSkill(skillsRoot: string, name: string, minimumOntolyVersion?: string): void {
  const target = join(skillsRoot, name);
  mkdirSync(skillsRoot, { recursive: true });
  cpSync(join(__rootDir, "skills", name), target, { recursive: true });
  if (minimumOntolyVersion) {
    const skillPath = join(target, "SKILL.md");
    const content = readFileSync(skillPath, "utf8");
    writeFileSync(skillPath, content.replace(/ontoly\.min\.version: "[^"]*"/, `ontoly.min.version: "${minimumOntolyVersion}"`));
  }
}

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
