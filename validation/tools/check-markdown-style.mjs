#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const excludedDirs = new Set([".git", "node_modules", "dist", ".ontoly", ".agents"]);
const includeExtensions = new Set([".md", ".mdx"]);
const bannedPatterns = [
  { pattern: /TODO:/i, label: "TODO marker" },
  { pattern: /FIXME:/i, label: "FIXME marker" },
  { pattern: /TBD\b/i, label: "TBD marker" },
  { pattern: /lorem ipsum/i, label: "placeholder copy" },
];
const issues = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
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
  const relative = path.relative(root, file);
  if (!/^#\s+/m.test(content) && !/^---\ntitle:\s+["'][^"']+["']/m.test(content)) {
    issues.push(`${relative}: missing top-level heading`);
  }
  for (const { pattern, label } of bannedPatterns) {
    if (pattern.test(content)) {
      issues.push(`${relative}: contains ${label}`);
    }
  }
  if (/software graph/i.test(content) && !/Software Graph/.test(content)) {
    issues.push(`${relative}: use Software Graph casing`);
  }
}

walk(root);

if (issues.length > 0) {
  console.error("Markdown style check: FAIL");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Markdown style check: PASS");
