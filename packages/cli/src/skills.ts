import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { MCP_CAPABILITIES, type McpCapabilityName } from "@0xsarwagya/ontoly-mcp";

export interface SkillCatalogEntry {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly enhancement: SkillEnhancement;
  readonly version: string;
  readonly minimumOntolyVersion: string;
  readonly capabilities: readonly McpCapabilityName[];
  readonly deprecated: boolean;
  readonly description: string;
  readonly path: string;
}

export interface SkillIssue {
  readonly severity: "error" | "warning";
  readonly skill: string;
  readonly file?: string | undefined;
  readonly message: string;
}

export interface SkillValidationReport {
  readonly status: "PASS" | "FAIL";
  readonly generatedAt: string;
  readonly skillsRoot: string;
  readonly totalSkills: number;
  readonly validSkills: number;
  readonly issues: readonly SkillIssue[];
  readonly skills: readonly SkillCatalogEntry[];
  readonly agentEvaluation: SkillAgentEvaluationReport;
}

export interface SkillDoctorReport {
  readonly status: "PASS" | "WARN" | "FAIL";
  readonly validation: SkillValidationReport;
  readonly recommendations: readonly string[];
}

export interface SkillAgentEvaluationReport {
  readonly status: "PASS" | "FAIL";
  readonly generatedAt: string;
  readonly totalSkills: number;
  readonly passedSkills: number;
  readonly aggregate: {
    readonly usesOntoly: number;
    readonly usesMcp: number;
    readonly avoidsUnnecessarySearch: number;
    readonly producesEvidence: number;
    readonly producesConfidence: number;
    readonly fallsBackGracefully: number;
  };
  readonly skills: readonly SkillAgentEvaluation[];
  readonly regression: {
    readonly status: "PASS" | "FAIL";
    readonly previous?: SkillAgentEvaluationBaseline | undefined;
    readonly current: SkillAgentEvaluationBaseline;
    readonly changes: readonly string[];
  };
}

interface SkillAgentEvaluation {
  readonly skill: string;
  readonly status: "PASS" | "FAIL";
  readonly score: number;
  readonly checks: {
    readonly usesOntoly: boolean;
    readonly usesMcp: boolean;
    readonly avoidsUnnecessarySearch: boolean;
    readonly producesEvidence: boolean;
    readonly producesConfidence: boolean;
    readonly fallsBackGracefully: boolean;
  };
}

interface SkillAgentEvaluationBaseline {
  readonly totalSkills: number;
  readonly passedSkills: number;
  readonly averageScore: number;
}

interface SkillFrontmatter {
  readonly name?: string | undefined;
  readonly description?: string | undefined;
  readonly license?: string | undefined;
  readonly compatibility?: string | undefined;
  readonly metadata: ReadonlyMap<string, string>;
}

export type SkillEnhancement = "LLM Enhancement";

export const DEFAULT_SKILL_ENHANCEMENT: SkillEnhancement = "LLM Enhancement";
const SKILL_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const REQUIRED_REPOSITORY_EXAMPLES = ["Ovok Core", "Ghost", "durable-local", "0xsarwagya", "Innosphere"] as const;
const REQUIRED_EXAMPLE_FIELDS = ["Questions", "Expected workflow", "Capabilities invoked", "Expected evidence", "Expected answer"] as const;
const REQUIRED_LOCAL_REFERENCES = [
  "reference/workflow.md",
  "reference/graph.md",
  "reference/mcp.md",
  "reference/best-practices.md",
  "reference/fallbacks.md",
] as const;

export async function listOntolySkills(root = process.cwd()): Promise<readonly SkillCatalogEntry[]> {
  const skillsRoot = resolveSkillsRoot(root);
  const skillDirs = await discoverSkillDirs(skillsRoot);
  const entries: SkillCatalogEntry[] = [];

  for (const dir of skillDirs) {
    const skillPath = join(dir, "SKILL.md");
    const content = await readFile(skillPath, "utf8");
    const frontmatter = parseSkillFrontmatter(content);
    const metadata = frontmatter.metadata;
    entries.push({
      id: frontmatter.name ?? basename(dir),
      title: titleFromSkillName(frontmatter.name ?? basename(dir)),
      category: metadata.get("ontoly.category") ?? "uncategorized",
      enhancement: parseEnhancement(metadata.get("ontoly.enhancement")),
      version: metadata.get("ontoly.skill.version") ?? "0.0.0",
      minimumOntolyVersion: metadata.get("ontoly.min.version") ?? "0.0.0",
      capabilities: parseCapabilities(metadata.get("ontoly.capabilities") ?? ""),
      deprecated: metadata.get("ontoly.deprecated") === "true",
      description: frontmatter.description ?? "",
      path: dir,
    });
  }

  return entries.sort((left, right) => left.id.localeCompare(right.id));
}

