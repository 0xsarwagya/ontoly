import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { CopyButton } from "@/components/copy-button";
import { SITE, SKILLS } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Agent Skills for Code — Claude Code, Cursor & Copilot",
  description:
    "14 portable Ontoly Agent Skills plus an MCP server give AI coding agents a deterministic Software Graph to query — architecture review, impact analysis, request tracing, dependency analysis and more. Install into Claude Code, Cursor, or GitHub Copilot.",
  keywords: [
    "AI agent skills", "Claude Code skills", "Cursor skills", "GitHub Copilot skills",
    "MCP server code analysis", "agent skills for code", "skills.sh", "Ontoly skills",
    "architecture review skill", "impact analysis skill", "request tracing skill",
  ],
  alternates: { canonical: "/skills" },
  openGraph: {
    title: "Ontoly AI Agent Skills — for Claude Code, Cursor & Copilot",
    description: "14 portable Agent Skills + MCP that give AI agents a deterministic Software Graph to query.",
    url: `${SITE.url}/skills`,
    images: [{ url: "/assets/agent-skills-diagram.svg", width: 1200, height: 630, alt: "Ontoly Agent Skills" }],
  },
};

function skillsJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Ontoly AI Agent Skills",
    description: "Portable Agent Skills that give AI coding agents a deterministic Software Graph to query.",
    numberOfItems: SKILLS.length,
    itemListElement: SKILLS.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "SoftwareApplication",
        name: `Ontoly ${s.name} Skill`,
        applicationCategory: "DeveloperApplication",
        description: s.description,
        url: `${SITE.url}/skills#${s.slug}`,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default function SkillsPage() {
  const install = "npx skills add 0xsarwagya/ontoly --skill architecture-review";
  return (
    <>
      {skillsJsonLd()}
      <Nav />
      <main>
        <section className="page-hero">
          <div className="wrap">
            <span className="eyebrow">AI Agent Skills · MCP</span>
            <h1>AI Skills that actually know your codebase.</h1>
            <p>
              Ontoly ships <strong>14 portable Agent Skills</strong> and an <strong>MCP server</strong> that give AI coding
              agents — <strong>Claude Code, Cursor, GitHub Copilot</strong> and more — a deterministic Software Graph to
              query. Every answer carries graph evidence: node ids, typed edges, source spans, and a reproducible hash.
              No hallucinations, no source leaving your machine.
            </p>
            <div className="badge-row">
              <span className="b"><b>14</b> Agent Skills</span>
              <span className="b"><b>MCP</b> server</span>
              <span className="b"><b>Local-first</b> · deterministic</span>
            </div>
            <div className="hero-cta" style={{ marginTop: 24 }}>
              <a className="btn btn-primary" href={SITE.skillsSh} target="_blank" rel="noopener noreferrer">Find Ontoly on skills.sh ↗</a>
              <a className="btn btn-ghost" href={SITE.repo} target="_blank" rel="noopener noreferrer">View on GitHub</a>
            </div>
          </div>
        </section>

        {/* Install */}
        <section className="band">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Install</span>
              <h2 className="section-title" style={{ marginTop: 12 }}>One command per agent.</h2>
              <p className="lead">Skills are discovered and installed via <a href={SITE.skillsSh} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-2)" }}>skills.sh</a> — the multi-agent skills marketplace for Claude Code, Cursor, and Copilot.</p>
            </div>
            <div className="cli-grid reveal">
              <div className="cli-row"><code><span className="cx">npx</span> skills add 0xsarwagya/ontoly</code><span className="desc">all skills</span><CopyButton text="npx skills add 0xsarwagya/ontoly" /></div>
              <div className="cli-row"><code><span className="cx">npx</span> skills add 0xsarwagya/ontoly --skill impact-analysis</code><span className="desc">one skill</span><CopyButton text="npx skills add 0xsarwagya/ontoly --skill impact-analysis" /></div>
              <div className="cli-row"><code><span className="cx">pnpm</span> add -D @0xsarwagya/ontoly-cli@rc</code><span className="desc">the CLI</span><CopyButton text="pnpm add -D @0xsarwagya/ontoly-cli@rc" /></div>
              <div className="cli-row"><code><span className="cx">ontoly</span> mcp</code><span className="desc">start MCP server</span><CopyButton text="ontoly mcp" /></div>
            </div>
          </div>
        </section>

        {/* All skills */}
        <section className="band" id="all-skills">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Catalog</span>
              <h2 className="section-title" style={{ marginTop: 12 }}>All 14 Agent Skills.</h2>
              <p className="lead">Each skill is graph-first: it orchestrates Ontoly capabilities and preserves evidence, confidence, and fallback rules.</p>
            </div>
            <div className="skill-grid reveal">
              {SKILLS.map((s) => (
                <div className="skill-card" key={s.slug} id={s.slug}>
                  <span className="cat">{s.category}</span>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <div className="caps">
                    {s.capabilities.map((c) => (<span className="cap" key={c}>{c}</span>))}
                  </div>
                  <span className="slug mono">{s.slug}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* MCP */}
        <section className="band">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Model Context Protocol</span>
              <h2 className="section-title" style={{ marginTop: 12 }}>Or connect over MCP.</h2>
              <p className="lead">Run <span className="mono" style={{ color: "var(--text-strong)" }}>ontoly mcp</span> and expose every capability to your agent as MCP tools — architecture, impact, tracing, evidence, and repository intelligence — all backed by the same deterministic graph.</p>
            </div>
            <div className="figure reveal">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/agent-skills-diagram.svg" alt="Ontoly Agent Skills and MCP architecture diagram" />
            </div>
            <div className="hero-cta reveal" style={{ marginTop: 24 }}>
              <a className="btn btn-primary" href={SITE.skillsSh} target="_blank" rel="noopener noreferrer">Find on skills.sh ↗</a>
              <Link className="btn btn-ghost" href="/">Back to overview</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
