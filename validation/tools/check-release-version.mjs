#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expectedVersion = process.env.RELEASE_VERSION ?? readJson("package.json").version;
const expectedTag = `v${expectedVersion}`;
const issues = [];

for (const file of ["package.json", ...findPackageFiles("packages"), ...findPackageFiles("plugins")]) {
  const manifest = readJson(file);
  if ((file === "package.json" || !manifest.private) && manifest.version !== expectedVersion) {
    issues.push(`${file}: expected version ${expectedVersion}, found ${manifest.version}`);
  }
}

const releaseTextFiles = [
  "README.md",
  "CHANGELOG.md",
  "docs/version-matrix.md",
  "docs/compatibility-matrix.md",
  "skills/catalog.json",
  "skills/COMPATIBILITY_MATRIX.md",
  "site/manifest.json",
];

for (const file of releaseTextFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    issues.push(`${file}: missing release metadata file`);
    continue;
  }
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (!text.includes(expectedVersion) && !text.includes(expectedTag)) {
    issues.push(`${file}: missing ${expectedVersion}`);
  }
}

if (issues.length > 0) {
  console.error("Release version check: FAIL");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`Release version check: PASS (${expectedVersion})`);

function findPackageFiles(group) {
  const directory = path.join(root, group);
  if (!fs.existsSync(directory)) {
    return [];
  }
  return walk(directory).map((file) => path.relative(root, file));
}

function walk(directory) {
  const packageJson = path.join(directory, "package.json");
  if (fs.existsSync(packageJson)) {
    return [packageJson];
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules" && entry.name !== "dist")
    .flatMap((entry) => walk(path.join(directory, entry.name)));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}