export async function validateOntolySkills(root = process.cwd()): Promise<SkillValidationReport> {
  const skillsRoot = resolveSkillsRoot(root);
  const issues: SkillIssue[] = [];

  if (!existsSync(skillsRoot)) {
    return {
      status: "FAIL",
      generatedAt: new Date().toISOString(),
      skillsRoot,
      totalSkills: 0,
      validSkills: 0,
      issues: [{ severity: "error", skill: "skills", message: "No skills directory found. Expected skills/ or .agents/skills/." }],
      skills: [],
      agentEvaluation: emptyAgentEvaluation(),
    };
  }

  await validateAuthoringSharedReferences(root, skillsRoot, issues);

  const skills = await listOntolySkills(root);
  for (const skill of skills) {
    await validateSkill(skill, issues);
  }

  const errorSkills = new Set(issues.filter((issue) => issue.severity === "error").map((issue) => issue.skill));
  const agentEvaluation = await evaluateSkillsForAgents(root, skills);
  const report: SkillValidationReport = {
    status: issues.some((issue) => issue.severity === "error") || agentEvaluation.status === "FAIL" ? "FAIL" : "PASS",
    generatedAt: new Date().toISOString(),
    skillsRoot,
    totalSkills: skills.length,
    validSkills: skills.filter((skill) => !errorSkills.has(skill.id)).length,
    issues,
    skills,
    agentEvaluation,
  };

  await writeSkillValidationArtifacts(root, report);
  return report;
}

export async function doctorOntolySkills(root = process.cwd()): Promise<SkillDoctorReport> {
  const validation = await validateOntolySkills(root);
  const recommendations: string[] = [];

  if (validation.totalSkills === 0) {
    recommendations.push("Create installable skills under skills/<skill-name>/SKILL.md.");
  }

  for (const issue of validation.issues) {
    recommendations.push(`${issue.skill}: ${issue.message}`);
  }

  if (validation.agentEvaluation.status === "FAIL") {
    recommendations.push("Ensure every skill mentions Ontoly, MCP, evidence, confidence, fallback behavior, and repository-search boundaries.");
  }

  if (recommendations.length === 0) {
    recommendations.push("Skills are ready. Run ontoly skills validate before release.");
  }

  return {
    status: validation.status === "FAIL" ? "FAIL" : validation.issues.some((issue) => issue.severity === "warning") ? "WARN" : "PASS",
    validation,
    recommendations,
  };
}

function resolveSkillsRoot(root: string): string {
  const sourceSkillsRoot = join(root, "skills");
  if (existsSync(sourceSkillsRoot)) {
    return sourceSkillsRoot;
  }

  const installedSkillsRoot = join(root, ".agents", "skills");
  if (existsSync(installedSkillsRoot)) {
    return installedSkillsRoot;
  }

  return sourceSkillsRoot;
}

async function discoverSkillDirs(skillsRoot: string): Promise<readonly string[]> {
  if (!existsSync(skillsRoot)) {
    return [];
  }

  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(skillsRoot, entry.name))
    .filter((dir) => basename(dir) !== "shared" && existsSync(join(dir, "SKILL.md")))
    .sort((left, right) => left.localeCompare(right));
}

async function validateAuthoringSharedReferences(
  root: string,
  skillsRoot: string,
  issues: SkillIssue[],
): Promise<void> {
  if (skillsRoot !== join(root, "skills")) {
    return;
  }

  for (const file of ["workflow.md", "graph.md", "mcp.md", "best-practices.md", "fallbacks.md"]) {
    const path = join(skillsRoot, "shared", file);
    if (!existsSync(path)) {
      issues.push({ severity: "error", skill: "shared", file: path, message: `Missing shared reference ${file}.` });
    }
  }
}

