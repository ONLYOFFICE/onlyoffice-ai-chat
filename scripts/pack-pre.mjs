// Build a prerelease .tgz for handing off to a consuming app, without leaving a
// version bump in git history. Steps: build -> set a temporary prerelease
// version -> npm pack -> revert package.json / package-lock.json.
//
// Usage:
//   node scripts/pack-pre.mjs 0.5.0-docs.2        # explicit full version
//   node scripts/pack-pre.mjs --preid docs 2      # <current>-docs.2 from package.json
//
// The package.json `version` is restored afterwards even if `npm pack` fails,
// so the working tree stays clean and branches never conflict on the version
// line.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(__dirname, "..", "package.json");

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
    throw new Error(
      "Usage: npm run pack:pre -- <version>, e.g. 0.5.0-docs.2"
    );
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

try {
  run("npm run build");
  run(`npm version ${version} --no-git-tag-version`);
  run("npm pack");
  console.log(`\n✓ Packed onlyoffice-ai-chat-${version}.tgz`);
} finally {
  // Revert the temporary bump even if build/pack failed.
  run("git checkout package.json package-lock.json");
}
