#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const includeExtensions = new Set([".md", ".mdx"]);
const excludedDirs = new Set([".git", "node_modules", "dist", ".ontoly", ".agents", "apps", ".next"]);
const issues = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludedDirs.has(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (includeExtensions.has(path.extname(entry.name))) {
      validateFile(fullPath);
    }
  }
}

function validateFile(file) {
  const content = fs.readFileSync(file, "utf8");
  const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\\s+\"[^\"]*\")?\)/g;
  let match;
  while ((match = linkPattern.exec(content))) {
    const rawTarget = match[1];
    if (shouldSkip(rawTarget)) {
      continue;
    }
    const [targetWithoutHash] = rawTarget.split("#");
    if (!targetWithoutHash) {
      continue;
    }
    const decoded = decodeURIComponent(targetWithoutHash);
    const resolved = resolveTarget(file, decoded);
    if (!resolved.startsWith(root)) {
      issues.push(`${relative(file)} links outside repository: ${rawTarget}`);
      continue;
    }
    if (!targetExists(resolved)) {
      issues.push(`${relative(file)} has broken link: ${rawTarget}`);
    }
  }
}

function resolveTarget(file, target) {
  if (target.startsWith("/ontoly/docs/")) {
    return path.join(root, "docs", target.slice("/ontoly/docs/".length));
  }
  if (target.startsWith("/")) {
    return path.join(root, target.slice(1));
  }
  return path.resolve(path.dirname(file), target);
}

function targetExists(resolved) {
  if (fs.existsSync(resolved)) {
    return true;
  }
  if (resolved.startsWith(path.join(root, "docs"))) {
    const generated = path.join(root, "site", "docs", path.relative(path.join(root, "docs"), resolved));
    if (targetExists(generated)) {
      return true;
    }
  }
  if (path.extname(resolved)) {
    return false;
  }
  return [
    `${resolved}.md`,
    `${resolved}.mdx`,
    path.join(resolved, "README.md"),
    path.join(resolved, "index.md"),
    path.join(resolved, "index.mdx"),
  ].some((candidate) => fs.existsSync(candidate));
}

function shouldSkip(target) {
  return (
    target.startsWith("#") ||
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("tel:") ||
    target.startsWith("data:") ||
    target.startsWith("file:")
  );
}

function relative(file) {
  return path.relative(root, file);
}

walk(root);

if (issues.length > 0) {
  console.error("Markdown link check: FAIL");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Markdown link check: PASS");