async function validateSkill(skill: SkillCatalogEntry, issues: SkillIssue[]): Promise<void> {
  const skillPath = join(skill.path, "SKILL.md");
  const skillContent = await readFile(skillPath, "utf8");
  const frontmatter = parseSkillFrontmatter(skillContent);
  const metadata = frontmatter.metadata;
  const requiredFiles = ["README.md", "examples.md"] as const;
  const requiredDirs = ["templates", "reference"] as const;
  const requiredReferenceFiles = ["workflow.md", "graph.md", "mcp.md", "best-practices.md", "fallbacks.md", "capabilities.md"] as const;

  if (!frontmatter.name) {
    issues.push({ severity: "error", skill: skill.id, file: skillPath, message: "SKILL.md frontmatter is missing name." });
  } else if (!SKILL_NAME_PATTERN.test(frontmatter.name)) {
    issues.push({ severity: "error", skill: skill.id, file: skillPath, message: "Skill name must use lowercase letters, numbers, and hyphens only." });
  } else if (frontmatter.name !== basename(skill.path)) {
    issues.push({ severity: "error", skill: skill.id, file: skillPath, message: "Skill name must match its parent directory." });
  }

  if (!frontmatter.description || frontmatter.description.length > 1024) {
    issues.push({ severity: "error", skill: skill.id, file: skillPath, message: "Skill description must be present and 1024 characters or fewer." });
  }

  for (const key of ["ontoly.skill.version", "ontoly.min.version", "ontoly.capabilities", "ontoly.enhancement", "ontoly.deprecated"]) {
    if (!metadata.has(key)) {
      issues.push({ severity: "error", skill: skill.id, file: skillPath, message: `Missing metadata key ${key}.` });
    }
  }

  if (metadata.get("ontoly.enhancement") && metadata.get("ontoly.enhancement") !== DEFAULT_SKILL_ENHANCEMENT) {
    issues.push({
      severity: "error",
      skill: skill.id,
      file: skillPath,
      message: `ontoly.enhancement must be ${DEFAULT_SKILL_ENHANCEMENT}.`,
    });
  }

  const declaredCapabilities = (metadata.get("ontoly.capabilities") ?? "")
    .split(",")
    .map((capability) => capability.trim())
    .filter(Boolean);
  const invalidCapabilities = declaredCapabilities.filter((capability) => !(MCP_CAPABILITIES as readonly string[]).includes(capability));
  if (declaredCapabilities.length === 0) {
    issues.push({ severity: "error", skill: skill.id, file: skillPath, message: "Skill must declare at least one Ontoly MCP capability." });
  }
  for (const capability of invalidCapabilities) {
    issues.push({ severity: "error", skill: skill.id, file: skillPath, message: `Unknown Ontoly MCP capability ${capability}.` });
  }

  for (const file of requiredFiles) {
    const path = join(skill.path, file);
    if (!existsSync(path)) {
      issues.push({ severity: "error", skill: skill.id, file: path, message: `Missing ${file}.` });
    }
  }

  for (const dir of requiredDirs) {
    const path = join(skill.path, dir);
    if (!existsSync(path)) {
      issues.push({ severity: "error", skill: skill.id, file: path, message: `Missing ${dir}/ directory.` });
    }
  }

  for (const file of requiredReferenceFiles) {
    const path = join(skill.path, "reference", file);
    if (!existsSync(path)) {
      issues.push({ severity: "error", skill: skill.id, file: path, message: `Missing reference/${file}.` });
    }
  }

  await validateSharedReferenceUsage(skill, skillContent, issues);
  validateNoDuplicatedWorkflow(skill, skillContent, issues);
  await validateLinks(skill, issues);
  await validateTemplates(skill, issues);
  await validateExamples(skill, issues);
}

async function validateSharedReferenceUsage(
  skill: SkillCatalogEntry,
  content: string,
  issues: SkillIssue[],
): Promise<void> {
  for (const reference of REQUIRED_LOCAL_REFERENCES) {
    if (!content.includes(reference)) {
      issues.push({
        severity: "error",
        skill: skill.id,
        file: join(skill.path, "SKILL.md"),
        message: `Skill should reference install-local guidance ${reference}.`,
      });
    }
  }
}

