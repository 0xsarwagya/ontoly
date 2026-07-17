import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import { DocsSidebar } from "@/components/docs/sidebar";
import { DocsToc } from "@/components/docs/toc";
import { DocsBreadcrumbs, DocsPrevNext } from "@/components/docs/chrome";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: "Documentation", template: "%s · Ontoly Docs" },
  description: "Production documentation for Ontoly — the deterministic Software Graph. Getting started, core concepts, CLI reference, MCP, architecture, and API.",
  alternates: { canonical: "/docs" },
  openGraph: { title: "Ontoly Documentation", description: "The deterministic Software Graph — docs, CLI reference, and API.", url: `${SITE.url}/docs` },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <div className="docs-shell">
        <DocsSidebar />
        <main className="docs-main">
          <article className="doc-article" data-docs-content>
            <DocsBreadcrumbs />
            {children}
            <DocsPrevNext />
          </article>
        </main>
        <DocsToc />
      </div>
    </>
  );
}
