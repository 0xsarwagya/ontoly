import Link from "next/link";
import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="ft">
      <div className="wrap">
        <div className="ft-grid">
          <div className="ft-col ft-about">
            <Link className="brand" href="/" aria-label="Ontoly">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Ontoly logo" width={24} height={24} style={{ borderRadius: 7 }} />
              Ontoly
            </Link>
            <p>A deterministic software intelligence platform. Understand any codebase — build the graph, query it, and change large systems with evidence.</p>
            <p style={{ marginTop: 10, fontSize: 13 }}>
              Part of the open-source ecosystem by{" "}
              <a href={SITE.authorUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-2)" }}>Sarwagya Singh</a>{" · "}
              <a href={SITE.oss} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-2)" }}>oss.sarwagya.wtf</a>
            </p>
          </div>
          <div className="ft-col">
            <h4>Product</h4>
            <Link href="/skills">Agent Skills</Link>
            <a href="#features">Features</a>
            <a href="#benchmarks">Benchmarks</a>
            <a href="#architecture">Architecture</a>
          </div>
          <div className="ft-col">
            <h4>Open source</h4>
            <a href={SITE.repo} target="_blank" rel="noopener noreferrer">GitHub</a>
            <Link href="/changelog">Changelog</Link>
            <a href={SITE.releases} target="_blank" rel="noopener noreferrer">Releases</a>
            <a href={SITE.npm} target="_blank" rel="noopener noreferrer">npm</a>
          </div>
          <div className="ft-col">
            <h4>Community</h4>
            <Link href="/roadmap">Roadmap</Link>
            <a href={SITE.skillsSh} target="_blank" rel="noopener noreferrer">skills.sh</a>
            <a href={SITE.sponsor} target="_blank" rel="noopener noreferrer">Sponsor</a>
            <a href={`${SITE.repo}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">License (MIT)</a>
          </div>
          <div className="ft-col">
            <h4>Install</h4>
            <a href={SITE.repo} target="_blank" rel="noopener noreferrer">CLI</a>
            <Link href="/skills">MCP</Link>
            <Link href="/skills">Agent Skills</Link>
            <a href={SITE.npm} target="_blank" rel="noopener noreferrer">Packages</a>
          </div>
        </div>
        <div className="ft-bottom">
          <span>© {new Date().getFullYear()} Ontoly · MIT License</span>
          <span className="mono">Created by {SITE.author} · v{SITE.version}</span>
        </div>
      </div>
    </footer>
  );
}
