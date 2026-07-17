export const SITE = {
  name: "Ontoly",
  url: "https://ontoly.sarwagya.wtf",
  tagline: "Understand Any Codebase.",
  description:
    "Ontoly builds a deterministic Software Graph of your repository so developers and AI agents can search, trace, understand and safely change large codebases. Not AI — deterministic, auditable, local-first, evidence-based.",
  shortDescription:
    "Deterministic Software Graphs for developers and AI agents. Search, trace, and safely change large codebases with evidence.",
  author: "Sarwagya Singh",
  authorUrl: "https://sarwagya.wtf",
  oss: "https://oss.sarwagya.wtf",
  ossProject: "https://oss.sarwagya.wtf/ontoly",
  repo: "https://github.com/0xsarwagya/ontoly",
  npm: "https://www.npmjs.com/package/@0xsarwagya/ontoly-cli",
  skillsSh: "https://www.skills.sh/?q=0xsarwagya/ontoly",
  releases: "https://github.com/0xsarwagya/ontoly/releases",
  sponsor: "https://github.com/sponsors/0xsarwagya",
  version: "1.0.0-rc.5",
  keywords: [
    "Ontoly",
    "Software Graph",
    "AI agent skills",
    "Claude Code skills",
    "Cursor skills",
    "MCP server",
    "Model Context Protocol",
    "TypeScript static analysis",
    "deterministic code analysis",
    "code intelligence",
    "codebase understanding",
    "impact analysis",
    "request tracing",
    "semantic code search",
    "repository intelligence",
    "AI coding agents",
    "developer tools",
    "architecture analysis",
    "dependency graph",
    "call graph",
  ],
} as const;

export const EDGE_TYPES = [
  { name: "CALLS", varName: "--e-calls" },
  { name: "IMPORTS", varName: "--e-imports" },
  { name: "INJECTS", varName: "--e-injects" },
  { name: "MOUNTS", varName: "--e-mounts" },
  { name: "DECORATES", varName: "--e-decorates" },
] as const;

export type Skill = {
  slug: string;
  name: string;
  category: string;
  description: string;
  capabilities: string[];
};

/** The 14 portable Ontoly Agent Skills — installable into Claude Code, Cursor, Copilot and more. */
export const SKILLS: Skill[] = [
  { slug: "architecture-review", name: "Architecture Review", category: "Architecture",
    description: "Explain module boundaries, package topology, service ownership, and architectural risk from graph evidence.",
    capabilities: ["ExplainArchitecture", "GraphStatistics", "FindCycles", "EvidencePack"] },
  { slug: "impact-analysis", name: "Impact Analysis", category: "Change safety",
    description: "Compute blast radius and change impact before you edit a symbol — deterministic, bounded, and cited.",
    capabilities: ["ImpactAnalysis", "FindDependents", "FindDependencies", "FindNode"] },
  { slug: "request-tracing", name: "Request Tracing", category: "Runtime",
    description: "Trace request lifecycles across controllers, services, jobs, and queues, hop by hop.",
    capabilities: ["TraceRequestLifecycle", "FindNode", "InspectModule", "EvidencePack"] },
  { slug: "dependency-analysis", name: "Dependency Analysis", category: "Structure",
    description: "Map dependencies, dependents, and cycles across the typed Software Graph.",
    capabilities: ["FindDependencies", "FindDependents", "FindCycles", "GraphStatistics"] },
  { slug: "dead-code-analysis", name: "Dead Code Analysis", category: "Cleanup",
    description: "Find unused exports, unreachable code, and orphaned features with entrypoint reachability.",
    capabilities: ["FindDeadCode", "FindUnusedFeature", "FindEntrypoints", "FindDependents"] },
  { slug: "refactoring", name: "Refactoring", category: "Change safety",
    description: "Plan safe refactors backed by dependents, call graph, and evidence packs.",
    capabilities: ["ImpactAnalysis", "FindDependents", "InspectModule", "EvidencePack"] },
  { slug: "migration-analysis", name: "Migration Analysis", category: "Change safety",
    description: "Scope framework and API migrations with typed evidence and touchpoints.",
    capabilities: ["FeatureTouchpoints", "FindDependencies", "ExplainArchitecture"] },
  { slug: "performance-analysis", name: "Performance Analysis", category: "Runtime",
    description: "Locate hot call chains and performance-sensitive paths in the graph.",
    capabilities: ["TraceRequestLifecycle", "FindDependencies", "GraphStatistics"] },
  { slug: "security-review", name: "Security Review", category: "Runtime",
    description: "Surface security-relevant flows, boundaries, and configuration usage.",
    capabilities: ["TraceRequestLifecycle", "FindConfigurationUsage", "EvidencePack"] },
  { slug: "configuration-analysis", name: "Configuration Analysis", category: "Structure",
    description: "Audit configuration and where it is consumed across the repository.",
    capabilities: ["FindConfiguration", "FindConfigurationUsage", "FindDependencies"] },
  { slug: "framework-analysis", name: "Framework Analysis", category: "Architecture",
    description: "Understand framework topology — NestJS, Express, Next.js, React — from detected facts.",
    capabilities: ["ExplainArchitecture", "GraphStatistics", "FindNode", "FindFeatureOwner"] },
  { slug: "codebase-onboarding", name: "Codebase Onboarding", category: "Understanding",
    description: "Onboard to an unfamiliar codebase fast: entrypoints, owners, and the shape of the system.",
    capabilities: ["ExplainArchitecture", "FindEntrypoints", "FindFeatureOwner", "EvidencePack"] },
  { slug: "documentation", name: "Documentation", category: "Understanding",
    description: "Generate documentation grounded in the graph, with request lifecycles and module maps.",
    capabilities: ["ExplainArchitecture", "TraceRequestLifecycle", "InspectModule"] },
  { slug: "sdk-generation", name: "SDK Generation", category: "Output",
    description: "Generate SDKs and clients from typed graph facts and detected routes.",
    capabilities: ["FindNode", "InspectModule", "GraphStatistics", "EvidencePack"] },
];

export const NAV = [
  { label: "Docs", href: "/docs" },
  { label: "Skills", href: "/skills" },
  { label: "Benchmarks", href: "/#benchmarks" },
  { label: "Roadmap", href: "/roadmap" },
  { label: "Changelog", href: "/changelog" },
];

export const NPM_PACKAGES = [
  "@0xsarwagya/ontoly-core", "@0xsarwagya/ontoly-cache", "@0xsarwagya/ontoly-diagnostics",
  "@0xsarwagya/ontoly-query", "@0xsarwagya/ontoly-typescript", "@0xsarwagya/ontoly-analyzers",
  "@0xsarwagya/ontoly-enhancer", "@0xsarwagya/ontoly-enhancer-history", "@0xsarwagya/ontoly-enhancer-semantics",
  "@0xsarwagya/ontoly-intelligence", "@0xsarwagya/ontoly-capabilities", "@0xsarwagya/ontoly-compiler",
  "@0xsarwagya/ontoly-mcp", "@0xsarwagya/ontoly-parser-openapi", "@0xsarwagya/ontoly-semantic",
  "@0xsarwagya/ontoly-parser-typescript", "@0xsarwagya/ontoly-plugin-mermaid", "@0xsarwagya/ontoly-plugin-html",
  "@0xsarwagya/ontoly-cli",
];
