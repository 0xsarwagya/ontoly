#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEMANTIC_ROOT = resolve(__dirname, "..");
const VALIDATION_ROOT = resolve(SEMANTIC_ROOT, "..");
const PROJECT_ROOT = resolve(VALIDATION_ROOT, "..");

const STATUS_RANK = { PASS: 3, PARTIAL: 2, FAIL: 1 };
const CATEGORIES = [
  "Functions",
  "Methods",
  "Classes",
  "Interfaces",
  "Routes",
  "Controllers",
  "Services",
  "Providers",
  "Modules",
  "Packages",
  "Dependency Injection",
  "Configuration",
  "Environment Variables",
  "Call Graph",
  "Request Lifecycle",
  "Repository Structure",
  "Workspace",
  "Authentication",
  "Authorization",
  "Database",
  "API",
  "Architecture",
];

const args = parseArgs(process.argv.slice(2));

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
  await ensureSemanticLayout();

  if (args.leaderboardOnly) {
    await printExistingLeaderboard(args.json);
    return;
  }

  const fixtures = await loadFixtures();
  const selectedFixtures = args.repository
    ? fixtures.filter((fixture) => fixture.repository === args.repository)
    : fixtures;

  if (selectedFixtures.length === 0) {
    throw new Error(`No semantic fixture found for ${args.repository}.`);
  }

  const missingArtifacts = await hasMissingValidationArtifacts(selectedFixtures);
  if (
    missingArtifacts &&
    args.ci &&
    !args.refresh &&
    (shouldUseCommittedArtifacts() || !allFixtureRepositoriesAvailable(selectedFixtures))
  ) {
    await printCommittedSemanticGate("External validation repositories are unavailable in this CI environment.");
    return;
  }

  if (args.refresh || missingArtifacts) {
    runBaseValidation();
  }

  if (await hasMissingValidationArtifacts(selectedFixtures)) {
    if (args.ci) {
      await printCommittedSemanticGate("Base validation did not produce all graph artifacts.");
      return;
    }

    const missing = selectedFixtures
      .filter((fixture) => {
        const paths = artifactPaths(fixture.repository);
        return !existsSync(paths.ontolyGraph) || !existsSync(paths.graphifyGraph);
      })
      .map((fixture) => fixture.repository)
      .join(", ");
    throw new Error(`Missing semantic graph artifacts for: ${missing}. Run validation with the repository corpus mounted first.`);
  }

  const previousBaseline = await readJsonIfExists(join(SEMANTIC_ROOT, "regression-baseline.json"));
  const startedAt = new Date().toISOString();
  const repositoryResults = [];

  for (const fixture of selectedFixtures) {
    const questions = await loadQuestions(fixture);
    const result = await evaluateRepository(fixture, questions);
    repositoryResults.push(result);
    await writeRepositoryReport(result);
  }

  const aggregate = createAggregateResult(repositoryResults, previousBaseline, startedAt);
  const shouldPersistAggregate = !args.repository;
  if (shouldPersistAggregate) {
    await writeAggregateArtifacts(aggregate);
  }

  if (!previousBaseline && shouldPersistAggregate) {
    await writeJson(join(SEMANTIC_ROOT, "regression-baseline.json"), aggregate.regression.current);
  }

  if (args.json) {
    writeOut(JSON.stringify(aggregate, null, 2));
  } else if (args.benchmark) {
    writeOut(renderBenchmarkMarkdown(aggregate));
  } else {
    writeOut(renderConsoleSummary(aggregate, shouldPersistAggregate));
  }

  if (args.ci && aggregate.regression.status === "FAIL") {
    process.exitCode = 1;
  }
}

async function ensureSemanticLayout() {
  await Promise.all([
    mkdir(join(SEMANTIC_ROOT, "fixtures"), { recursive: true }),
    mkdir(join(SEMANTIC_ROOT, "questions"), { recursive: true }),
    mkdir(join(SEMANTIC_ROOT, "evaluators"), { recursive: true }),
    mkdir(join(SEMANTIC_ROOT, "leaderboard"), { recursive: true }),
    mkdir(join(SEMANTIC_ROOT, "reports"), { recursive: true }),
  ]);
}

function allFixtureRepositoriesAvailable(fixtures) {
  return fixtures.every((fixture) => fixture.path && existsSync(fixture.path));
}

function shouldUseCommittedArtifacts() {
  return process.env.ONTOLY_SEMANTIC_USE_COMMITTED_ARTIFACTS === "1";
}

async function printCommittedSemanticGate(reason) {
  const regression = await readJsonIfExists(join(SEMANTIC_ROOT, "regression.json"));
  const current = await readJsonIfExists(join(SEMANTIC_ROOT, "regression-current.json"));

  if (!regression || !current) {
    throw new Error(`${reason} No committed semantic regression artifacts are available.`);
  }

  const ontolyScore = current.aggregate?.ontoly?.semanticUnderstandingScore ?? "unknown";
  const graphifyScore = current.aggregate?.graphify?.semanticUnderstandingScore ?? "unknown";
  const repositoryCount = current.repositories?.length ?? 0;
  const questionCount = (current.repositories ?? []).reduce((count, repo) => count + (repo.questions?.length ?? 0), 0);

  if (args.json) {
    writeOut(JSON.stringify({
      mode: "committed-artifacts",
      reason,
      status: regression.status,
      repositories: repositoryCount,
      questions: questionCount,
      ontolySemanticUnderstandingScore: ontolyScore,
      graphifySemanticUnderstandingScore: graphifyScore,
      failures: regression.failures ?? [],
      warnings: [
        reason,
        "Fresh semantic evaluation requires the external validation corpus.",
        ...(regression.warnings ?? []),
      ],
    }, null, 2));
  } else {
    writeOut([
      "Semantic evaluation reused committed artifacts.",
      `Reason: ${reason}`,
      `Repositories: ${repositoryCount}`,
      `Questions: ${questionCount}`,
      `Ontoly Semantic Understanding Score: ${ontolyScore}`,
      `Graphify Semantic Understanding Score: ${graphifyScore}`,
      `Regression: ${regression.status}`,
      "Fresh semantic evaluation requires the external validation corpus.",
    ].join("\n"));
  }

  if (args.ci && regression.status === "FAIL") {
    process.exitCode = 1;
  }
}

