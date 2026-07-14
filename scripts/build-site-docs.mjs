#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");
const sourceRoot = path.join(root, "docs");
const outputRoot = path.join(root, "site", "docs");
const skillsCatalogPath = path.join(root, "skills", "website-assets", "skill-catalog.json");
const repositoryBlobUrl = "https://github.com/0xsarwagya/ontoly/blob/main";
const siteBaseUrl = "https://oss.sarwagya.wtf";
const projectSlug = "ontoly";
const docsBasePath = `/${projectSlug}/docs`;
const commonKeywords = [
  "Ontoly",
  "Software Graph",
  "TypeScript",
  "static analysis",
  "MCP",
  "AI coding agents",
  "developer tools",
];

if (!existsSync(sourceRoot)) {
  throw new Error(`Missing docs source directory: ${sourceRoot}`);
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const files = walk(sourceRoot)
  .filter((file) => /\.(md|mdx)$/i.test(file))
  .sort((left, right) => left.localeCompare(right));

for (const file of files) {
  const relative = slash(path.relative(sourceRoot, file));
  const outputRelative = relative.replace(/\.(md|mdx)$/i, ".mdx");
  const outputPath = path.join(outputRoot, outputRelative);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, normalizeDocument(readFileSync(file, "utf8"), relative), "utf8");
}

const skillDocs = writeSkillDocs();

console.log(`Generated ${files.length + skillDocs} OSS docs page(s) in site/docs.`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function normalizeDocument(source, relativePath) {
  const { frontmatter, body } = splitFrontmatter(source);
  const normalizedBody = rewriteLinks(frontmatter ? body : removeFirstHeading(body), relativePath).trim();
  const finalFrontmatter = addSeoFrontmatter(frontmatter ?? createFrontmatter(source, relativePath), relativePath);
  return `${finalFrontmatter.trimEnd()}\n\n${normalizedBody}\n`;
}

function writeSkillDocs() {
  if (!existsSync(skillsCatalogPath)) {
    return 0;
  }

  const catalog = JSON.parse(readFileSync(skillsCatalogPath, "utf8"));
  const skills = Array.isArray(catalog.skills) ? catalog.skills : [];
  const directory = path.join(outputRoot, "skills");
  mkdirSync(directory, { recursive: true });

  writeFileSync(path.join(directory, "index.mdx"), skillIndexDocument(skills), "utf8");

  for (const skill of skills) {
    writeFileSync(path.join(directory, `${skill.id}.mdx`), skillDocument(skill), "utf8");
  }

  return skills.length + 1;
}

function skillIndexDocument(skills) {
  const rows = skills
    .map((skill) =>
      `| [${skill.title}](./${skill.id}) | ${skill.category} | ${skill.enhancement ?? "LLM Enhancement"} | ${skill.version} | ${skill.capabilities.map((capability) => `\`${capability}\``).join(", ")} |`,
    )
    .join("\n");

  return [
    "---",
    'title: "Agent Skills Catalog"',
    'description: "Installable Ontoly Agent Skills with capability mappings and documentation links."',
    `canonical: "${siteBaseUrl}${docsBasePath}/skills"`,
    'source: "skills/website-assets/skill-catalog.json"',
    `keywords: [${["Ontoly", "Agent Skills", "MCP", "Software Graph", "AI coding agents"].map((value) => `"${escapeYaml(value)}"`).join(", ")}]`,
    "---",
    "",
    "Official Ontoly Agent Skills are independently installable `SKILL.md` folders.",
    "Each skill teaches workflow only; Ontoly provides software understanding through the Software Graph, Query Engine, and MCP capabilities.",
    "",
    "## Skills",
    "",
    "| Skill | Category | Enhancement | Version | Capabilities |",
    "| --- | --- | --- | --- | --- |",
    rows,
    "",
    "## Shared Docs",
    "",
    "- [Agent Skills](../agent-skills)",
    "- [MCP](../mcp)",
    "- [Capabilities](../capabilities)",
    "- [Skills Development](../skills-development)",
    "- [Skills Validation](../skills-validation)",
    "",
  ].join("\n");
}

function skillDocument(skill) {
  const capabilities = skill.capabilities.map((capability) => `- \`${capability}\``).join("\n");
  const sourceBase = `${repositoryBlobUrl}/skills/${skill.id}`;

  return [
    "---",
    `title: "${escapeYaml(skill.title)} Skill"`,
    `description: "${escapeYaml(skill.description)}"`,
    `canonical: "${siteBaseUrl}${docsBasePath}/skills/${skill.id}"`,
    `source: "skills/${skill.id}/README.md"`,
    `keywords: [${keywordsFor(`skills/${skill.id}.mdx`, `${skill.title} Skill`).map((value) => `"${escapeYaml(value)}"`).join(", ")}]`,
    "---",
    "",
    skill.description,
    "",
    "## Install",
    "",
    "```bash",
    `npx skills add 0xsarwagya/ontoly --skill ${skill.id}`,
    "```",
    "",
    "## Compatibility",
    "",
    `- Skill version: \`${skill.version}\``,
    `- Minimum Ontoly version: \`${skill.minimumOntolyVersion}\``,
    `- Category: \`${skill.category}\``,
    `- Enhancement: \`${skill.enhancement ?? "LLM Enhancement"}\``,
    `- Deprecated: ${skill.deprecated ? "yes" : "no"}`,
    "",
    "## Capabilities",
    "",
    capabilities,
    "",
    "## Source",
    "",
    `- [README](${sourceBase}/README.md)`,
    `- [SKILL.md](${sourceBase}/SKILL.md)`,
    `- [Examples](${sourceBase}/examples.md)`,
    `- [Templates](${sourceBase}/templates)`,
    `- [Reference](${sourceBase}/reference)`,
    "",
    "## Related Docs",
    "",
    "- [Agent Skills](../agent-skills)",
    "- [Skills Overview](../skills-overview)",
    "- [MCP](../mcp)",
    "- [Capabilities](../capabilities)",
    "- [Skills Validation](../skills-validation)",
    "",
  ].join("\n");
}

