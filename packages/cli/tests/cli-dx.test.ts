import { describe, expect, it } from "vitest";
import {
  createEdgeId,
  createSemanticIndex,
  createSoftwareGraph,
  type EdgeEvidence,
  type SoftwareGraph,
  type SoftwareGraphEdge,
  type SoftwareGraphNode,
  type SourceSpan,
} from "@0xsarwagya/ontoly-core";
import {
  OntolyCliError,
  commandHelp,
  createBoundedEvidencePack,
  formatCliError,
  formatLogPrefix,
  parseCli,
  renderCommandHelp,
  shouldPromptForRepositoryRoot,
} from "../src/cli";

const ONTOLY_REMOTE_REPOSITORY = "https://github.com/0xsarwagya/ontoly.git";
const INTERACTIVE_TTY = { stdinIsTTY: true, stdoutIsTTY: true };

describe("cli developer experience helpers", () => {
  it("parses positional arguments and boolean/string flags deterministically", () => {
    const cli = parseCli(["build", "examples/basic", "--remote", ONTOLY_REMOTE_REPOSITORY, "--output", ".graph", "--json", "--no-color"]);

    expect(cli.command).toBe("build");
    expect(cli.positional).toEqual(["examples/basic"]);
    expect(cli.flags.get("remote")).toBe(ONTOLY_REMOTE_REPOSITORY);
    expect(cli.flags.get("output")).toBe(".graph");
    expect(cli.flags.get("json")).toBe(true);
    expect(cli.flags.get("no-color")).toBe(true);
  });

  it("renders command-specific help with usage, options, and examples", () => {
    const help = renderCommandHelp(commandHelp().build);

    expect(help).toContain("ontoly build");
    expect(help).toContain("Compile a repository into a deterministic Software Graph.");
    expect(help).toContain("Usage:");
    expect(help).toContain("--remote git_repo");
    expect(help).toContain("--output path");
    expect(help).toContain("Default: ontoly-output");
    expect(help).toContain("--bundle");
    expect(help).toContain("--no-prompt");
    expect(help).toContain("--yes");
    expect(help).toContain(`ontoly build --remote ${ONTOLY_REMOTE_REPOSITORY}`);
    expect(help).toContain("ontoly build . --json");
  });

  it("renders command help without tab indentation", () => {
    const helpText = Object.values(commandHelp()).map(renderCommandHelp).join("\n\n");

    expect(helpText).not.toContain("\t");
  });

  it("documents rich ontoly-output bundle generation", () => {
    const help = renderCommandHelp(commandHelp().output);

    expect(help).toContain("ontoly output");
    expect(help).toContain("ontoly-output folder");
    expect(help).toContain("--remote git_repo");
    expect(help).toContain("--no-html");
    expect(help).toContain("--no-prompt");
    expect(help).toContain("--yes");
    expect(help).toContain(`ontoly output --remote ${ONTOLY_REMOTE_REPOSITORY}`);
    expect(help).toContain("ontoly output .");
  });

  it("prompts for a repository folder for bare interactive build commands", () => {
    expectRepositoryPrompt(["build"], true);
    expectRepositoryPrompt(["output"], true);
    expectRepositoryPrompt(["compile"], true);
  });

  it("skips repository prompts when input is explicit or non-interactive", () => {
    expectRepositoryPrompt(["build", "."], false);
    expectRepositoryPrompt(["build", "--root", "."], false);
    expectRepositoryPrompt(["build", "--remote", ONTOLY_REMOTE_REPOSITORY], false);
    expectRepositoryPrompt(["build", "--json"], false);
    expectRepositoryPrompt(["build", "--log-json"], false);
    expectRepositoryPrompt(["build", "--no-prompt"], false);
    expectRepositoryPrompt(["build", "--yes"], false);
    expectRepositoryPrompt(["inspect"], false);
    expect(shouldPromptForRepositoryRoot(parseCli(["build"]), { stdinIsTTY: false, stdoutIsTTY: true })).toBe(false);
    expect(shouldPromptForRepositoryRoot(parseCli(["build"]), { stdinIsTTY: true, stdoutIsTTY: false })).toBe(false);
  });

  it("documents interactive HTML graph export", () => {
    const help = renderCommandHelp(commandHelp().graph);

    expect(help).toContain("--format summary|json|mermaid|dot|graphml|html");
    expect(help).toContain("ontoly graph --format html > graph.html");
  });

  it("documents interactive HTML architecture export", () => {
    const help = renderCommandHelp(commandHelp().architecture);

    expect(help).toContain("--format mermaid|html");
    expect(help).toContain("--max-nodes n");
    expect(help).toContain("ontoly architecture --format html > architecture.html");
  });

  it("documents enhancer platform commands", () => {
    const help = renderCommandHelp(commandHelp().enhancer);

    expect(help).toContain("ontoly enhancer");
    expect(help).toContain("list");
    expect(help).toContain("inspect <id>");
    expect(help).toContain("run <id|artifact|all>");
    expect(help).toContain("--format mermaid|dot|json");
    expect(help).toContain("ontoly enhancer run semantic-index .");
    expect(help).toContain("ontoly enhancer validate --ci");
  });

  it("documents evidence packs and scoped impact modes", () => {
    const evidence = renderCommandHelp(commandHelp().evidence);
    const impact = renderCommandHelp(commandHelp().impact);
    const plan = renderCommandHelp(commandHelp()["implementation-plan"]);

    expect(evidence).toContain("ontoly evidence");
    expect(evidence).toContain("Evidence Pack");
    expect(evidence).toContain("--limit n");
    expect(impact).toContain("--mode direct|local|feature|semantic|blast-radius");
    expect(impact).toContain("ontoly impact fn:src/auth.ts:login --mode local");
    expect(plan).toContain("--budget n");
    expect(plan).toContain("--max-time-ms n");
    expect(plan).toContain("--max-nodes n");
    expect(plan).toContain("--max-edges n");
    expect(plan).toContain("clamped to 1-250");
  });

  it("documents bounded capability profiling", () => {
    const help = renderCommandHelp(commandHelp().profile);

    expect(help).toContain("ontoly profile");
    expect(help).toContain("implementation-plan");
    expect(help).toContain("--max-time-ms n");
    expect(help).toContain("--max-nodes n");
    expect(help).toContain("--max-edges n");
  });

  it("formats structured CLI errors with codes, suggestions, and docs", () => {
    const message = formatCliError(new OntolyCliError({
      code: "ONTOLY0001",
      message: "Unknown command: wat",
      suggestion: "Run ontoly --help to see available commands.",
      docs: "docs/cli.md",
    }));

    expect(message).toContain("ONTOLY0001");
    expect(message).toContain("Unknown command: wat");
    expect(message).toContain("Suggestion:");
    expect(message).toContain("Documentation:");
  });

  it("uses stable non-color log prefixes", () => {
    expect(formatLogPrefix("info", false)).toBe("info   ");
    expect(formatLogPrefix("success", false)).toBe("success");
    expect(formatLogPrefix("warning", false)).toBe("warning");
    expect(formatLogPrefix("error", false)).toBe("error  ");
  });

  it("builds bounded enhancer evidence packs without graph serialization", () => {
    const graph = evidenceFixtureGraph();
    const pack = createBoundedEvidencePack(graph, createSemanticIndex(graph), "sleep duration thresholds");

    expect(pack.topNodes.length).toBeLessThanOrEqual(20);
    expect(pack.topEdges.length).toBeLessThanOrEqual(50);
    expect(pack.relevantFiles.length).toBeLessThanOrEqual(10);
    expect(pack.graphFacts).toMatchObject({
      repository: "evidence-fixture",
      nodeCount: graph.metadata.nodeCount,
      edgeCount: graph.metadata.edgeCount,
    });
    expect(pack.graphFacts).not.toHaveProperty("nodes");
    expect(pack.graphFacts).not.toHaveProperty("edges");
    expect(pack).not.toHaveProperty("graph");
    expect(pack.evidence.length).toBeGreaterThan(0);

    for (const item of pack.evidence) {
      expect(item).toMatchObject({
        stableId: expect.any(String),
        kind: expect.any(String),
        confidence: expect.any(Number),
        whySelected: expect.any(String),
        relationships: expect.any(Object),
        nextCommands: expect.any(Array),
      });
      expect(item).toHaveProperty("sourceSpan");
    }
  });
});

