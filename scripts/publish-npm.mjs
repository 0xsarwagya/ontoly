#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const root = resolve(dirname(__filename), "..");
const publishTag = process.env.NPM_PUBLISH_TAG || "latest";
const packageDirs = [
  "packages/core",
  "packages/cache",
  "packages/diagnostics",
  "packages/query",
  "packages/typescript",
  "packages/analyzers",
  "packages/semantic-index",
  "packages/enhancer",
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
  run("pnpm", ["publish", "--access", "public", "--no-git-checks", "--tag", publishTag], join(root, directory));
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
