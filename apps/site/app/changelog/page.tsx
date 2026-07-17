import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { getRepoDoc } from "@/lib/repo-content";
import { SITE } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Every notable change to Ontoly, release by release — new capabilities, fixes, and API changes. Sourced directly from the repository CHANGELOG.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Ontoly Changelog",
    description: "Every notable change to Ontoly, release by release — straight from the repository.",
    url: `${SITE.url}/changelog`,
  },
};

function slugify(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
}

export default async function ChangelogPage() {
  const doc = await getRepoDoc("CHANGELOG.md");

  return (
    <>
      <Nav />
      <main>
        <section className="page-hero">
          <div className="wrap">
            <span className="eyebrow">Changelog</span>
            <h1>Every release, in the open.</h1>
            <p>New capabilities, fixes, and API changes for every Ontoly release. Generated from <a href={`${SITE.repo}/blob/main/CHANGELOG.md`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-2)" }}>CHANGELOG.md</a> in the repository.</p>
          </div>
        </section>

        <section className="band">
          <div className="wrap">
            {doc ? (
              <ol className="doc-timeline reveal">
                {doc.sections.map((s, i) => (
                  <li className={`doc-entry${i === 0 ? " current" : ""}`} key={s.title} id={slugify(s.title)}>
                    <span className="doc-dot" aria-hidden="true" />
                    <div className="doc-head">
                      <span className="doc-ver mono">{s.title}</span>
                      {i === 0 && <span className="badge shipped">Latest</span>}
                    </div>
                    <div className="prose" dangerouslySetInnerHTML={{ __html: s.bodyHtml }} />
                  </li>
                ))}
              </ol>
            ) : (
              <div className="figure reveal" style={{ textAlign: "center" }}>
                <p style={{ color: "var(--muted)" }}>Couldn&apos;t load repository content right now.</p>
                <a className="btn btn-primary" href={`${SITE.repo}/blob/main/CHANGELOG.md`} target="_blank" rel="noopener noreferrer" style={{ marginTop: 16 }}>Read the changelog on GitHub ↗</a>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
