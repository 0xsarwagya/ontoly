#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");
const sourceRoot = path.join(root, "docs");
const outputRoot = path.join(root, "site", "docs");
const repositoryBlobUrl = "https://github.com/0xsarwagya/ontoly/blob/main";

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

console.log(`Generated ${files.length} OSS docs page(s) in site/docs.`);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function normalizeDocument(source, relativePath) {
  const { frontmatter, body } = splitFrontmatter(source);
  const normalizedBody = rewriteLinks(frontmatter ? body : removeFirstHeading(body), relativePath).trimEnd();
  const finalFrontmatter = frontmatter ?? createFrontmatter(source, relativePath);
  return `${finalFrontmatter.trimEnd()}\n\n${normalizedBody}\n`;
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

  return stripMarkdown(paragraph).replace(/\s+/g, " ").slice(0, 150);
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

function slash(value) {
  return value.split(path.sep).join("/");
}
