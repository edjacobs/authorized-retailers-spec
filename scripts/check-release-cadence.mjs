// Release rule: the headline version (0.x before 1.0, then the major) changes at most once every 30
// days. Patch releases in between are fine. Run before tagging, and by the Release workflow.
//
//   node scripts/check-release-cadence.mjs [version] [--now=ISO]   (version defaults to package.json)

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export const MIN_DAYS = 30;
const DAY = 86_400_000;

/** "0.2.3" -> "0.2"; "1.4.0" -> "1". */
export const headline = (v) => {
  const [major, minor] = v.replace(/^v/, "").split(".");
  return major === "0" ? `0.${minor}` : major;
};

/**
 * tags: [{ version, date }] of earlier releases. Returns null if releasing `version` is allowed,
 * or the reason it isn't.
 */
export function cadenceProblem(version, tags, now) {
  const current = headline(version);
  const earlier = tags.filter((t) => t.version !== version.replace(/^v/, ""));
  if (!earlier.length) return null;
  const latest = earlier.reduce((a, b) => (b.date > a.date ? b : a));
  if (headline(latest.version) === current) return null;
  // When did the latest headline start? Its earliest release.
  const started = Math.min(...earlier.filter((t) => headline(t.version) === headline(latest.version)).map((t) => t.date));
  const days = (now - started) / DAY;
  if (days >= MIN_DAYS) return null;
  const allowed = new Date(started + MIN_DAYS * DAY).toISOString().slice(0, 10);
  return `v${version} changes the headline version from ${headline(latest.version)} to ${current}, but ${headline(latest.version)} was first released ${Math.floor(days)} days ago. The headline version changes at most once every ${MIN_DAYS} days: release it on or after ${allowed}, or ship these changes as a patch.`;
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