async function printExistingLeaderboard(json) {
  const path = json
    ? join(SEMANTIC_ROOT, "leaderboard.json")
    : join(SEMANTIC_ROOT, "leaderboard.md");

  if (!existsSync(path)) {
    runBaseValidation();
    const fixtures = await loadFixtures();
    const repositoryResults = [];
    for (const fixture of fixtures) {
      repositoryResults.push(await evaluateRepository(fixture, await loadQuestions(fixture)));
    }
    await writeAggregateArtifacts(createAggregateResult(repositoryResults, null, new Date().toISOString()));
  }

  writeOut((await readFile(path, "utf8")).trimEnd());
}

async function loadFixtures() {
  const files = (await readdir(join(SEMANTIC_ROOT, "fixtures")))
    .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    .sort();

  return Promise.all(files.map(async (file) => {
    const fixture = parseYamlSubset(await readFile(join(SEMANTIC_ROOT, "fixtures", file), "utf8"));
    return normalizeFixture(fixture, file);
  }));
}

async function loadQuestions(fixture) {
  const questionPath = resolve(SEMANTIC_ROOT, fixture.questions);
  const parsed = parseYamlSubset(await readFile(questionPath, "utf8"));
  const questions = Array.isArray(parsed) ? parsed : parsed.questions;

  if (!Array.isArray(questions)) {
    throw new Error(`Question file ${questionPath} must contain a YAML list or a questions list.`);
  }

  return questions.map((question) => normalizeQuestion(question, fixture.repository));
}

function normalizeFixture(fixture, file) {
  if (!fixture.repository) {
    throw new Error(`Fixture ${file} is missing repository.`);
  }

  return {
    repository: String(fixture.repository),
    name: String(fixture.name ?? fixture.repository),
    path: fixture.path ? String(fixture.path) : null,
    frameworks: arrayOfStrings(fixture.frameworks),
    questions: String(fixture.questions ?? `../questions/${fixture.repository}.yaml`),
    expectedGraph: fixture.expectedGraph ?? {},
    coverageExpectations: fixture.coverageExpectations ?? {},
  };
}

function normalizeQuestion(question, repository) {
  const expected = question.expected ?? {};
  return {
    id: String(question.id),
    repository: String(question.repository ?? repository),
    category: String(question.category ?? "Architecture"),
    evaluator: String(question.evaluator ?? inferEvaluator(question.category)),
    question: String(question.question ?? question.id),
    selector: question.selector ?? {},
    expected: {
      exact: arrayOfStrings(expected.exact),
      acceptable: arrayOfStrings(expected.acceptable),
      nodes: Array.isArray(expected.nodes) ? expected.nodes : [],
      edges: Array.isArray(expected.edges) ? expected.edges : [],
      relationships: Array.isArray(expected.relationships) ? expected.relationships : [],
    },
  };
}

async function hasMissingValidationArtifacts(fixtures) {
  for (const fixture of fixtures) {
    const paths = artifactPaths(fixture.repository);
    if (!existsSync(paths.ontolyGraph) || !existsSync(paths.graphifyGraph)) {
      return true;
    }
  }

  return false;
}

