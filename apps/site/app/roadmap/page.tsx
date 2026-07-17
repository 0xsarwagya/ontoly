import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { getRepoDoc } from "@/lib/repo-content";
import { SITE } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "The Ontoly roadmap — from TypeScript repository discovery and the deterministic Software Graph to a stable spec, plugin API, and community registry. Sourced from the repository.",
  alternates: { canonical: "/roadmap" },
  openGraph: {
    title: "Ontoly Roadmap",
    description: "What Ontoly has shipped and what's next — straight from the repository.",
    url: `${SITE.url}/roadmap`,
  },
};

const CURRENT_MAJOR = "v1.0";

export default async function RoadmapPage() {
  const doc = await getRepoDoc("ROADMAP.md");

  return (
    <>
      <Nav />
      <main>
        <section className="page-hero">
          <div className="wrap">
            <span className="eyebrow">Roadmap</span>
            <h1>Shipping in the open.</h1>
            <p>Ontoly&apos;s milestones, from the first deterministic Software Graph to a stable specification, plugin API, and community registry. This page is generated from <a href={`${SITE.repo}/blob/main/ROADMAP.md`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-2)" }}>ROADMAP.md</a> in the repository.</p>
          </div>
        </section>

        <section className="band">
          <div className="wrap">
            {doc ? (
              <ol className="doc-timeline reveal">
                {doc.sections.map((s) => {
                  const current = s.title.toLowerCase().startsWith(CURRENT_MAJOR);
                  return (
                    <li className={`doc-entry${current ? " current" : ""}`} key={s.title}>
                      <span className="doc-dot" aria-hidden="true" />
                      <div className="doc-head">
                        <span className="doc-ver mono">{s.title}</span>
                        {current && <span className="badge planned">Current</span>}
                      </div>
                      <div className="prose" dangerouslySetInnerHTML={{ __html: s.bodyHtml }} />
                    </li>
                  );
                })}
              </ol>
            ) : (
              <Fallback href={`${SITE.repo}/blob/main/ROADMAP.md`} label="Read the roadmap on GitHub" />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Fallback({ href, label }: { href: string; label: string }) {
  return (
    <div className="figure reveal" style={{ textAlign: "center" }}>
      <p style={{ color: "var(--muted)" }}>Couldn&apos;t load repository content right now.</p>
      <a className="btn btn-primary" href={href} target="_blank" rel="noopener noreferrer" style={{ marginTop: 16 }}>{label} ↗</a>
    </div>
  );
}
