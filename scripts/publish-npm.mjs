#!/usr/bin/env node

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
  "packages/diff",
  "packages/query",
  "packages/typescript",
  "packages/python",
  "packages/go",
  "packages/analyzers",
  "packages/enhancer",
  "packages/enhancers/history",
  "packages/enhancers/semantics",
  "packages/intelligence",
  "packages/capabilities",
  "packages/compiler",
  "packages/mcp",
  "packages/parser-openapi",
  "packages/parser-typescript",
  "packages/parser-python",
  "packages/parser-go",
  "packages/semantic",
  "packages/semantic-python",
  "packages/semantic-go",
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

const allPublished = publishableManifests.every(({ manifest }) =>
  isPublished(manifest.name, manifest.version)
);

if (releaseVersion && !allPublished) {
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
    console.log(`Already published ${manifest.name}@${manifest.version}; ensuring dist-tag ${publishTag}.`);
    // A rerun only needs this; trusted publishing allows dist-tag only when the trust grants it, so warn.
    if (!tryRun("npm", ["dist-tag", "add", `${manifest.name}@${manifest.version}`, publishTag], root)) {
      console.warn(`Could not set dist-tag ${publishTag} on ${manifest.name}@${manifest.version}; set it by hand.`);
    }
    continue;
  }

  console.log(`Publishing ${manifest.name}@${manifest.version} with dist-tag ${publishTag}...`);
  // pnpm packs, so workspace:* dependencies become real versions; npm publishes, because only the npm CLI
  // authenticates with npm trusted publishing (OIDC). It tries OIDC first and falls back to NODE_AUTH_TOKEN.
  const tarball = pack(join(root, directory));
  const publishArgs = ["publish", tarball, "--access", "public", "--tag", publishTag];
  if (process.env.NPM_PROVENANCE === "true") {
    publishArgs.push("--provenance");
  }
  try {
    run("npm", publishArgs, join(root, directory));
  } finally {
    rmSync(dirname(tarball), { recursive: true, force: true });
  }
}

/** Packs the package with pnpm into a fresh directory and returns the tarball's path. */
function pack(packageDirectory) {
  const destination = mkdtempSync(join(tmpdir(), "ontoly-pack-"));
  run("pnpm", ["pack", "--pack-destination", destination], packageDirectory);
  const tarballs = readdirSync(destination).filter((file) => file.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    throw new Error(`Expected one tarball from pnpm pack in ${packageDirectory}, found ${tarballs.length}`);
  }
  return join(destination, tarballs[0]);
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

function tryRun(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: "utf8", stdio: "inherit", env: process.env }).status === 0;
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


function isPrerelease(version) {
  return /-\w/.test(version);
}