function runBaseValidation() {
  const script = join(VALIDATION_ROOT, "tools", "run-validation.mjs");
  const result = spawnSync(process.execPath, [script], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Base validation failed with exit code ${result.status}.`);
  }
}

async function evaluateRepository(fixture, questions) {
  const paths = artifactPaths(fixture.repository);
  const ontolyGraph = normalizeOntolyGraph(JSON.parse(await readFile(paths.ontolyGraph, "utf8")));
  const graphifyGraph = normalizeGraphifyGraph(JSON.parse(await readFile(paths.graphifyGraph, "utf8")));
  const questionResults = [];

  for (const question of questions) {
    questionResults.push(evaluateQuestion(question, {
      ontoly: ontolyGraph,
      graphify: graphifyGraph,
    }));
  }

  const repositoryScore = repositoryScoreFromQuestions(questionResults);

  return {
    repository: fixture.repository,
    name: fixture.name,
    frameworks: fixture.frameworks,
    expectedGraph: fixture.expectedGraph,
    coverageExpectations: fixture.coverageExpectations,
    questionCount: questionResults.length,
    score: repositoryScore,
    questions: questionResults,
  };
}

function evaluateQuestion(question, systems) {
  const ontoly = evaluateSystemQuestion("ontoly", systems.ontoly, question);
  const graphify = evaluateSystemQuestion("graphify", systems.graphify, question);
  const winner = chooseWinner(ontoly, graphify);

  return {
    id: question.id,
    repository: question.repository,
    category: question.category,
    evaluator: question.evaluator,
    question: question.question,
    expected: question.expected,
    ontoly,
    graphify,
    winner,
  };
}

function evaluateSystemQuestion(system, graph, question) {
  const started = performance.now();
  const evaluation = runEvaluator(graph, question);
  const latencyMs = performance.now() - started;
  const score = scoreEvaluation(question, evaluation.answers);

  return {
    system,
    status: score.status,
    exactMatch: score.exactMatch,
    precision: score.precision,
    recall: score.recall,
    falsePositives: score.falsePositives,
    falseNegatives: score.falseNegatives,
    confidence: score.confidence,
    latencyMs: round(latencyMs, 3),
    answers: evaluation.answers,
    explanation: evaluation.explanation,
  };
}

function runEvaluator(graph, question) {
  switch (question.evaluator) {
    case "FindController":
      return findNodes(graph, question, ["Controller"]);
    case "FindRoute":
      return findNodes(graph, question, ["Route"]);
    case "FindProvider":
      return findNodes(graph, question, ["Provider", "Service", "Repository", "Factory", "Class"]);
    case "FindModule":
      return findNodes(graph, question, ["Module", "Class"]);
    case "FindDependency":
    case "TraceDependency":
      return findEdges(graph, question, ["DEPENDS_ON", "INJECTS", "USES", "IMPORTS"]);
    case "FindCallChain":
    case "TraceExecution":
      return findEdges(graph, question, ["CALLS", "HANDLES"]);
    case "FindConsumers":
    case "ImpactAnalysis":
      return findConsumers(graph, question);
    case "FindConfiguration":
      return findNodes(graph, question, ["Configuration"]);
    case "FindEnvironmentVariable":
      return findNodes(graph, question, ["EnvironmentVariable"]);
    case "FindRepository":
      return findNodes(graph, question, ["Package", "Repository", "Workspace"]);
    case "FindDatabaseAccess":
      return findNodes(graph, question, ["EnvironmentVariable", "Package", "Configuration"]);
    case "FindEntrypoint":
      return findNodes(graph, question, ["Function", "Module"]);
    case "ArchitectureSummary":
      return architectureSummary(graph, question);
    default:
      return findNodes(graph, question, arrayOfStrings(question.selector.nodeTypes));
  }
}

function findNodes(graph, question, defaultTypes) {
  const selector = question.selector ?? {};
  const nodeTypes = arrayOfStrings(selector.nodeTypes).length > 0
    ? arrayOfStrings(selector.nodeTypes)
    : defaultTypes;
  const terms = arrayOfStrings(selector.terms);
  const exactTerms = Boolean(selector.exactTerms);
  const limit = Number(selector.limit ?? 25);
  const candidates = graph.nodes
    .filter((node) => nodeTypes.length === 0 || nodeTypes.includes(node.type))
    .filter((node) => matchesTerms(node, terms, exactTerms))
    .sort(compareCandidateNodes)
    .slice(0, limit)
    .map((node) => answerFromNode(node, `Matched ${node.type} node ${node.label}.`));

  return {
    answers: dedupeAnswers(candidates),
    explanation: `${candidates.length} candidate node(s) matched ${nodeTypes.join(", ")} with terms ${terms.join(", ") || "none"}.`,
  };
}

function findEdges(graph, question, defaultEdgeTypes) {
  const selector = question.selector ?? {};
  const edgeTypes = arrayOfStrings(selector.edgeTypes).length > 0
    ? arrayOfStrings(selector.edgeTypes)
    : defaultEdgeTypes;
  const from = selector.from ? String(selector.from) : null;
  const to = selector.to ? String(selector.to) : null;
  const terms = arrayOfStrings(selector.terms);
  const exactTerms = Boolean(selector.exactTerms);
  const limit = Number(selector.limit ?? 25);
  const candidates = graph.edges
    .filter((edge) => edgeTypes.includes(edge.type))
    .filter((edge) => !from || matchesEndpoint(edge.sourceLabel, from, exactTerms))
    .filter((edge) => !to || matchesEndpoint(edge.targetLabel, to, exactTerms))
    .filter((edge) => terms.length === 0 || terms.some((term) =>
      containsNormalized(edge.sourceLabel, term) ||
      containsNormalized(edge.targetLabel, term) ||
      containsNormalized(edge.label, term)))
    .sort(compareCandidateEdges)
    .slice(0, limit)
    .map(answerFromEdge);

  return {
    answers: dedupeAnswers(candidates),
    explanation: `${candidates.length} candidate edge-derived answer(s) matched ${edgeTypes.join(", ")}.`,
  };
}

function matchesEndpoint(label, expected, exactTerms) {
  return exactTerms
    ? equivalent(label, expected)
    : equivalent(label, expected) || containsNormalized(label, expected);
}

function findConsumers(graph, question) {
  const selector = question.selector ?? {};
  const target = selector.to ?? selector.target ?? selector.terms?.[0];
  const edgeTypes = arrayOfStrings(selector.edgeTypes).length > 0
    ? arrayOfStrings(selector.edgeTypes)
    : ["INJECTS", "USES", "CALLS", "IMPORTS", "DEPENDS_ON"];
  const matches = graph.edges
    .filter((edge) => edgeTypes.includes(edge.type))
    .filter((edge) => target && (equivalent(edge.targetLabel, target) || containsNormalized(edge.targetLabel, target)))
    .map((edge) => {
      const source = graph.nodeById.get(edge.source);
      return {
        label: source?.label ?? edge.sourceLabel,
        type: source?.type ?? "Unknown",
        id: edge.source,
        file: source?.file ?? null,
        explanation: `Consumes ${edge.targetLabel} through ${edge.type}.`,
      };
    });

  return {
    answers: dedupeAnswers(matches),
    explanation: `${matches.length} consumer(s) matched target ${target ?? "none"}.`,
  };
}

function architectureSummary(graph, question) {
  const selector = question.selector ?? {};
  const nodeTypes = arrayOfStrings(selector.nodeTypes).length > 0
    ? arrayOfStrings(selector.nodeTypes)
    : ["Framework", "Workspace", "Package", "Module", "Service", "Controller"];
  const terms = arrayOfStrings(selector.terms);
  const answers = graph.nodes
    .filter((node) => nodeTypes.includes(node.type))
    .filter((node) => matchesTerms(node, terms, Boolean(selector.exactTerms)))
    .sort(compareCandidateNodes)
    .slice(0, Number(selector.limit ?? 50))
    .map((node) => answerFromNode(node, `Included in architecture summary as ${node.type}.`));

  return {
    answers: dedupeAnswers(answers),
    explanation: `Architecture summary searched ${nodeTypes.join(", ")}.`,
  };
}

function scoreEvaluation(question, answers) {
  const expected = expectedAnswers(question);
  const acceptable = question.expected.acceptable.map(normalizeAnswer);
  const predicted = dedupeStrings(answers.map((answer) => answer.label));
  const predictedNormalized = predicted.map(normalizeAnswer);
  const matchedExpected = [];
  const falseNegatives = [];

  for (const item of expected) {
    const acceptableForItem = acceptableForExpected(item, acceptable, expected.length);
    if (predictedNormalized.some((prediction) => prediction === item.normalized || acceptableForItem.has(prediction))) {
      matchedExpected.push(item.label);
    } else {
      falseNegatives.push(item.label);
    }
  }

  const falsePositives = predicted.filter((prediction, index) => {
    const normalized = predictedNormalized[index];
    return !expected.some((item) => item.normalized === normalized || acceptableForExpected(item, acceptable, expected.length).has(normalized));
  });

  const truePositiveCount = matchedExpected.length;
  const precision = predicted.length === 0 ? (expected.length === 0 ? 1 : 0) : truePositiveCount / predicted.length;
  const recall = expected.length === 0 ? 1 : truePositiveCount / expected.length;
  const exactMatch = falseNegatives.length === 0 && falsePositives.length === 0;
  const confidence = round(((precision + recall) / 2) * 100, 2);
  const status = exactMatch || (recall === 1 && precision >= 0.5)
    ? "PASS"
    : recall > 0
      ? "PARTIAL"
      : "FAIL";

  return {
    exactMatch,
    precision: round(precision, 4),
    recall: round(recall, 4),
    falsePositives,
    falseNegatives,
    confidence,
    status,
  };
}

function acceptableForExpected(item, acceptable, expectedCount) {
  if (expectedCount === 1) {
    return new Set(acceptable);
  }

  const aliases = acceptable.filter((alias) =>
    alias === item.normalized ||
    alias.includes(item.normalized) ||
    item.normalized.includes(alias) ||
    normalizedTail(alias) === normalizedTail(item.normalized),
  );
  return new Set(aliases);
}

function normalizedTail(value) {
  return String(value).split(/[/:@._-]+/).filter(Boolean).at(-1) ?? String(value);
}

function expectedAnswers(question) {
  const labels = [
    ...question.expected.exact,
    ...question.expected.nodes.map((node) => node.name).filter(Boolean),
    ...question.expected.edges.map(edgeLabel),
    ...question.expected.relationships.map(edgeLabel),
  ];

  return dedupeStrings(labels).map((label) => ({
    label,
    normalized: normalizeAnswer(label),
  }));
}

function edgeLabel(edge) {
  return `${edge.from} -> ${edge.to}`;
}

function normalizeOntolyGraph(graph) {
  const nodes = graph.nodes.map((node) => ({
    id: node.id,
    label: node.name,
    type: node.type,
    file: node.file ?? null,
    metadata: node.metadata ?? {},
  }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = graph.edges.map((edge) => {
    const source = nodeById.get(edge.from);
    const target = nodeById.get(edge.to);
    return {
      id: edge.id,
      type: canonicalRelationship(edge.type),
      label: `${source?.label ?? edge.from} -> ${target?.label ?? edge.to}`,
      source: edge.from,
      target: edge.to,
      sourceLabel: source?.label ?? edge.from,
      targetLabel: target?.label ?? edge.to,
    };
  });

  return { system: "ontoly", nodes, edges, nodeById };
}

function normalizeGraphifyGraph(graph) {
  const nodes = (graph.nodes ?? []).map((node) => ({
    id: node.id,
    label: cleanGraphifyLabel(node.label ?? node.id),
    type: inferGraphifyType(node),
    file: node.source_file ?? null,
    metadata: node,
  }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const rawEdges = graph.links ?? graph.edges ?? [];
  const edges = rawEdges.map((edge, index) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    return {
      id: edge.id ?? `graphify-edge:${index}`,
      type: canonicalRelationship(edge.relation ?? edge.type),
      label: `${source?.label ?? edge.source} -> ${target?.label ?? edge.target}`,
      source: edge.source,
      target: edge.target,
      sourceLabel: source?.label ?? edge.source,
      targetLabel: target?.label ?? edge.target,
    };
  }).filter((edge) => edge.type);

  return { system: "graphify", nodes, edges, nodeById };
}

function inferGraphifyType(node) {
  const label = cleanGraphifyLabel(node.label ?? node.id);
  const lower = label.toLowerCase();
  const extension = extname(label).toLowerCase();

  if (label.endsWith("Controller")) return "Controller";
  if (label.endsWith("Service")) return "Service";
  if (label.endsWith("Module")) return "Module";
  if (label.endsWith("Provider")) return "Provider";
  if (label.endsWith("Repository")) return "Repository";
  if (label.endsWith("()")) return "Function";
  if (label.startsWith("@") || ["react", "next", "vite", "vitest", "turbo", "typescript"].includes(lower)) return "Package";
  if (/^[A-Z0-9_]{2,}$/.test(label) && label.includes("_")) return "EnvironmentVariable";
  if (lower.includes("config") || [".json", ".toml"].includes(extension)) return "Configuration";
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extension)) return "Module";
  if (/^[A-Z][A-Za-z0-9_]+$/.test(label)) return "Class";
  return "Unknown";
}

function canonicalRelationship(value) {
  const normalized = String(value ?? "").trim().replace(/[-\s]/g, "_").toUpperCase();
  const aliases = {
    CALL: "CALLS",
    CALLS: "CALLS",
    CONTAINS: "CONTAINS",
    CONTAIN: "CONTAINS",
    IMPORT: "IMPORTS",
    IMPORTS: "IMPORTS",
    IMPORTS_FROM: "IMPORTS",
    EXPORT: "EXPORTS",
    EXPORTS: "EXPORTS",
    RE_EXPORTS: "EXPORTS",
    REEXPORTS: "EXPORTS",
    EXTENDS: "EXTENDS",
    INHERITS: "EXTENDS",
    IMPLEMENTS: "IMPLEMENTS",
    REFERENCES: "REFERENCES",
    REFERS_TO: "REFERENCES",
    HANDLES: "HANDLES",
    MOUNTS: "MOUNTS",
    INJECTS: "INJECTS",
    USES: "USES",
    DEPENDS_ON: "DEPENDS_ON",
    READS: "READS",
    WRITES: "WRITES",
    AUTHORIZES: "AUTHORIZES",
    REGISTERED_IN: "REGISTERED_IN",
  };
  return aliases[normalized] ?? null;
}

function chooseWinner(ontoly, graphify) {
  const statusDelta = STATUS_RANK[ontoly.status] - STATUS_RANK[graphify.status];
  if (statusDelta > 0) return "Ontoly";
  if (statusDelta < 0) return "Graphify";
  if (ontoly.confidence > graphify.confidence) return "Ontoly";
  if (graphify.confidence > ontoly.confidence) return "Graphify";
  return "Tie";
}

function repositoryScoreFromQuestions(questionResults) {
  const ontoly = systemScore(questionResults, "ontoly");
  const graphify = systemScore(questionResults, "graphify");
  return {
    ontoly,
    graphify,
    winner: ontoly.semanticUnderstandingScore > graphify.semanticUnderstandingScore
      ? "Ontoly"
      : graphify.semanticUnderstandingScore > ontoly.semanticUnderstandingScore
        ? "Graphify"
        : "Tie",
  };
}

function systemScore(questionResults, system) {
  const rows = questionResults.map((question) => question[system]);
  const pass = rows.filter((row) => row.status === "PASS").length;
  const partial = rows.filter((row) => row.status === "PARTIAL").length;
  const fail = rows.filter((row) => row.status === "FAIL").length;
  const accuracy = rows.length === 0 ? 0 : ((pass + partial * 0.5) / rows.length) * 100;

  return {
    questions: rows.length,
    pass,
    partial,
    fail,
    exactMatchRate: round(average(rows.map((row) => row.exactMatch ? 100 : 0)), 2),
    precision: round(average(rows.map((row) => row.precision)) * 100, 2),
    recall: round(average(rows.map((row) => row.recall)) * 100, 2),
    confidence: round(average(rows.map((row) => row.confidence)), 2),
    latencyMs: round(average(rows.map((row) => row.latencyMs)), 3),
    semanticUnderstandingScore: round(accuracy, 2),
  };
}

function createAggregateResult(repositoryResults, previousBaseline, startedAt) {
  const questions = repositoryResults.flatMap((repo) => repo.questions);
  const ontoly = systemScore(questions, "ontoly");
  const graphify = systemScore(questions, "graphify");
  const categoryScores = createCategoryScores(questions);
  const regressionCurrent = {
    generatedAt: new Date().toISOString(),
    repositories: repositoryResults.map((repo) => ({
      repository: repo.repository,
      ontoly: repo.score.ontoly,
      graphify: repo.score.graphify,
      questions: repo.questions.map((question) => ({
        id: question.id,
        ontoly: question.ontoly.status,
        graphify: question.graphify.status,
      })),
    })),
    aggregate: { ontoly, graphify, categoryScores },
  };

  return {
    generatedAt: new Date().toISOString(),
    startedAt,
    repositories: repositoryResults,
    aggregateScores: {
      overallSemanticAccuracy: ontoly.semanticUnderstandingScore,
      controllerAccuracy: categoryScore(categoryScores, "Controllers", "ontoly"),
      routeAccuracy: categoryScore(categoryScores, "Routes", "ontoly"),
      serviceAccuracy: categoryScore(categoryScores, "Services", "ontoly"),
      dependencyInjectionAccuracy: categoryScore(categoryScores, "Dependency Injection", "ontoly"),
      configurationAccuracy: categoryScore(categoryScores, "Configuration", "ontoly"),
      callGraphAccuracy: categoryScore(categoryScores, "Call Graph", "ontoly"),
      architectureAccuracy: categoryScore(categoryScores, "Architecture", "ontoly"),
      frameworkUnderstanding: categoryScore(categoryScores, "Architecture", "ontoly"),
      workspaceUnderstanding: categoryScore(categoryScores, "Workspace", "ontoly"),
      semanticUnderstandingScore: ontoly.semanticUnderstandingScore,
    },
    systems: { ontoly, graphify },
    categoryScores,
    leaderboard: createLeaderboardRows(repositoryResults),
    regression: {
      ...compareSemanticRegression(previousBaseline, regressionCurrent),
      current: regressionCurrent,
    },
  };
}

function createCategoryScores(questions) {
  const byCategory = new Map();
  for (const category of CATEGORIES) {
    byCategory.set(category, []);
  }
  for (const question of questions) {
    byCategory.set(question.category, [...(byCategory.get(question.category) ?? []), question]);
  }

  return [...byCategory.entries()]
    .filter(([, rows]) => rows.length > 0)
    .map(([category, rows]) => ({
      category,
      ontoly: systemScore(rows, "ontoly"),
      graphify: systemScore(rows, "graphify"),
    }));
}

function categoryScore(categoryScores, category, system) {
  return categoryScores.find((score) => score.category === category)?.[system]?.semanticUnderstandingScore ?? 0;
}

function createLeaderboardRows(repositoryResults) {
  return repositoryResults.flatMap((repo) => repo.questions.map((question) => ({
    repository: repo.name,
    repositoryId: repo.repository,
    questionId: question.id,
    question: question.question,
    category: question.category,
    ontoly: question.ontoly.status,
    ontolyConfidence: question.ontoly.confidence,
    graphify: question.graphify.status,
    graphifyConfidence: question.graphify.confidence,
    winner: question.winner,
  })));
}

function compareSemanticRegression(previousBaseline, current) {
  if (!previousBaseline) {
    return {
      status: "PASS",
      baseline: "initialized",
      failures: [],
      improvements: [],
      warnings: ["No previous semantic baseline existed. Current results were written as regression-baseline.json."],
    };
  }

  const failures = [];
  const improvements = [];
  const warnings = [];
  const previousRepos = new Map((previousBaseline.repositories ?? []).map((repo) => [repo.repository, repo]));

  for (const currentRepo of current.repositories) {
    const previousRepo = previousRepos.get(currentRepo.repository);
    if (!previousRepo) {
      warnings.push(`${currentRepo.repository}: no previous semantic baseline.`);
      continue;
    }

    const scoreDrop = (previousRepo.ontoly?.semanticUnderstandingScore ?? 0) - currentRepo.ontoly.semanticUnderstandingScore;
    const scoreGain = currentRepo.ontoly.semanticUnderstandingScore - (previousRepo.ontoly?.semanticUnderstandingScore ?? 0);
    if (scoreDrop > 0.01) {
      failures.push(`${currentRepo.repository}: Ontoly semantic score dropped by ${round(scoreDrop, 2)} points.`);
    }
    if (scoreGain > 0.01) {
      improvements.push(`${currentRepo.repository}: Ontoly semantic score improved by ${round(scoreGain, 2)} points.`);
    }

    const previousQuestions = new Map((previousRepo.questions ?? []).map((question) => [question.id, question]));
    for (const question of currentRepo.questions) {
      const previousQuestion = previousQuestions.get(question.id);
      if (!previousQuestion) {
        improvements.push(`${currentRepo.repository}/${question.id}: new semantic question added.`);
        continue;
      }
      if (STATUS_RANK[question.ontoly] < STATUS_RANK[previousQuestion.ontoly]) {
        failures.push(`${currentRepo.repository}/${question.id}: Ontoly regressed from ${previousQuestion.ontoly} to ${question.ontoly}.`);
      }
      if (STATUS_RANK[question.ontoly] > STATUS_RANK[previousQuestion.ontoly]) {
        improvements.push(`${currentRepo.repository}/${question.id}: Ontoly improved from ${previousQuestion.ontoly} to ${question.ontoly}.`);
      }
    }
  }

  return {
    status: failures.length === 0 ? "PASS" : "FAIL",
    baseline: "compared",
    failures,
    improvements,
    warnings,
  };
}

async function writeRepositoryReport(result) {
  await writeJson(join(SEMANTIC_ROOT, "reports", `${result.repository}.json`), result);
  await writeFile(join(SEMANTIC_ROOT, "reports", `${result.repository}.md`), renderRepositoryMarkdown(result), "utf8");
}

async function writeAggregateArtifacts(aggregate) {
  await Promise.all([
    writeJson(join(SEMANTIC_ROOT, "leaderboard.json"), aggregate.leaderboard),
    writeJson(join(SEMANTIC_ROOT, "leaderboard", "leaderboard.json"), aggregate.leaderboard),
    writeFile(join(SEMANTIC_ROOT, "leaderboard.md"), renderLeaderboardMarkdown(aggregate), "utf8"),
    writeFile(join(SEMANTIC_ROOT, "leaderboard", "leaderboard.md"), renderLeaderboardMarkdown(aggregate), "utf8"),
    writeJson(join(SEMANTIC_ROOT, "reports", "summary.json"), aggregate),
    writeFile(join(SEMANTIC_ROOT, "reports", "summary.md"), renderSummaryMarkdown(aggregate), "utf8"),
    writeJson(join(SEMANTIC_ROOT, "reports", "performance.json"), performanceSummary(aggregate)),
    writeFile(join(SEMANTIC_ROOT, "reports", "performance.md"), renderBenchmarkMarkdown(aggregate), "utf8"),
    writeJson(join(SEMANTIC_ROOT, "regression-current.json"), aggregate.regression.current),
    writeJson(join(SEMANTIC_ROOT, "regression.json"), aggregate.regression),
  ]);
}

function renderConsoleSummary(aggregate, persistedAggregate = true) {
  const lines = [
    "Semantic evaluation complete.",
    `Ontoly Semantic Understanding Score: ${aggregate.systems.ontoly.semanticUnderstandingScore}`,
    `Graphify Semantic Understanding Score: ${aggregate.systems.graphify.semanticUnderstandingScore}`,
    `Regression: ${aggregate.regression.status}`,
  ];

  if (persistedAggregate) {
    lines.push(`Leaderboard: ${join(SEMANTIC_ROOT, "leaderboard.md")}`);
  } else if (aggregate.repositories[0]) {
    lines.push(`Repository report: ${join(SEMANTIC_ROOT, "reports", `${aggregate.repositories[0].repository}.md`)}`);
    lines.push("Aggregate leaderboard was not overwritten by this single-repository run.");
  }

  return lines.join("\n");
}

function renderLeaderboardMarkdown(aggregate) {
  return [
    "# Ontoly Semantic Evaluation Leaderboard",
    "",
    `Generated: ${aggregate.generatedAt}`,
    "",
    "| Repository | Question | Category | Ontoly | Graphify | Winner |",
    "| --- | --- | --- | ---: | ---: | --- |",
    ...aggregate.leaderboard.map((row) =>
      `| ${row.repository} | ${row.question} | ${row.category} | ${row.ontoly} (${row.ontolyConfidence}) | ${row.graphify} (${row.graphifyConfidence}) | ${row.winner} |`,
    ),
    "",
    "## Aggregate Scores",
    "",
    `- Overall Semantic Accuracy: ${aggregate.aggregateScores.overallSemanticAccuracy}`,
    `- Controller Accuracy: ${aggregate.aggregateScores.controllerAccuracy}`,
    `- Route Accuracy: ${aggregate.aggregateScores.routeAccuracy}`,
    `- Service Accuracy: ${aggregate.aggregateScores.serviceAccuracy}`,
    `- Dependency Injection Accuracy: ${aggregate.aggregateScores.dependencyInjectionAccuracy}`,
    `- Configuration Accuracy: ${aggregate.aggregateScores.configurationAccuracy}`,
    `- Call Graph Accuracy: ${aggregate.aggregateScores.callGraphAccuracy}`,
    `- Architecture Accuracy: ${aggregate.aggregateScores.architectureAccuracy}`,
    `- Semantic Understanding Score: ${aggregate.aggregateScores.semanticUnderstandingScore}`,
    "",
    "## Regression",
    "",
    `Status: ${aggregate.regression.status}`,
    ...(aggregate.regression.failures.length ? aggregate.regression.failures.map((failure) => `- FAIL: ${failure}`) : ["- No failures."]),
    ...(aggregate.regression.improvements.length ? aggregate.regression.improvements.map((item) => `- IMPROVED: ${item}`) : []),
    ...(aggregate.regression.warnings.length ? aggregate.regression.warnings.map((item) => `- WARN: ${item}`) : []),
    "",
  ].join("\n");
}

function renderSummaryMarkdown(aggregate) {
  return [
    "# Semantic Evaluation Summary",
    "",
    `Generated: ${aggregate.generatedAt}`,
    "",
    "| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    scoreRow("Ontoly", aggregate.systems.ontoly),
    scoreRow("Graphify", aggregate.systems.graphify),
    "",
    "## Category Scores",
    "",
    "| Category | Ontoly | Graphify |",
    "| --- | ---: | ---: |",
    ...aggregate.categoryScores.map((row) =>
      `| ${row.category} | ${row.ontoly.semanticUnderstandingScore} | ${row.graphify.semanticUnderstandingScore} |`,
    ),
    "",
    "## Repositories",
    "",
    ...aggregate.repositories.map(renderRepositoryMarkdown),
  ].join("\n");
}

function renderRepositoryMarkdown(result) {
  return [
    `# ${result.name} Semantic Evaluation`,
    "",
    `Repository: ${result.repository}`,
    `Frameworks: ${result.frameworks.join(", ") || "none"}`,
    "",
    "| System | Questions | PASS | PARTIAL | FAIL | Precision | Recall | Score | Avg Latency |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    scoreRow("Ontoly", result.score.ontoly),
    scoreRow("Graphify", result.score.graphify),
    "",
    "## Questions",
    "",
    "| Question | Category | Ontoly | Graphify | Winner |",
    "| --- | --- | ---: | ---: | --- |",
    ...result.questions.map((question) =>
      `| ${question.question} | ${question.category} | ${question.ontoly.status} (${question.ontoly.confidence}) | ${question.graphify.status} (${question.graphify.confidence}) | ${question.winner} |`,
    ),
    "",
  ].join("\n");
}

