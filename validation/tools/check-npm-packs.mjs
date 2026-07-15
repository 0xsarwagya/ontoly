#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const issues = [];
const packageFiles = findPackageFiles("packages").concat(findPackageFiles("plugins"));
let publishablePackages = 0;

for (const packageJsonPath of packageFiles) {
  const directory = path.dirname(packageJsonPath);
  const manifest = readJson(packageJsonPath);
  if (manifest.private) {
    continue;
  }
  publishablePackages += 1;

  const artifact = createPackArtifact(directory, packageJsonPath);
  if (!artifact) {
    continue;
  }

  const files = new Set(artifact.files);
  const requiredFiles = ["package.json", "README.md", "LICENSE", "dist/index.js", "dist/index.d.ts"];

  for (const requiredFile of requiredFiles) {
    if (!files.has(requiredFile)) {
      issues.push(`${relative(packageJsonPath)}: packed artifact is missing ${requiredFile}`);
    }
  }

  for (const [name, target] of Object.entries(manifest.bin ?? {})) {
    const binPath = target.replace(/^\.\//, "");
    if (!files.has(binPath)) {
      issues.push(`${relative(packageJsonPath)}: packed artifact is missing bin ${name} -> ${binPath}`);
    }
  }

  if (manifest.name === "@0xsarwagya/ontoly-enhancer-semantics" && !files.has("enhancer.json")) {
    issues.push(`${relative(packageJsonPath)}: semantics enhancer package must include enhancer.json`);
  }

  const forbidden = [...files].filter((file) =>
    file.startsWith("src/") ||
    file.startsWith("tests/") ||
    file.includes("/tests/") ||
    file.endsWith(".tsbuildinfo")
  );
  if (forbidden.length > 0) {
    issues.push(`${relative(packageJsonPath)}: packed artifact includes source/test files: ${forbidden.join(", ")}`);
  }

  const packedManifest = artifact.manifest;
  if (packedManifest) {
    for (const section of ["dependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [name, version] of Object.entries(packedManifest[section] ?? {})) {
        if (String(version).startsWith("workspace:")) {
          issues.push(`${relative(packageJsonPath)}: packed ${section}.${name} still uses ${version}`);
        }
      }
    }
  }
}

if (issues.length > 0) {
  console.error("NPM pack check: FAIL");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(`NPM pack check: PASS (${publishablePackages} packages)`);

function findPackageFiles(group) {
  const start = path.join(root, group);
  if (!fs.existsSync(start)) {
    return [];
  }
  return walk(start);
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
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function createPackArtifact(directory, packageJsonPath) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "ontoly-pack-"));
  try {
    const pack = spawnSync("pnpm", ["--dir", directory, "pack", "--pack-destination", tempDirectory], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (pack.status !== 0) {
      issues.push(`${relative(packageJsonPath)}: pnpm pack failed\n${pack.stderr || pack.stdout}`);
      return undefined;
    }

    const tarball = fs
      .readdirSync(tempDirectory)
      .find((entry) => entry.endsWith(".tgz"));
    if (!tarball) {
      issues.push(`${relative(packageJsonPath)}: pnpm pack did not create a tarball`);
      return undefined;
    }

    const tarballPath = path.join(tempDirectory, tarball);
    const list = spawnSync("tar", ["-tf", tarballPath], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (list.status !== 0) {
      issues.push(`${relative(packageJsonPath)}: could not inspect packed file list\n${list.stderr || list.stdout}`);
      return undefined;
    }

    const result = spawnSync("tar", ["-xOf", tarballPath, "package/package.json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) {
      issues.push(`${relative(packageJsonPath)}: could not inspect packed package.json\n${result.stderr || result.stdout}`);
      return undefined;
    }

    return {
      files: list.stdout
        .split(/\r?\n/)
        .map((file) => file.replace(/^package\//, ""))
        .filter(Boolean),
      manifest: JSON.parse(result.stdout),
    };
  } catch (error) {
    issues.push(`${relative(packageJsonPath)}: could not inspect packed artifact (${error.message})`);
    return undefined;
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function relative(file) {
  return path.relative(root, file);
}
