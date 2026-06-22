// Build a prerelease .tgz for handing off to a consuming app, without leaving a
// version bump in git history. Steps: build -> set a temporary prerelease
// version -> npm pack -> restore package.json / package-lock.json.
//
// Usage:
//   node scripts/pack-pre.mjs 0.5.0-docs.2        # explicit full version
//   node scripts/pack-pre.mjs --preid docs 2      # <current>-docs.2 from package.json
//
// The temporary version is undone by restoring the exact pre-bump bytes of
// package.json / package-lock.json (NOT `git checkout`), so any other
// uncommitted edits to those files are preserved and the working tree stays
// otherwise untouched.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const pkgPath = resolve(root, "package.json");
const lockPath = resolve(root, "package-lock.json");

function resolveVersion(argv) {
  if (argv[0] === "--preid") {
    const preid = argv[1];
    const num = argv[2];
    if (!preid || !num) {
      throw new Error("Usage: --preid <label> <number>, e.g. --preid docs 2");
    }
    const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
    return `${version}-${preid}.${num}`;
  }
  if (!argv[0]) {
    throw new Error("Usage: npm run pack:pre -- <version>, e.g. 0.5.0-docs.2");
  }
  return argv[0];
}

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

let version;
try {
  version = resolveVersion(process.argv.slice(2));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// Snapshot the exact bytes before any bump, so the restore preserves whatever
// (committed or not) was there.
const pkgSnapshot = readFileSync(pkgPath);
const lockSnapshot = readFileSync(lockPath);

try {
  run("npm run build");
  run(`npm version ${version} --no-git-tag-version`);
  run("npm pack");
  console.log(`\n✓ Packed onlyoffice-ai-chat-${version}.tgz`);
} finally {
  // Restore the pre-bump files even if build/pack failed.
  writeFileSync(pkgPath, pkgSnapshot);
  writeFileSync(lockPath, lockSnapshot);
}