function renderBenchmarkMarkdown(aggregate) {
  return [
    "# Semantic Evaluation Performance",
    "",
    "| Repository | Questions | Ontoly Avg Latency | Graphify Avg Latency |",
    "| --- | ---: | ---: | ---: |",
    ...aggregate.repositories.map((repo) =>
      `| ${repo.name} | ${repo.questionCount} | ${repo.score.ontoly.latencyMs}ms | ${repo.score.graphify.latencyMs}ms |`,
    ),
    "",
    `Ontoly aggregate avg latency: ${aggregate.systems.ontoly.latencyMs}ms`,
    `Graphify aggregate avg latency: ${aggregate.systems.graphify.latencyMs}ms`,
    "",
  ].join("\n");
}

function performanceSummary(aggregate) {
  return {
    generatedAt: aggregate.generatedAt,
    repositories: aggregate.repositories.map((repo) => ({
      repository: repo.repository,
      questions: repo.questionCount,
      ontolyLatencyMs: repo.score.ontoly.latencyMs,
      graphifyLatencyMs: repo.score.graphify.latencyMs,
    })),
    aggregate: {
      ontolyLatencyMs: aggregate.systems.ontoly.latencyMs,
      graphifyLatencyMs: aggregate.systems.graphify.latencyMs,
    },
  };
}

