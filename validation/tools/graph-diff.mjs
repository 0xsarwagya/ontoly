#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";

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
  if (!args.oldGraph || !args.newGraph) {
    throw new Error("Usage: graph-diff.mjs <old.graph> <new.graph> [--json] [--output path]");
  }

  const oldGraph = JSON.parse(await readFile(args.oldGraph, "utf8"));
  const newGraph = JSON.parse(await readFile(args.newGraph, "utf8"));
  const diff = await diffGraphs(oldGraph, newGraph, args.oldGraph, args.newGraph);

  if (args.output) {
    await writeFile(args.output, args.json ? `${JSON.stringify(diff, null, 2)}\n` : renderMarkdown(diff), "utf8");
  }

  writeOut(args.json ? JSON.stringify(diff, null, 2) : renderMarkdown(diff));

  if (args.ci && diff.status === "FAIL") {
    process.exitCode = 1;
  }
}

async function diffGraphs(oldGraph, newGraph, oldPath, newPath) {
  const oldNodes = new Map((oldGraph.nodes ?? []).map((node) => [node.id, node]));
  const newNodes = new Map((newGraph.nodes ?? []).map((node) => [node.id, node]));
  const oldEdges = new Map((oldGraph.edges ?? []).map((edge) => [edgeKey(edge), edge]));
  const newEdges = new Map((newGraph.edges ?? []).map((edge) => [edgeKey(edge), edge]));

  const addedNodes = [...newNodes.values()].filter((node) => !oldNodes.has(node.id)).map(nodeSummary);
  const removedNodes = [...oldNodes.values()].filter((node) => !newNodes.has(node.id)).map(nodeSummary);
  const changedNodes = [...newNodes.values()]
    .filter((node) => oldNodes.has(node.id) && stableHash(nodeComparable(node)) !== stableHash(nodeComparable(oldNodes.get(node.id))))
    .map((node) => ({
      id: node.id,
      before: nodeSummary(oldNodes.get(node.id)),
      after: nodeSummary(node),
    }));

  const addedEdges = [...newEdges.values()].filter((edge) => !oldEdges.has(edgeKey(edge))).map(edgeSummary);
  const removedEdges = [...oldEdges.values()].filter((edge) => !newEdges.has(edgeKey(edge))).map(edgeSummary);
  const changedRelationships = [...newEdges.values()]
    .filter((edge) => oldEdges.has(edgeKey(edge)) && stableHash(edgeComparable(edge)) !== stableHash(edgeComparable(oldEdges.get(edgeKey(edge)))))
    .map((edge) => ({
      id: edge.id,
      before: edgeSummary(oldEdges.get(edgeKey(edge))),
      after: edgeSummary(edge),
    }));

  const oldCoverage = await readSiblingMetrics(oldPath);
  const newCoverage = await readSiblingMetrics(newPath);
  const nodeCounts = {
    before: countBy((oldGraph.nodes ?? []).map((node) => node.type)),
    after: countBy((newGraph.nodes ?? []).map((node) => node.type)),
  };
  const relationshipCounts = {
    before: countBy((oldGraph.edges ?? []).map((edge) => edge.type)),
    after: countBy((newGraph.edges ?? []).map((edge) => edge.type)),
  };
  const semanticDifferences = semanticDiff(nodeCounts, relationshipCounts);
  const coverageDifferences = metricDiff(oldCoverage.coverage, newCoverage.coverage);
  const trustDifferences = metricDiff(oldCoverage.trust, newCoverage.trust);
  const performanceDifferences = performanceDiff(oldCoverage.performance, newCoverage.performance);

  const status = removedNodes.length > 0 ||
    removedEdges.length > 0 ||
    coverageDifferences.delta < 0 ||
    trustDifferences.delta < 0
    ? "FAIL"
    : "PASS";

  return {
    generatedAt: new Date().toISOString(),
    status,
    inputs: {
      oldGraph: resolve(oldPath),
      newGraph: resolve(newPath),
      oldHash: oldGraph.metadata?.deterministicHash ?? stableHash(oldGraph),
      newHash: newGraph.metadata?.deterministicHash ?? stableHash(newGraph),
    },
    summary: {
      addedNodes: addedNodes.length,
      removedNodes: removedNodes.length,
      changedNodes: changedNodes.length,
      addedEdges: addedEdges.length,
      removedEdges: removedEdges.length,
      changedRelationships: changedRelationships.length,
      coverageDelta: coverageDifferences.delta,
      trustDelta: trustDifferences.delta,
      performanceDeltaMs: performanceDifferences.totalDurationMs?.delta ?? null,
    },
    nodes: { added: addedNodes, removed: removedNodes, changed: changedNodes },
    relationships: { added: addedEdges, removed: removedEdges, changed: changedRelationships },
    counts: { nodes: nodeCounts, relationships: relationshipCounts },
    coverageDifferences,
    trustDifferences,
    performanceDifferences,
    semanticDifferences,
  };
}