function validateNoDuplicatedWorkflow(
  skill: SkillCatalogEntry,
  content: string,
  issues: SkillIssue[],
): void {
  const duplicatedPhrases = [
    "Verify `.ontoly/SoftwareGraph.json`",
    "Run `ontoly build .` if the graph is missing",
    "Check graph trust with `ontoly coverage .`",
    "Use Ontoly MCP",
    "Inspect files only when Ontoly cannot answer",
  ].filter((phrase) => content.includes(phrase));

  if (duplicatedPhrases.length >= 3) {
    issues.push({
      severity: "error",
      skill: skill.id,
      file: join(skill.path, "SKILL.md"),
      message: "Do not duplicate the standard workflow in SKILL.md; reference reference/workflow.md instead.",
    });
  }
}

async function validateLinks(skill: SkillCatalogEntry, issues: SkillIssue[]): Promise<void> {
  const markdownFiles = [
    join(skill.path, "SKILL.md"),
    join(skill.path, "README.md"),
    join(skill.path, "examples.md"),
  ].filter((path) => existsSync(path));

  const referenceDir = join(skill.path, "reference");
  if (existsSync(referenceDir)) {
    for (const entry of await readdir(referenceDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        markdownFiles.push(join(referenceDir, entry.name));
      }
    }
  }

  const templateDir = join(skill.path, "templates");
  if (existsSync(templateDir)) {
    for (const entry of await readdir(templateDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        markdownFiles.push(join(templateDir, entry.name));
      }
    }
  }

  for (const file of markdownFiles) {
    const content = await readFile(file, "utf8");
    for (const link of localMarkdownLinks(content)) {
      const target = resolve(dirname(file), link.split("#")[0] ?? link);
      if (!existsSync(target)) {
        issues.push({ severity: "error", skill: skill.id, file, message: `Broken link: ${link}.` });
      }
    }
  }
}

async function validateTemplates(skill: SkillCatalogEntry, issues: SkillIssue[]): Promise<void> {
  const dir = join(skill.path, "templates");
  if (!existsSync(dir)) return;

  const files = (await readdir(dir)).filter((file) => file.endsWith(".md")).sort();
  if (files.length === 0) {
    issues.push({ severity: "error", skill: skill.id, file: dir, message: "templates/ must contain at least one Markdown template." });
    return;
  }

  for (const file of files) {
    const path = join(dir, file);
    const content = await readFile(path, "utf8");
    for (const token of ["{{repository}}", "{{question}}", "Capabilities invoked", "Evidence", "Confidence"]) {
      if (!content.includes(token)) {
        issues.push({ severity: "error", skill: skill.id, file: path, message: `Template is missing ${token}.` });
      }
    }
  }
}

async function validateExamples(skill: SkillCatalogEntry, issues: SkillIssue[]): Promise<void> {
  const path = join(skill.path, "examples.md");
  if (!existsSync(path)) return;

  const content = await readFile(path, "utf8");
  for (const repo of REQUIRED_REPOSITORY_EXAMPLES) {
    if (!content.includes(repo)) {
      issues.push({ severity: "error", skill: skill.id, file: path, message: `examples.md is missing ${repo}.` });
    }
  }

  for (const field of REQUIRED_EXAMPLE_FIELDS) {
    if (!content.includes(field)) {
      issues.push({ severity: "error", skill: skill.id, file: path, message: `examples.md is missing ${field}.` });
    }
  }
}