function scoreRow(name, score) {
  return `| ${name} | ${score.questions} | ${score.pass} | ${score.partial} | ${score.fail} | ${score.precision} | ${score.recall} | ${score.semanticUnderstandingScore} | ${score.latencyMs}ms |`;
}

function artifactPaths(repository) {
  return {
    ontolyGraph: join(VALIDATION_ROOT, repository, "ontoly", "SoftwareGraph.json"),
    graphifyGraph: join(VALIDATION_ROOT, repository, "graphify", "structural", "graphify-out", "graph.json"),
  };
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  return {
    repository: positional[0] ?? null,
    json: flags.has("--json"),
    ci: flags.has("--ci"),
    refresh: flags.has("--refresh"),
    benchmark: flags.has("--benchmark"),
    leaderboardOnly: flags.has("--leaderboard-only"),
  };
}

function parseYamlSubset(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed);
  }

  const lines = text.split(/\r?\n/)
    .map((line) => ({ indent: line.match(/^\s*/)?.[0].length ?? 0, content: line.trim() }))
    .filter((line) => line.content && !line.content.startsWith("#"));

  const [value] = parseBlock(lines, 0, lines[0]?.indent ?? 0);
  return value;
}

function parseBlock(lines, index, indent) {
  if (index >= lines.length) {
    return [null, index];
  }

  if (lines[index].content.startsWith("- ")) {
    return parseArray(lines, index, indent);
  }

  return parseObject(lines, index, indent);
}