async function readSiblingMetrics(graphPath) {
  const directory = dirname(graphPath);
  const coverage = await readJsonIfExists(join(directory, "coverage.json"));
  const quality = await readJsonIfExists(join(directory, "quality.json"));
  const performance = await readJsonIfExists(join(directory, "performance.json"));
  const result = await readJsonIfExists(join(directory, "latest.json"));

  return {
    coverage: coverage?.summary?.coverage ?? quality?.summary?.coverage ?? result?.coverage ?? null,
    trust: coverage?.summary?.trustworthiness ?? quality?.summary?.trustworthiness ?? result?.trust ?? null,
    performance: performance ?? result?.performance ?? null,
  };
}

function semanticDiff(nodeCounts, relationshipCounts) {
  return {
    nodeTypes: countDiff(nodeCounts.before, nodeCounts.after),
    relationshipTypes: countDiff(relationshipCounts.before, relationshipCounts.after),
  };
}

function countDiff(before, after) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys
    .map((key) => ({ key, before: before[key] ?? 0, after: after[key] ?? 0, delta: (after[key] ?? 0) - (before[key] ?? 0) }))
    .filter((entry) => entry.delta !== 0);
}

function metricDiff(before, after) {
  return {
    before,
    after,
    delta: Number.isFinite(before) && Number.isFinite(after) ? round(after - before) : 0,
  };
}

function performanceDiff(before, after) {
  const fields = ["totalDurationMs", "peakMemoryBytes", "queryLatencyMs", "graphSizeBytes"];
  return Object.fromEntries(fields.map((field) => [
    field,
    {
      before: before?.[field] ?? null,
      after: after?.[field] ?? null,
      delta: Number.isFinite(before?.[field]) && Number.isFinite(after?.[field])
        ? round(after[field] - before[field])
        : null,
    },
  ]));
}

function renderMarkdown(diff) {
  return [
    "# Software Graph Diff",
    "",
    `Generated: ${diff.generatedAt}`,
    `Status: ${diff.status}`,
    "",
    "## Inputs",
    "",
    `- Old: ${diff.inputs.oldGraph}`,
    `- New: ${diff.inputs.newGraph}`,
    `- Old hash: ${diff.inputs.oldHash}`,
    `- New hash: ${diff.inputs.newHash}`,
    "",
    "## Summary",
    "",
    `- Added nodes: ${diff.summary.addedNodes}`,
    `- Removed nodes: ${diff.summary.removedNodes}`,
    `- Changed nodes: ${diff.summary.changedNodes}`,
    `- Added relationships: ${diff.summary.addedEdges}`,
    `- Removed relationships: ${diff.summary.removedEdges}`,
    `- Changed relationships: ${diff.summary.changedRelationships}`,
    `- Coverage delta: ${diff.summary.coverageDelta}`,
    `- Trust delta: ${diff.summary.trustDelta}`,
    `- Performance delta: ${diff.summary.performanceDeltaMs ?? "n/a"}ms`,
    "",
    "## Added Nodes",
    "",
    renderList(diff.nodes.added),
    "",
    "## Removed Nodes",
    "",
    renderList(diff.nodes.removed),
    "",
    "## Changed Relationships",
    "",
    renderList(diff.relationships.changed.map((item) => item.after)),
    "",
    "## Semantic Differences",
    "",
    "### Node Types",
    "",
    renderCountDiff(diff.semanticDifferences.nodeTypes),
    "",
    "### Relationship Types",
    "",
    renderCountDiff(diff.semanticDifferences.relationshipTypes),
  ].join("\n");
}

function renderList(items) {
  if (!items.length) return "- None.";
  return items.slice(0, 100).map((item) => `- ${item.id ?? item.key}: ${item.type ?? ""} ${item.name ?? item.from ?? ""}${item.to ? ` -> ${item.to}` : ""}`).join("\n");
}

function renderCountDiff(items) {
  if (!items.length) return "- None.";
  return items.map((item) => `- ${item.key}: ${item.before} -> ${item.after} (${item.delta >= 0 ? "+" : ""}${item.delta})`).join("\n");
}

function nodeSummary(node) {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    file: node.file ?? node.span?.file ?? null,
  };
}

function edgeSummary(edge) {
  return {
    id: edge.id,
    type: edge.type,
    from: edge.from,
    to: edge.to,
  };
}

function nodeComparable(node) {
  return {
    type: node.type,
    name: node.name,
    file: node.file ?? null,
    span: node.span ?? null,
    metadata: node.metadata ?? null,
  };
}

function edgeComparable(edge) {
  return {
    type: edge.type,
    from: edge.from,
    to: edge.to,
    confidence: edge.confidence ?? null,
    metadata: edge.metadata ?? null,
  };
}

function edgeKey(edge) {
  return `${edge.from}|${edge.type}|${edge.to}`;
}

function countBy(values) {
  return Object.fromEntries([...values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function stableHash(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function parseArgs(argv) {
  const positional = argv.filter((item) => !item.startsWith("--"));
  const outputIndex = argv.indexOf("--output");
  return {
    oldGraph: positional[0],
    newGraph: positional[1],
    json: argv.includes("--json"),
    ci: argv.includes("--ci"),
    output: outputIndex >= 0 ? argv[outputIndex + 1] : null,
  };
}
