#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const root = resolve(dirname(__filename), "..");
const publishTag = process.env.NPM_PUBLISH_TAG || "rc";
const releaseVersion = process.env.RELEASE_VERSION;
const packageDirs = [
  "packages/core",
  "packages/cache",
  "packages/diagnostics",
  "packages/query",
  "packages/typescript",
  "packages/analyzers",
  "packages/enhancer",
  "packages/enhancers/semantics",
  "packages/intelligence",
  "packages/capabilities",
  "packages/compiler",
  "packages/mcp",
  "packages/parser-openapi",
  "packages/semantic",
  "packages/parser-typescript",
  "plugins/mermaid",
  "plugins/html",
  "packages/cli",
];

for (const directory of packageDirs) {
  const packageJsonPath = join(root, directory, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`Missing package.json: ${directory}`);
  }
}

const manifests = packageDirs.map((directory) => {
  const packageJsonPath = join(root, directory, "package.json");
  return {
    directory,
    manifest: JSON.parse(readFileSync(packageJsonPath, "utf8")),
  };
});

const publishableManifests = manifests.filter(
  ({ manifest }) => !manifest.private && manifest.name?.startsWith("@0xsarwagya/ontoly-")
);
const versions = new Set(publishableManifests.map(({ manifest }) => manifest.version));
if (versions.size !== 1) {
  throw new Error(`Publishable packages must share one version. Found: ${[...versions].join(", ")}`);
}

const packageVersion = [...versions][0];
if (releaseVersion && packageVersion !== releaseVersion) {
  throw new Error(`RELEASE_VERSION=${releaseVersion} does not match package version ${packageVersion}.`);
}

if (isPrerelease(packageVersion) && publishTag === "latest") {
  throw new Error(`Refusing to publish prerelease ${packageVersion} with npm dist-tag latest.`);
}

if (releaseVersion) {
  const expectedTag = `v${releaseVersion}`;
  const result = spawnSync("git", ["tag", "--points-at", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`Could not inspect git tags:\n${result.stderr || result.stdout}`);
  }
  const tags = result.stdout.split("\n").map((tag) => tag.trim());
  if (!tags.includes(expectedTag)) {
    throw new Error(`HEAD must be tagged ${expectedTag} before publishing. Found: ${tags.filter(Boolean).join(", ") || "none"}`);
  }
}

for (const directory of packageDirs) {
  const packageJsonPath = join(root, directory, "package.json");
  const manifest = JSON.parse(readFileSync(packageJsonPath, "utf8"));

  if (manifest.private) {
    console.log(`Skipping private package ${manifest.name}`);
    continue;
  }

  if (!manifest.name?.startsWith("@0xsarwagya/ontoly-")) {
    console.log(`Skipping non-Ontoly package ${manifest.name}`);
    continue;
  }

  if (isPublished(manifest.name, manifest.version)) {
    console.log(`Skipping ${manifest.name}@${manifest.version}; already published.`);
    ensurePublicAccess(manifest.name, { required: manifest.name === "@0xsarwagya/ontoly-capabilities" });
    continue;
  }

  console.log(`Publishing ${manifest.name}@${manifest.version} with dist-tag ${publishTag}...`);
  const publishArgs = ["publish", "--access", "public", "--no-git-checks", "--tag", publishTag];
  if (process.env.NPM_PROVENANCE === "true") {
    publishArgs.push("--provenance");
  }
  run("pnpm", publishArgs, join(root, directory));
  ensurePublicAccess(manifest.name, { required: true });
}

function isPublished(name, version) {
  const result = spawnSync("npm", ["view", `${name}@${version}`, "version", "--json"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status === 0) {
    return true;
  }

  if (`${result.stderr}\n${result.stdout}`.includes("E404")) {
    return false;
  }

  throw new Error(`Could not check npm version for ${name}@${version}:\n${result.stderr || result.stdout}`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}`);
  }
}

function ensurePublicAccess(name, options) {
  if (!name.startsWith("@")) {
    return;
  }

  const result = spawnSync("npm", ["access", "set", "status=public", name], {
    cwd: root,
    encoding: "utf8",
    stdio: options.required ? "inherit" : ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  if (result.status === 0) {
    console.log(`Confirmed public access for ${name}.`);
    return;
  }

  const output = `${result.stderr}\n${result.stdout}`;
  if (!options.required && /E404|not found|already public|not allowed/i.test(output)) {
    return;
  }

  throw new Error(`Could not confirm public npm access for ${name}:\n${output}`);
}

function isPrerelease(version) {
  return /-\w/.test(version);
}