function parseArray(lines, index, indent) {
  const values = [];

  while (index < lines.length && lines[index].indent === indent && lines[index].content.startsWith("- ")) {
    const rest = lines[index].content.slice(2).trim();
    index += 1;

    if (!rest) {
      const [child, next] = parseBlock(lines, index, indent + 2);
      values.push(child);
      index = next;
      continue;
    }

    const keyValue = parseKeyValue(rest);
    if (keyValue) {
      let value = { [keyValue.key]: keyValue.value === null ? {} : keyValue.value };
      if (index < lines.length && lines[index].indent > indent) {
        const [child, next] = parseBlock(lines, index, indent + 2);
        value = { ...value, ...(child && typeof child === "object" && !Array.isArray(child) ? child : {}) };
        index = next;
      }
      values.push(value);
    } else {
      values.push(parseScalar(rest));
    }
  }

  return [values, index];
}

function parseObject(lines, index, indent) {
  const object = {};

  while (index < lines.length && lines[index].indent === indent && !lines[index].content.startsWith("- ")) {
    const keyValue = parseKeyValue(lines[index].content);
    if (!keyValue) {
      throw new Error(`Invalid YAML line: ${lines[index].content}`);
    }
    index += 1;

    if (keyValue.value === null) {
      const [child, next] = parseBlock(lines, index, indent + 2);
      object[keyValue.key] = child;
      index = next;
    } else {
      object[keyValue.key] = keyValue.value;
    }
  }

  return [object, index];
}

