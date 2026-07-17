export type DocItem = { title: string; href: string; soon?: boolean };
export type DocGroup = { title: string; items: DocItem[] };

function s(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Pages that are fully authored. Everything else renders as "in progress". */
const WRITTEN = new Set<string>([
  "getting-started/introduction",
  "getting-started/installation",
  "getting-started/quick-start",
  "getting-started/first-software-graph",
  "getting-started/cli-overview",
  "core-concepts/what-is-ontoly",
  "core-concepts/software-graph",
  "cli/build",
  "cli/search",
  "faq",
]);

function grp(title: string, section: string, titles: string[]): DocGroup {
  return {
    title,
    items: titles.map((t) => {
      const slug = section ? `${section}/${s(t)}` : s(t);
      return { title: t, href: `/docs/${slug}`, soon: !WRITTEN.has(slug) };
    }),
  };
}

export const DOCS_NAV: DocGroup[] = [
  grp("Getting Started", "getting-started", ["Introduction", "Installation", "Quick Start", "First Software Graph", "CLI Overview"]),
  grp("Core Concepts", "core-concepts", ["What is Ontoly?", "Software Graph", "Nodes", "Edges", "Semantic Index", "Repository Intelligence", "Evidence", "History", "Enhancers"]),
  grp("CLI", "cli", ["build", "search", "locate", "inspect", "trace", "impact", "history", "semantics", "evidence", "validate", "benchmark"]),
  grp("Packages", "packages", ["CLI", "Core", "Compiler", "Query", "Semantic", "History", "Repository Intelligence", "MCP", "Enhancers", "TypeScript", "Analyzers", "Plugins"]),
  grp("Features", "features", ["Semantic Search", "Request Tracing", "Impact Analysis", "Repository History", "Ownership", "Stability", "Hotspots", "Cochanges", "Evidence Packs", "Repository Intelligence"]),
  grp("Framework Support", "frameworks", ["TypeScript", "NestJS", "Express", "Next.js", "React"]),
  grp("MCP", "mcp", ["Installation", "Tools", "Prompts", "Agent Workflows", "Examples"]),
  grp("Architecture", "architecture", ["Compiler Pipeline", "Graph Generation", "Semantic Pipeline", "History Pipeline", "Repository Intelligence", "Artifact Generation"]),
  grp("RFCs", "rfcs", ["Software Graph Specification", "Semantic Index Specification", "History Specification", "Evidence Specification"]),
  grp("Benchmarks", "benchmarks", ["Methodology", "Validation Lab", "Graphify Comparison", "Multi-Repository Results", "Field Reports"]),
  grp("Examples", "examples", ["NestJS", "Express", "Next.js", "React", "Monorepos"]),
  grp("API Reference", "api", ["Compiler API", "Query API", "Semantic API", "History API", "MCP API"]),
  grp("Contributing", "contributing", ["Local Development", "Repository Structure", "Release Process", "Coding Standards"]),
  { title: "More", items: [
    { title: "Roadmap", href: "/roadmap" },
    { title: "Releases", href: "/changelog" },
    { title: "FAQ", href: "/docs/faq" },
  ] },
];

/** Flattened, in-order list of written doc pages for prev/next. */
export const DOCS_FLAT: DocItem[] = DOCS_NAV.flatMap((g) => g.items).filter((i) => i.href.startsWith("/docs/") && !i.soon);

export function docNeighbors(pathname: string): { prev?: DocItem; next?: DocItem } {
  const idx = DOCS_FLAT.findIndex((i) => i.href === pathname);
  if (idx === -1) return {};
  return { prev: DOCS_FLAT[idx - 1], next: DOCS_FLAT[idx + 1] };
}

export function docBreadcrumbs(pathname: string): { group?: string; title?: string } {
  for (const g of DOCS_NAV) {
    const item = g.items.find((i) => i.href === pathname);
    if (item) return { group: g.title, title: item.title };
  }
  return {};
}
