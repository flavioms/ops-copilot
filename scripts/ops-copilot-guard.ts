import { execFileSync } from "node:child_process";
import { existsSync, globSync, readFileSync } from "node:fs";
import { matchesGlob } from "node:path";
import { z } from "zod";

const MAX_LINES = 400;
const SOURCE_GLOBS = ["src/**/*.ts", "scripts/**/*.ts"];

const CriticalFiles = z.object({ globs: z.array(z.string()) });

// Empty when the ref does not exist (e.g. no commits yet or no base branch).
const git = (...args: string[]): string => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
};

const baseIdx = process.argv.indexOf("--base");
const base = baseIdx >= 0 ? process.argv[baseIdx + 1] : "main";

const problems: string[] = [];

for (const file of SOURCE_GLOBS.flatMap((g) => globSync(g))) {
  const lines = readFileSync(file, "utf8").split("\n").length;
  if (lines > MAX_LINES) problems.push(`${file}: ${lines} lines (max ${MAX_LINES})`);
}

const criticalPath = ".specify/critical-files.json";
const { globs } = CriticalFiles.parse(JSON.parse(readFileSync(criticalPath, "utf8")));

const changed = new Set([
  ...git("diff", "--name-only", `${base}...HEAD`).split("\n"),
  ...git("diff", "--name-only", "HEAD").split("\n"),
  ...git("ls-files", "--others", "--exclude-standard").split("\n"),
].filter(Boolean));

const critical = [...changed].filter((f) => globs.some((g) => matchesGlob(f, g)));

if (critical.length > 0) {
  const feature = JSON.parse(
    existsSync(".specify/feature.json") ? readFileSync(".specify/feature.json", "utf8") : "{}",
  ) as { feature_directory?: string };
  const changesPath = feature.feature_directory
    ? `${feature.feature_directory}/changes.md`
    : undefined;
  const changes = changesPath && existsSync(changesPath) ? readFileSync(changesPath, "utf8") : "";
  for (const file of critical) {
    if (!changes.includes(file)) {
      problems.push(`${file}: critical file changed without an entry in ${changesPath ?? "changes.md (no active feature)"}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`guard failed (base: ${base}):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`guard ok (${critical.length} critical file(s) changed)`);
