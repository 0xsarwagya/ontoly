#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredPackageFields = [
  "name",
  "version",
  "description",
  "license",
  "type",
  "repository",
  "homepage",
  "bugs",
  "funding",
  "exports",
  "main",
  "types",
  "files",
  "sideEffects",
  "engines",
  "publishConfig",
];

const issues = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function packageFiles() {
  const groups = ["packages", "plugins"];
  return groups.flatMap((group) => {
    const dir = path.join(root, group);
    if (!fs.existsSync(dir)) {
      return [];
    }
    return fs
      .readdirSync(dir)
      .map((name) => path.join(dir, name, "package.json"))
      .filter((file) => fs.existsSync(file));
  });
}

function fail(file, message) {
  issues.push(`${path.relative(root, file)}: ${message}`);
}

function hasField(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return value !== undefined && value !== null && value !== "";
}

const rootPackage = readJson(path.join(root, "package.json"));
if (!rootPackage.private) {
  fail(path.join(root, "package.json"), "repository package must stay private");
}
for (const field of ["repository", "homepage", "bugs", "funding", "engines", "keywords"]) {
  if (!hasField(rootPackage[field])) {
    fail(path.join(root, "package.json"), `missing ${field}`);
  }
}

const internalGraph = new Map();
const packageNames = new Set();

for (const file of packageFiles()) {
  const dir = path.dirname(file);
  const pkg = readJson(file);
  packageNames.add(pkg.name);

  for (const field of requiredPackageFields) {
    if (!hasField(pkg[field])) {
      fail(file, `missing ${field}`);
    }
  }

  if (!pkg.name?.startsWith("@0xsarwagya/ontoly-")) {
    fail(file, "package name must use @0xsarwagya/ontoly-*");
  }
  if (pkg.license !== "MIT") {
    fail(file, "license must be MIT");
  }
  if (pkg.type !== "module") {
    fail(file, "type must be module");
  }
  if (pkg.sideEffects !== false) {
    fail(file, "sideEffects must be false");
  }
  if (pkg.publishConfig?.access !== "public") {
    fail(file, "publishConfig.access must be public");
  }
  if (!pkg.engines?.node || !pkg.engines?.pnpm) {
    fail(file, "engines must declare node and pnpm");
  }
  if (pkg.main !== "./dist/index.js") {
    fail(file, "main must be ./dist/index.js");
  }
  if (pkg.types !== "./dist/index.d.ts") {
    fail(file, "types must be ./dist/index.d.ts");
  }
  if (pkg.exports?.["."]?.types !== "./dist/index.d.ts" || pkg.exports?.["."]?.import !== "./dist/index.js") {
    fail(file, "exports['.'] must expose dist index types and import");
  }
  for (const requiredFile of ["dist", "README.md", "LICENSE"]) {
    if (!pkg.files?.includes(requiredFile)) {
      fail(file, `files must include ${requiredFile}`);
    }
  }
  for (const requiredLocalFile of ["README.md", "LICENSE", "src/index.ts", "tsconfig.json", "tsconfig.build.json", "tsup.config.ts"]) {
    if (!fs.existsSync(path.join(dir, requiredLocalFile))) {
      fail(file, `missing ${requiredLocalFile}`);
    }
  }

  if (pkg.name === "@0xsarwagya/ontoly-cli" && pkg.bin?.ontoly !== "./dist/cli.js") {
    fail(file, "CLI package must expose bin.ontoly");
  }

  const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
  internalGraph.set(
    pkg.name,
    Object.keys(deps).filter((name) => name.startsWith("@0xsarwagya/ontoly-")),
  );
}

for (const [name, deps] of internalGraph) {
  for (const dep of deps) {
    if (!packageNames.has(dep)) {
      fail(path.join(root, "package.json"), `${name} depends on unknown internal package ${dep}`);
    }
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];
function visit(name) {
  if (visited.has(name)) {
    return;
  }
  if (visiting.has(name)) {
    const cycle = [...stack.slice(stack.indexOf(name)), name].join(" -> ");
    fail(path.join(root, "package.json"), `internal dependency cycle: ${cycle}`);
    return;
  }
  visiting.add(name);
  stack.push(name);
  for (const dep of internalGraph.get(name) ?? []) {
    visit(dep);
  }
  stack.pop();
  visiting.delete(name);
  visited.add(name);
}
for (const name of internalGraph.keys()) {
  visit(name);
}

if (issues.length > 0) {
  console.error("Package validation: FAIL");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`Package validation: PASS (${packageFiles().length} packages)`);