function parseKeyValue(content) {
  const match = content.match(/^([A-Za-z0-9_-]+):(?:\s+(.*)|\s*)$/);
  if (!match) {
    return null;
  }
  return {
    key: match[1],
    value: match[2] === undefined || match[2] === "" ? null : parseScalar(match[2]),
  };
}

function parseScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).split(",").map((item) => parseScalar(item.trim())).filter((item) => item !== "");
  }
  return trimmed;
}

function answerFromNode(node, explanation) {
  return {
    label: node.label,
    type: node.type,
    id: node.id,
    file: node.file,
    explanation,
  };
}

function answerFromEdge(edge) {
  return {
    label: `${edge.sourceLabel} -> ${edge.targetLabel}`,
    type: edge.type,
    id: edge.id,
    file: null,
    explanation: `Matched ${edge.type} relationship.`,
  };
}

function matchesTerms(node, terms, exactTerms) {
  if (terms.length === 0) {
    return true;
  }
  return terms.every((term) => exactTerms
    ? equivalent(node.label, term)
    : containsNormalized(node.label, term) || containsNormalized(node.file ?? "", term));
}

function cleanGraphifyLabel(value) {
  return String(value)
    .replace(/^_+/, "")
    .replace(/\(\)$/, "")
    .trim();
}