async function evaluateSkillsForAgents(
  root: string,
  skills: readonly SkillCatalogEntry[],
): Promise<SkillAgentEvaluationReport> {
  const evaluations: SkillAgentEvaluation[] = [];

  for (const skill of skills) {
    const content = [
      await readFile(join(skill.path, "SKILL.md"), "utf8"),
      existsSync(join(skill.path, "README.md")) ? await readFile(join(skill.path, "README.md"), "utf8") : "",
      existsSync(join(skill.path, "examples.md")) ? await readFile(join(skill.path, "examples.md"), "utf8") : "",
    ].join("\n").toLowerCase();

    const checks = {
      usesOntoly: content.includes("ontoly"),
      usesMcp: content.includes("mcp"),
      avoidsUnnecessarySearch: content.includes("only inspect") && content.includes("fallback"),
      producesEvidence: content.includes("evidence") && content.includes("node ids"),
      producesConfidence: content.includes("confidence"),
      fallsBackGracefully: content.includes("fallback"),
    };
    const passed = Object.values(checks).filter(Boolean).length;

    evaluations.push({
      skill: skill.id,
      status: passed === Object.keys(checks).length ? "PASS" : "FAIL",
      score: Math.round((passed / Object.keys(checks).length) * 100),
      checks,
    });
  }

  const aggregate = {
    usesOntoly: percent(evaluations, (evaluation) => evaluation.checks.usesOntoly),
    usesMcp: percent(evaluations, (evaluation) => evaluation.checks.usesMcp),
    avoidsUnnecessarySearch: percent(evaluations, (evaluation) => evaluation.checks.avoidsUnnecessarySearch),
    producesEvidence: percent(evaluations, (evaluation) => evaluation.checks.producesEvidence),
    producesConfidence: percent(evaluations, (evaluation) => evaluation.checks.producesConfidence),
    fallsBackGracefully: percent(evaluations, (evaluation) => evaluation.checks.fallsBackGracefully),
  };
  const current = {
    totalSkills: evaluations.length,
    passedSkills: evaluations.filter((evaluation) => evaluation.status === "PASS").length,
    averageScore: evaluations.length
      ? Math.round(evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / evaluations.length)
      : 0,
  };
  const previous = await readJsonIfExists<SkillAgentEvaluationBaseline>(join(root, "validation", "skills", "regression-baseline.json"));
  const changes = previous ? skillRegressionChanges(previous, current) : [];

  return {
    status: evaluations.every((evaluation) => evaluation.status === "PASS") ? "PASS" : "FAIL",
    generatedAt: new Date().toISOString(),
    totalSkills: evaluations.length,
    passedSkills: current.passedSkills,
    aggregate,
    skills: evaluations,
    regression: {
      status: changes.some((change) => change.includes("regressed")) ? "FAIL" : "PASS",
      previous,
      current,
      changes,
    },
  };
}

async function writeSkillValidationArtifacts(root: string, report: SkillValidationReport): Promise<void> {
  const validationRoot = join(root, "validation", "skills");
  await mkdir(validationRoot, { recursive: true });
  await writeJson(join(validationRoot, "report.json"), report);
  await writeFile(join(validationRoot, "report.md"), renderSkillValidationMarkdown(report), "utf8");
  await writeJson(join(validationRoot, "agent-evaluation.json"), report.agentEvaluation);
  await writeFile(join(validationRoot, "agent-evaluation.md"), renderAgentEvaluationMarkdown(report.agentEvaluation), "utf8");

  const baseline = join(validationRoot, "regression-baseline.json");
  if (!existsSync(baseline)) {
    await writeJson(baseline, report.agentEvaluation.regression.current);
  }
}

