import type { Metadata } from "next";
import Link from "next/link";
import { SITE, SKILLS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agent Skills Catalog",
  description:
    "The full list of Ontoly Agent Skills — deterministic, graph-first workflows for Claude Code, Cursor, and GitHub Copilot. Each skill orchestrates typed MCP capabilities over a deterministic Software Graph.",
  alternates: { canonical: "/docs/skills" },
  openGraph: {
    title: "Ontoly Agent Skills Catalog",
    description:
      "14 portable, graph-first Agent Skills that give AI coding agents a deterministic Software Graph to query.",
    url: `${SITE.url}/docs/skills`,
    images: [
      {
        url: "/assets/agent-skills-diagram.svg",
        width: 1200,
        height: 630,
        alt: "Ontoly Agent Skills",
      },
    ],
  },
};

const CATEGORIES = Array.from(new Set(SKILLS.map((s) => s.category)));

export default function SkillsCatalogPage() {
  return (
    <div className="skill-detail">
      <span className="eyebrow">Reference · Catalog</span>
      <h1>Agent Skills Catalog</h1>
      <p className="lead">
        Ontoly ships <strong>{SKILLS.length}</strong> portable Agent Skills.
        Each one is a workflow that orchestrates typed MCP capabilities over
        a deterministic Software Graph, so every answer carries graph
        evidence — node ids, typed edges, source spans, and a reproducible
        graph hash.
      </p>
      <p>
        Skills are installable via{" "}
        <a href={SITE.skillsSh} target="_blank" rel="noopener noreferrer">
          skills.sh
        </a>{" "}
        into Claude Code, Cursor, GitHub Copilot, and any other agent that
        speaks the portable Agent Skills format.
      </p>

      <h2>Install</h2>
      <p>Install every skill in one command:</p>
      <pre>
        <code>npx skills add 0xsarwagya/ontoly</code>
      </pre>
      <p>Or install a single skill:</p>
      <pre>
        <code>npx skills add 0xsarwagya/ontoly --skill impact-analysis</code>
      </pre>

      {CATEGORIES.map((cat) => (
        <div key={cat}>
          <h2>{cat}</h2>
          <ul>
            {SKILLS.filter((s) => s.category === cat).map((s) => (
              <li key={s.slug}>
                <Link href={`/docs/skills/${s.slug}`}>
                  <strong>{s.name}</strong>
                </Link>{" "}
                — {s.description}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <h2>Also see</h2>
      <ul>
        <li>
          <Link href="/skills">Marketing catalog</Link> — the visual index of every
          skill with install commands.
        </li>
        <li>
          <Link href="/docs/mcp">MCP capabilities</Link> — the raw capability surface
          skills orchestrate.
        </li>
        <li>
          <Link href="/docs/llm-enhancement">LLM Enhancement</Link> — the contract
          skills follow when an LLM consumes graph evidence.
        </li>
      </ul>
    </div>
  );
}
