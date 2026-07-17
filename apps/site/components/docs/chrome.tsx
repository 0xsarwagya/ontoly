"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { docBreadcrumbs, docNeighbors } from "@/lib/docs-nav";

export function DocsBreadcrumbs() {
  const pathname = usePathname();
  const { group, title } = docBreadcrumbs(pathname);
  return (
    <nav className="docs-crumbs" aria-label="Breadcrumb">
      <Link href="/docs/getting-started/introduction">Docs</Link>
      {group && <><span className="sep">/</span><span>{group}</span></>}
      {title && <><span className="sep">/</span><span className="current">{title}</span></>}
    </nav>
  );
}

export function DocsPrevNext() {
  const pathname = usePathname();
  const { prev, next } = docNeighbors(pathname);
  if (!prev && !next) return null;
  return (
    <nav className="docs-prevnext" aria-label="Pagination">
      {prev ? (
        <Link className="pn pn-prev" href={prev.href}>
          <span className="pn-dir">← Previous</span>
          <span className="pn-title">{prev.title}</span>
        </Link>
      ) : <span />}
      {next ? (
        <Link className="pn pn-next" href={next.href}>
          <span className="pn-dir">Next →</span>
          <span className="pn-title">{next.title}</span>
        </Link>
      ) : <span />}
    </nav>
  );
}

export function VersionSelector() {
  return (
    <div className="version-select" title="Documentation version">
      <span className="mono">v1.0</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}
