#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const rootLicense = fs.readFileSync(path.join(root, "LICENSE"), "utf8").trim();
const issues = [];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function packageFiles() {
  return ["packages", "plugins"].flatMap((group) => {
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

for (const file of [path.join(root, "package.json"), ...packageFiles()]) {
  const pkg = readJson(file);
  if (pkg.license !== "MIT") {
    issues.push(`${path.relative(root, file)}: expected MIT license`);
  }
}

for (const file of packageFiles()) {
  const licenseFile = path.join(path.dirname(file), "LICENSE");
  if (!fs.existsSync(licenseFile)) {
    issues.push(`${path.relative(root, path.dirname(file))}: missing LICENSE`);
    continue;
  }
  if (fs.readFileSync(licenseFile, "utf8").trim() !== rootLicense) {
    issues.push(`${path.relative(root, licenseFile)}: license text differs from root LICENSE`);
  }
}

if (issues.length > 0) {
  console.error("License check: FAIL");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("License check: PASS");