function normalizeAnswer(value) {
  return cleanGraphifyLabel(value)
    .toLowerCase()
    .replace(/\s*->\s*/g, "->")
    .replace(/[^a-z0-9@/_:.*$>-]/g, "");
}

function equivalent(left, right) {
  return normalizeAnswer(left) === normalizeAnswer(right);
}

function containsNormalized(left, right) {
  return normalizeAnswer(left).includes(normalizeAnswer(right));
}

function dedupeAnswers(answers) {
  const seen = new Set();
  return answers.filter((answer) => {
    const key = `${normalizeAnswer(answer.label)}|${answer.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeStrings(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = normalizeAnswer(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareCandidateNodes(left, right) {
  return left.type.localeCompare(right.type) || left.label.localeCompare(right.label) || String(left.file).localeCompare(String(right.file));
}

function compareCandidateEdges(left, right) {
  return left.type.localeCompare(right.type) || left.sourceLabel.localeCompare(right.sourceLabel) || left.targetLabel.localeCompare(right.targetLabel);
}

function arrayOfStrings(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((item) => String(item));
}

function inferEvaluator(category) {
  const normalized = String(category).toLowerCase();
  if (normalized.includes("controller")) return "FindController";
  if (normalized.includes("route")) return "FindRoute";
  if (normalized.includes("service") || normalized.includes("provider")) return "FindProvider";
  if (normalized.includes("module")) return "FindModule";
  if (normalized.includes("dependency")) return "FindDependency";
  if (normalized.includes("configuration")) return "FindConfiguration";
  if (normalized.includes("environment")) return "FindEnvironmentVariable";
  if (normalized.includes("call")) return "FindCallChain";
  return "ArchitectureSummary";
}

async function readJsonIfExists(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function average(values) {
  const numeric = values.filter((value) => Number.isFinite(value));
  return numeric.length === 0 ? 0 : numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}