function splitFrontmatter(source) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(source);
  if (!match) {
    return { frontmatter: null, body: source };
  }

  return {
    frontmatter: match[0].trimEnd(),
    body: source.slice(match[0].length),
  };
}

function createFrontmatter(source, relativePath) {
  const body = removeFirstHeading(source);
  const title = firstHeading(source) ?? titleFromPath(relativePath);
  const description = firstParagraph(body) ?? "Ontoly documentation.";

  return [
    "---",
    `title: "${escapeYaml(title)}"`,
    `description: "${escapeYaml(description)}"`,
    "---",
  ].join("\n");
}

function addSeoFrontmatter(frontmatter, relativePath) {
  const canonical = `${siteBaseUrl}${docRoutePath(relativePath)}`;
  const title = frontmatterValue(frontmatter, "title") ?? titleFromPath(relativePath);
  const additions = [
    ["canonical", canonical],
    ["source", `docs/${relativePath}`],
    ["keywords", keywordsFor(relativePath, title)],
  ].filter(([field]) => !hasFrontmatterField(frontmatter, field));

  if (additions.length === 0) {
    return frontmatter;
  }

  return frontmatter.replace(
    /\n---\s*$/,
    `\n${additions.map(([field, value]) => formatYamlField(field, value)).join("\n")}\n---`,
  );
}

function docRoutePath(relativePath) {
  const route = slash(relativePath).replace(/\.(md|mdx)$/i, "").replace(/\/index$/, "");
  return route === "index" ? docsBasePath : `${docsBasePath}/${route}`;
}

function keywordsFor(relativePath, title) {
  const pageTerms = `${title} ${relativePath}`
    .split(/[^A-Za-z0-9]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 2)
    .filter((part) => !/^(docs?|mdx?|the|and|for|with)$/i.test(part));
  return unique([...commonKeywords, ...pageTerms]).slice(0, 14);
}

