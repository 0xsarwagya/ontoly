import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { HeroGraph } from "@/components/hero-graph";
import { HeroTerminal } from "@/components/hero-terminal";
import { DemoTabs } from "@/components/demo-tabs";
import { CopyButton } from "@/components/copy-button";
import { GithubStats } from "@/components/github-stats";
import { Marquee } from "@/components/marquee";
import { SITE, SKILLS } from "@/lib/site";

const CLI = [
  { cmd: "ontoly build", desc: "compile the graph" },
  { cmd: "ontoly search", desc: "semantic lookup" },
  { cmd: "ontoly trace", desc: "request lifecycle" },
  { cmd: "ontoly impact", desc: "blast radius" },
  { cmd: "ontoly history", desc: "temporal intelligence" },
  { cmd: "ontoly semantics", desc: "derived model" },
  { cmd: "ontoly evidence", desc: "bounded pack" },
  { cmd: "ontoly mcp", desc: "agent transport" },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        {/* Hero */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="pill"><span className="dot" /> <b>v{SITE.version}</b> &nbsp;·&nbsp; <span className="tag">deterministic build</span></span>
              <h1 className="hero-title">Understand<br />Any <span className="grad">Codebase.</span></h1>
              <p className="hero-sub">{SITE.description.split(". ")[0]}. Not AI — deterministic, auditable, local-first, evidence-based.</p>
              <div className="hero-cta">
                <Link className="btn btn-primary" href="/docs">
                  Read the Docs
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
                <Link className="btn btn-ghost" href="/skills">Explore AI Skills</Link>
              </div>
              <div className="hero-meta">
                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg> Not AI — deterministic</span>
                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> Local-first</span>
                <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> Evidence-based</span>
              </div>
              <HeroTerminal />
            </div>
            <div className="hero-visual"><HeroGraph /></div>
          </div>
        </section>

        {/* Marquee */}
        <Marquee items={["TypeScript", "NestJS", "Express", "Next.js", "React", "OpenAPI", "MCP", "Agent Skills", "CALLS", "IMPORTS", "INJECTS", "MOUNTS", "DECORATES", "Semantic Index", "Repository Intelligence", "Evidence Packs", "Deterministic", "Local-first"]} />

        {/* Features */}
        <section className="band" id="features">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Capabilities</span>
              <h2 className="section-title" style={{ marginTop: 12 }}>One graph. Every question about your code.</h2>
              <p className="lead">Ontoly compiles your repository into a typed, provenance-tracked Software Graph — then answers architecture, impact, and lifecycle questions deterministically.</p>
            </div>
            <div className="fgrid reveal stagger">
              <Feature title="Deterministic Graph" icon="graph"><span className="flow"><b>Same repository.</b><span>Same graph.</span><span className="ar">Every time.</span></span></Feature>
              <Feature title="Semantic Search" icon="search"><span className="flow"><span>Natural language</span><span className="ar">↓</span><span>Real symbols</span><span className="ar">↓</span><b>Evidence</b></span></Feature>
              <Feature title="Request Tracing" icon="trace"><p>Trace request flow across controllers, services, jobs and queues.</p></Feature>
              <Feature title="Impact Analysis" icon="impact"><p>Understand what changes before changing it. Blast-radius on demand.</p></Feature>
              <Feature title="Repository Intelligence" icon="chart"><span className="flow"><span>Ownership · History</span><span>Hotspots · Stability</span><b>Cochanges</b></span></Feature>
              <Feature title="Evidence Packs" icon="doc"><span className="flow"><span>Every answer includes graph evidence.</span><b>No hallucinations.</b></span></Feature>
              <Feature title="Local First" icon="lock"><span className="flow"><span>Runs locally.</span><b>No source code leaves your machine.</b></span></Feature>
              <Feature title="Framework Awareness" icon="code"><p>Deep TypeScript. NestJS, Express, Next.js, React — more coming.</p></Feature>
            </div>
          </div>
        </section>

        {/* Skills teaser — heavy SEO for AI agent skills */}
        <section className="band" id="skills">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">AI Agent Skills</span>
              <h2 className="section-title" style={{ marginTop: 12 }}>14 portable Skills for Claude Code, Cursor &amp; Copilot.</h2>
              <p className="lead">Give your AI agent an evidence base. Ontoly ships portable Agent Skills and an MCP server — install once, and your agent answers architecture, impact, and tracing questions from a deterministic graph instead of guessing.</p>
            </div>
            <div className="skill-grid reveal stagger">
              {SKILLS.slice(0, 6).map((s) => (
                <Link className="skill-card" key={s.slug} href={`/skills#${s.slug}`}>
                  <span className="cat">{s.category}</span>
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                  <span className="slug mono">{s.slug}</span>
                </Link>
              ))}
            </div>
            <div className="hero-cta reveal" style={{ marginTop: 24 }}>
              <Link className="btn btn-primary" href="/skills">Browse all 14 Skills</Link>
              <a className="btn btn-ghost" href={SITE.skillsSh} target="_blank" rel="noopener noreferrer">Find on skills.sh ↗</a>
            </div>
          </div>
        </section>

        {/* Interactive demo */}
        <section className="band" id="demo">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Interactive</span>
              <h2 className="section-title" style={{ marginTop: 12 }}>See the graph answer.</h2>
              <p className="lead">Real command output. Every result carries node ids, edge types, confidence, and a graph hash you can reproduce.</p>
            </div>
            <div className="reveal"><DemoTabs /></div>
          </div>
        </section>

        {/* Benchmarks */}
        <section className="band" id="benchmarks">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Benchmarks</span>
              <h2 className="section-title" style={{ marginTop: 12 }}>Not grep. Not a generic graph.</h2>
              <p className="lead">Text search finds strings. Generic graph tools store untyped nodes. Ontoly resolves meaning — with provenance.</p>
            </div>
            <div className="cmp-wrap reveal">
              <div className="cmp-scroll">
                <table className="cmp">
                  <thead>
                    <tr><th>Capability</th><th className="c col-o">Ontoly</th><th className="c">Traditional grep</th><th className="c">Generic graph tools</th></tr>
                  </thead>
                  <tbody>
                    {[
                      ["Natural language queries", "yes", "no", "partial"],
                      ["Deterministic output", "yes", "yes", "no"],
                      ["Typed edges", "yes", "no", "partial"],
                      ["Semantic retrieval", "yes", "no", "no"],
                      ["Repository history", "yes", "no", "no"],
                      ["Evidence & provenance", "yes", "no", "partial"],
                      ["Repository intelligence", "yes", "no", "no"],
                    ].map(([feat, o, g, gr]) => (
                      <tr key={feat}>
                        <td className="feat">{feat}</td>
                        <td className={`c col-o ${o}`}>{cell(o)}</td>
                        <td className={`c ${g}`}>{cell(g)}</td>
                        <td className={`c ${gr}`}>{cell(gr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="band" id="architecture">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Architecture</span>
              <h2 className="section-title" style={{ marginTop: 12 }}>A deterministic pipeline, end to end.</h2>
              <p className="lead">Every stage consumes the immutable contract of the one before it. No stage guesses; each adds provenance.</p>
            </div>
            <div className="pipe reveal stagger">
              {[
                ["01", "Source", "Repository", "Discovery over your files, workspace-aware."],
                ["02", "Frontend", "Compiler", "TypeScript & OpenAPI frontends emit symbols."],
                ["03", "Core", "Software Graph", "Typed nodes & edges with stable ids.", true],
                ["04", "Retrieval", "Semantic Index", "Natural-language → real symbols."],
                ["05", "Temporal", "History", "Ownership, churn, hotspots from Git."],
                ["06", "Insight", "Repository Intelligence", "Stability, cochanges, drift."],
                ["07", "Output", "Evidence", "Bounded packs with graph provenance.", true],
                ["08", "Consumer", "Developer / AI Agent", "CLI, MCP, and Agent Skills."],
              ].map(([idx, st, tt, ds, accent]) => (
                <div className={`pnode${accent ? " accent" : ""}`} key={idx as string}>
                  <span className="idx mono">{idx}</span>
                  <span className="st">{st}</span>
                  <span className="tt">{tt}</span>
                  <span className="ds">{ds}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CLI */}
        <section className="band">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Command line</span>
              <h2 className="section-title" style={{ marginTop: 12 }}>Eight commands. The whole graph.</h2>
            </div>
            <div className="cli-grid reveal stagger">
              {CLI.map((c) => (
                <div className="cli-row" key={c.cmd}>
                  <code><span className="cx">ontoly</span>{c.cmd.replace("ontoly", "")}</code>
                  <span className="desc">{c.desc}</span>
                  <CopyButton text={c.cmd} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="band">
          <div className="wrap">
            <div className="sec-head reveal">
              <span className="eyebrow">Roadmap</span>
              <h2 className="section-title" style={{ marginTop: 12 }}>Shipping in the open.</h2>
            </div>
            <div className="road reveal stagger">
              <div className="rcard">
                <div className="rv"><span className="v">v1.0</span><span className="badge shipped">Shipped</span></div>
                <ul className="rlist">
                  {["Repository Intelligence", "Repository History", "Evidence Packs", "In-memory processing"].map((x) => (
                    <li key={x}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>{x}</li>
                  ))}
                </ul>
              </div>
              <div className="rcard">
                <div className="rv"><span className="v">v1.1</span><span className="badge planned">Planned</span></div>
                <ul className="rlist">
                  {["More languages", "VS Code extension", "GitHub integration", "Temporal Intelligence"].map((x) => (
                    <li key={x}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="hero-cta reveal" style={{ marginTop: 24 }}>
              <Link className="btn btn-primary" href="/roadmap">Full roadmap</Link>
              <Link className="btn btn-ghost" href="/changelog">Changelog</Link>
            </div>
          </div>
        </section>

        {/* GitHub stats (server-fetched) */}
        <GithubStats />

        {/* CTA */}
        <section className="band">
          <div className="wrap">
            <div className="cta-strip reveal">
              <span className="eyebrow">Get started</span>
              <h2 style={{ marginTop: 14 }}>Give your agents an evidence base.</h2>
              <p>Build the graph in seconds. Query it deterministically. Ship changes to large codebases with confidence — no source leaves your machine.</p>
              <div className="hero-cta">
                <a className="btn btn-primary" href={SITE.repo} target="_blank" rel="noopener noreferrer">Get Started</a>
                <Link className="btn btn-ghost" href="/skills">Explore AI Skills</Link>
              </div>
              <p className="mono" style={{ marginTop: 18, fontSize: 13, color: "var(--faint)" }}>pnpm add -D @0xsarwagya/ontoly-cli@rc</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function cell(v: string) {
  return v === "yes" ? "✓" : v === "no" ? "✗" : "partial";
}

const ICONS: Record<string, React.ReactNode> = {
  graph: <path d="M12 2 2 7l10 5 10-5-10-5Z M2 17l10 5 10-5M2 12l10 5 10-5" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  trace: <><path d="M6 3v12" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="6" r="3" /><path d="M18 9c0 6-12 3-12 9" /></>,
  impact: <><path d="M12 22a10 10 0 1 0-10-10" /><path d="M12 12 2 12" /><path d="M12 12l7 7" /></>,
  chart: <><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M9 15l2 2 4-4" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  code: <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" />,
};

function Feature({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="fcell">
      <span className="ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{ICONS[icon]}</svg></span>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
