#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const graphPath = flag("--graph") ?? ".ontoly/SoftwareGraph.json";
const questionsPath = flag("--questions") ?? "validation/search/questions/software-engineering-phrases.json";
const outputPath = flag("--output") ?? "validation/search/reports/latest.json";
const json = args.includes("--json");

const indexModule = await import(pathToFileURL(resolve("packages/index/dist/index.js")).href).catch((error) => {
  throw new Error("Build @0xsarwagya/ontoly-index before running search evaluation.", { cause: error });
});

const graph = JSON.parse(await readFile(resolve(graphPath), "utf8"));
const questions = JSON.parse(await readFile(resolve(questionsPath), "utf8")).questions ?? [];
const index = indexModule.createSemanticIndex(graph);
const results = [];

for (const question of questions) {
  const started = performance.now();
  const result = indexModule.resolveIntent(index, question.phrase, {
    category: question.category,
    limit: 5,
  });
  const latencyMs = performance.now() - started;
  const expected = new Set((question.expected?.top5Concepts ?? []).map((item) => String(item).toLowerCase()));
  const candidates = result.candidates.map((candidate) =>
    `${candidate.displayName} ${candidate.nodeId} ${candidate.matchedTerms.join(" ")}`.toLowerCase()
  );
  const top1 = candidates[0] ?? "";
  const top5Matched = candidates.some((candidate) => [...expected].some((term) => candidate.includes(term)));
  const top1Matched = [...expected].some((term) => top1.includes(term));

  results.push({
    id: question.id,
    phrase: question.phrase,
    category: question.category,
    status: top1Matched ? "PASS" : top5Matched ? "PARTIAL" : "FAIL",
    top1: result.candidates[0]?.nodeId ?? null,
    top1Accuracy: top1Matched ? 1 : 0,
    top5Accuracy: top5Matched ? 1 : 0,
    latencyMs: Math.round(latencyMs * 1000) / 1000,
    candidates: result.candidates.map((candidate) => ({
      id: candidate.nodeId,
      name: candidate.displayName,
      type: candidate.kind,
      score: candidate.score,
      confidence: candidate.confidence,
    })),
  });
}

const report = {
  version: "1.0.0",
  graphHash: graph.metadata?.deterministicHash ?? "unknown",
  repository: graph.repository?.name ?? "unknown",
  questions: results.length,
  summary: {
    top1Accuracy: average(results.map((result) => result.top1Accuracy)),
    top5Accuracy: average(results.map((result) => result.top5Accuracy)),
    averageLatencyMs: average(results.map((result) => result.latencyMs)),
    pass: results.filter((result) => result.status === "PASS").length,
    partial: results.filter((result) => result.status === "PARTIAL").length,
    fail: results.filter((result) => result.status === "FAIL").length,
  },
  results,
};

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Semantic Search Evaluation: ${report.repository}`);
  console.log(`Questions: ${report.questions}`);
  console.log(`Top-1 Accuracy: ${report.summary.top1Accuracy}`);
  console.log(`Top-5 Accuracy: ${report.summary.top5Accuracy}`);
  console.log(`Average Latency: ${report.summary.averageLatencyMs}ms`);
  console.log(`Report: ${outputPath}`);
}

function flag(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 1000) / 1000;
}