function frontmatterValue(frontmatter, field) {
  const match = new RegExp(`^${escapeRegExp(field)}:\\s*["']?([^"'\n]+)["']?\\s*$`, "m").exec(frontmatter);
  return match?.[1]?.trim() ?? null;
}

function hasFrontmatterField(frontmatter, field) {
  return new RegExp(`^${escapeRegExp(field)}:`, "m").test(frontmatter);
}

function formatYamlField(field, value) {
  if (Array.isArray(value)) {
    return `${field}: [${value.map((item) => `"${escapeYaml(item)}"`).join(", ")}]`;
  }
  return `${field}: "${escapeYaml(value)}"`;
}

function firstHeading(source) {
  return source.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function removeFirstHeading(source) {
  return source.replace(/^#\s+.+\n+/, "");
}

function firstParagraph(source) {
  const paragraph = source
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find((part) => part && !part.startsWith("#") && !part.startsWith("```") && !part.startsWith("|"));

  if (!paragraph) {
    return null;
  }

  return summarizeDescription(stripMarkdown(paragraph).replace(/\s+/g, " "));
}

function summarizeDescription(value) {
  const sentence = value.match(/^.{20,180}?[.!?](?:\s|$)/)?.[0]?.trim();
  if (sentence) {
    return sentence;
  }

  if (value.length <= 150) {
    return value;
  }

  const truncated = value.slice(0, 150);
  return truncated.replace(/\s+\S*$/, "").trim();
}

function titleFromPath(relativePath) {
  const basename = path.basename(relativePath, path.extname(relativePath));
  return basename
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stripMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_#>]/g, "")
    .trim();
}

function rewriteLinks(source, relativePath) {
  return source.replace(/(!?\[[^\]]*]\()([^)\s]+)(\))/g, (match, prefix, target, suffix) => {
    return `${prefix}${rewriteLinkTarget(target, relativePath)}${suffix}`;
  });
}

function rewriteLinkTarget(target, relativePath) {
  if (shouldKeepTarget(target)) {
    return stripMarkdownExtension(target);
  }

  const [targetPath, hash] = splitHash(target);
  if (targetPath.startsWith("/")) {
    return `${stripMarkdownExtension(targetPath)}${hash}`;
  }

  const sourceDirectory = path.dirname(relativePath);
  const resolved = resolveExistingTarget(path.resolve(sourceRoot, sourceDirectory, targetPath));
  if (!resolved) {
    return target;
  }

  if (isInside(resolved, sourceRoot)) {
    const currentOutputDirectory = path.dirname(relativePath.replace(/\.(md|mdx)$/i, ".mdx"));
    const targetOutput = slash(path.relative(sourceRoot, resolved)).replace(/\.(md|mdx)$/i, "");
    let nextTarget = slash(path.relative(currentOutputDirectory, targetOutput));
    if (!nextTarget.startsWith(".")) {
      nextTarget = `./${nextTarget}`;
    }
    return `${nextTarget}${hash}`;
  }

  if (isInside(resolved, root)) {
    return `${repositoryBlobUrl}/${slash(path.relative(root, resolved))}${hash}`;
  }

  return target;
}

function shouldKeepTarget(target) {
  return /^(https?:|mailto:|tel:|data:|#)/.test(target);
}

function stripMarkdownExtension(target) {
  const [targetPath, hash] = splitHash(target);
  return `${targetPath.replace(/\.(md|mdx)$/i, "")}${hash}`;
}

function splitHash(target) {
  const index = target.indexOf("#");
  if (index === -1) {
    return [target, ""];
  }
  return [target.slice(0, index), target.slice(index)];
}

function resolveExistingTarget(candidate) {
  const candidates = [
    candidate,
    `${candidate}.md`,
    `${candidate}.mdx`,
    path.join(candidate, "index.md"),
    path.join(candidate, "index.mdx"),
  ];
  return candidates.find((item) => existsSync(item)) ?? null;
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function escapeYaml(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function slash(value) {
  return value.split(path.sep).join("/");
}