function expectRepositoryPrompt(argv: readonly string[], expected: boolean): void {
  expect(shouldPromptForRepositoryRoot(parseCli(argv), INTERACTIVE_TTY)).toBe(expected);
}

function evidenceFixtureGraph(): SoftwareGraph {
  const moduleNode = evidenceNode("Module", "SleepDurationThresholdModule", "src/sleep/sleep-duration-threshold.module.ts", 1);
  const nodes: SoftwareGraphNode[] = [moduleNode];
  const edges: SoftwareGraphEdge[] = [];

  for (let index = 0; index < 32; index += 1) {
    const service = evidenceNode("Service", `SleepDurationThresholdService${index}`, `src/sleep/service-${index % 14}.ts`, index + 2);
    const dto = evidenceNode("Model", `SleepDurationThresholdDto${index}`, `src/sleep/dto-${index % 14}.ts`, index + 34);
    const repository = evidenceNode("Repository", `SleepDurationThresholdRepository${index}`, `src/sleep/repository-${index % 14}.ts`, index + 66);
    nodes.push(service, dto, repository);
    edges.push(
      evidenceEdge("CONTAINS", moduleNode, service),
      evidenceEdge("CONTAINS", moduleNode, dto),
      evidenceEdge("CONTAINS", moduleNode, repository),
      evidenceEdge("REFERENCES", service, dto),
      evidenceEdge("CALLS", service, repository),
      evidenceEdge("USES", repository, dto),
    );
    if (index > 0) {
      edges.push(evidenceEdge("CALLS", service, nodes[nodes.length - 6]!));
    }
  }

  return createSoftwareGraph({
    repository: {
      root: "/repo",
      name: "evidence-fixture",
      packageName: "evidence-fixture",
    },
    nodes,
    edges,
    fileCount: 14,
  });
}

function evidenceNode(
  type: SoftwareGraphNode["type"],
  name: string,
  file: string,
  line: number,
): SoftwareGraphNode {
  return {
    id: `${type.toLowerCase()}:${file}:${name}`,
    type,
    name,
    file,
    span: evidenceSpan(file, line),
  };
}

function evidenceEdge(
  type: SoftwareGraphEdge["type"],
  from: SoftwareGraphNode,
  to: SoftwareGraphNode,
): SoftwareGraphEdge {
  return {
    id: createEdgeId(type, from.id, to.id),
    type,
    from: from.id,
    to: to.id,
    evidence: [syntaxEvidence(from.span!)],
  };
}

function syntaxEvidence(span: SourceSpan): EdgeEvidence {
  return {
    kind: "syntax",
    confidence: "exact",
    span,
    description: "fixture syntax evidence",
  };
}

function evidenceSpan(file: string, line: number): SourceSpan {
  return {
    file,
    startLine: line,
    startColumn: 1,
    endLine: line,
    endColumn: 12,
  };
}
