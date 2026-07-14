import { describe, expect, it } from "vitest";
import {
  OntolyCliError,
  commandHelp,
  formatCliError,
  formatLogPrefix,
  parseCli,
  renderCommandHelp,
} from "../src/cli";

describe("cli developer experience helpers", () => {
  it("parses positional arguments and boolean/string flags deterministically", () => {
    const cli = parseCli(["build", "examples/basic", "--output", ".graph", "--json", "--no-color"]);

    expect(cli.command).toBe("build");
    expect(cli.positional).toEqual(["examples/basic"]);
    expect(cli.flags.get("output")).toBe(".graph");
    expect(cli.flags.get("json")).toBe(true);
    expect(cli.flags.get("no-color")).toBe(true);
  });

  it("renders command-specific help with usage, options, and examples", () => {
    const help = renderCommandHelp(commandHelp().build);

    expect(help).toContain("ontoly build");
    expect(help).toContain("Compile a repository into a deterministic Software Graph.");
    expect(help).toContain("Usage:");
    expect(help).toContain("--output path");
    expect(help).toContain("Default: ontoly-output");
    expect(help).toContain("--bundle");
    expect(help).toContain("ontoly build . --json");
  });

  it("documents rich ontoly-output bundle generation", () => {
    const help = renderCommandHelp(commandHelp().output);

    expect(help).toContain("ontoly output");
    expect(help).toContain("ontoly-output folder");
    expect(help).toContain("--no-html");
    expect(help).toContain("ontoly output .");
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
});