function renderSkillValidationMarkdown(report: SkillValidationReport): string {
  return [
    "# Ontoly Skills Validation",
    "",
    `Status: ${report.status}`,
    `Skills: ${report.validSkills}/${report.totalSkills}`,
    "",
    "## Skills",
    "",
    "| Skill | Version | Minimum Ontoly | Enhancement | Capabilities | Deprecated |",
    "| --- | --- | --- | --- | --- | --- |",
    ...report.skills.map((skill) =>
      `| ${skill.id} | ${skill.version} | ${skill.minimumOntolyVersion} | ${skill.enhancement} | ${skill.capabilities.map((capability) => `\`${capability}\``).join(", ")} | ${skill.deprecated ? "yes" : "no"} |`),
    "",
    "## Issues",
    "",
    ...(report.issues.length
      ? report.issues.map((issue) => `- ${issue.severity.toUpperCase()} ${issue.skill}: ${issue.message}`)
      : ["- None."]),
    "",
    "## Agent Evaluation",
    "",
    `Status: ${report.agentEvaluation.status}`,
    `Passed: ${report.agentEvaluation.passedSkills}/${report.agentEvaluation.totalSkills}`,
    `Regression: ${report.agentEvaluation.regression.status}`,
    "",
  ].join("\n");
}

function renderAgentEvaluationMarkdown(report: SkillAgentEvaluationReport): string {
  return [
    "# Agent Skill Evaluation",
    "",
    `Status: ${report.status}`,
    `Regression: ${report.regression.status}`,
    "",
    "| Skill | Score | Status |",
    "| --- | ---: | --- |",
    ...report.skills.map((skill) => `| ${skill.skill} | ${skill.score} | ${skill.status} |`),
    "",
    "## Aggregate",
    "",
    `- Uses Ontoly: ${report.aggregate.usesOntoly}`,
    `- Uses MCP: ${report.aggregate.usesMcp}`,
    `- Avoids unnecessary repository search: ${report.aggregate.avoidsUnnecessarySearch}`,
    `- Produces evidence: ${report.aggregate.producesEvidence}`,
    `- Produces confidence: ${report.aggregate.producesConfidence}`,
    `- Falls back gracefully: ${report.aggregate.fallsBackGracefully}`,
    "",
  ].join("\n");
}

function parseSkillFrontmatter(content: string): SkillFrontmatter {
  const match = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!match) {
    return { metadata: new Map() };
  }

  const metadata = new Map<string, string>();
  const result: Record<string, string> = {};
  let inMetadata = false;

  for (const line of (match[1] ?? "").split("\n")) {
    if (!line.trim()) continue;
    const metadataMatch = /^  ([^:]+):\s*(.*)$/.exec(line);

    if (inMetadata && metadataMatch) {
      metadata.set((metadataMatch[1] ?? "").trim(), unquote((metadataMatch[2] ?? "").trim()));
      continue;
    }

    inMetadata = false;
    const fieldMatch = /^([^:]+):\s*(.*)$/.exec(line);
    if (!fieldMatch) continue;

    const key = (fieldMatch[1] ?? "").trim();
    const value = unquote((fieldMatch[2] ?? "").trim());
    if (key === "metadata") {
      inMetadata = true;
    } else {
      result[key] = value;
    }
  }

  return {
    name: result.name,
    description: result.description,
    license: result.license,
    compatibility: result.compatibility,
    metadata,
  };
}

function parseCapabilities(value: string): readonly McpCapabilityName[] {
  return value
    .split(",")
    .map((capability) => capability.trim())
    .filter(Boolean)
    .filter((capability): capability is McpCapabilityName =>
      (MCP_CAPABILITIES as readonly string[]).includes(capability),
    );
}

function parseEnhancement(value: string | undefined): SkillEnhancement {
  return value === DEFAULT_SKILL_ENHANCEMENT ? value : DEFAULT_SKILL_ENHANCEMENT;
}

function localMarkdownLinks(content: string): readonly string[] {
  const links: string[] = [];
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  let match = regex.exec(content);

  while (match) {
    const link = (match[1] ?? "").trim();
    if (!link.startsWith("http://") && !link.startsWith("https://") && !link.startsWith("#") && !link.startsWith("mailto:")) {
      links.push(link);
    }
    match = regex.exec(content);
  }

  return links;
}

function percent<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  return items.length ? Math.round((items.filter(predicate).length / items.length) * 100) : 0;
}

function skillRegressionChanges(
  previous: SkillAgentEvaluationBaseline,
  current: SkillAgentEvaluationBaseline,
): readonly string[] {
  const changes: string[] = [];
  if (current.averageScore < previous.averageScore) {
    changes.push(`Average skill score regressed from ${previous.averageScore} to ${current.averageScore}.`);
  }
  if (current.passedSkills < previous.passedSkills) {
    changes.push(`Passing skills regressed from ${previous.passedSkills} to ${current.passedSkills}.`);
  }
  if (current.totalSkills < previous.totalSkills) {
    changes.push(`Skill count regressed from ${previous.totalSkills} to ${current.totalSkills}.`);
  }
  return changes;
}

async function readJsonIfExists<T>(path: string): Promise<T | undefined> {
  if (!existsSync(path)) return undefined;
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function emptyAgentEvaluation(): SkillAgentEvaluationReport {
  return {
    status: "FAIL",
    generatedAt: new Date().toISOString(),
    totalSkills: 0,
    passedSkills: 0,
    aggregate: {
      usesOntoly: 0,
      usesMcp: 0,
      avoidsUnnecessarySearch: 0,
      producesEvidence: 0,
      producesConfidence: 0,
      fallsBackGracefully: 0,
    },
    skills: [],
    regression: {
      status: "PASS",
      current: { totalSkills: 0, passedSkills: 0, averageScore: 0 },
      changes: [],
    },
  };
}

function unquote(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function titleFromSkillName(name: string): string {
  return name.split("-").map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(" ");
}
