// Release rule: the major version (the first of the three parts) changes at most once every 30
// days. Minor and patch releases in between are fine, so before 1.0 the rule never applies. Run before tagging, and by the Release workflow.
//
//   node scripts/check-release-cadence.mjs [version] [--now=ISO]   (version defaults to package.json)

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const MIN_DAYS = 30;
const DAY = 86_400_000;

/** The major version: "0.2.3" -> "0"; "1.4.0" -> "1". */
export const major = (v) => v.replace(/^v/, "").split(".")[0];

/**
 * tags: [{ version, date }] of earlier releases. Returns null if releasing `version` is allowed,
 * or the reason it isn't.
 */
export function cadenceProblem(version, tags, now) {
  const current = major(version);
  const earlier = tags.filter((t) => t.version !== version.replace(/^v/, ""));
  if (!earlier.length) return null;
  const latest = earlier.reduce((a, b) => (b.date > a.date ? b : a));
  if (major(latest.version) === current) return null;
  // When did the latest major version start? Its earliest release.
  const started = Math.min(...earlier.filter((t) => major(t.version) === major(latest.version)).map((t) => t.date));
  const days = (now - started) / DAY;
  if (days >= MIN_DAYS) return null;
  const allowed = new Date(started + MIN_DAYS * DAY).toISOString().slice(0, 10);
  return `v${version} changes the major version from ${major(latest.version)} to ${current}, but ${major(latest.version)} was first released ${Math.floor(days)} days ago. The major version changes at most once every ${MIN_DAYS} days: release it on or after ${allowed}, or ship these changes as a minor or patch release.`;
}

function releaseTags() {
  const out = execFileSync("git", ["for-each-ref", "--format=%(refname:short) %(creatordate:iso-strict)", "refs/tags/v*"], { encoding: "utf8" });
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [tag, date] = line.split(" ");
      return { version: tag.slice(1), date: Date.parse(date) };
    })
    .filter((t) => /^\d+\.\d+\.\d+$/.test(t.version));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const nowArg = args.find((a) => a.startsWith("--now="));
  const version = (args.find((a) => !a.startsWith("--")) ?? JSON.parse(readFileSync("package.json", "utf8")).version).replace(/^v/, "");
  const now = nowArg ? Date.parse(nowArg.slice(6)) : Date.now();
  const problem = cadenceProblem(version, releaseTags(), now);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  console.log(`v${version}: release cadence OK`);
}
