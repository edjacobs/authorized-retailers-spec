#!/usr/bin/env node
// Conformance runner for authorized-retailers.json. Four modes:
//
//   node conformance/run.mjs --agent "<command>"     test an agent's decisions against the vectors
//   node conformance/run.mjs --registry [base-url]   check a registry's answers for the demo brand
//   node conformance/run.mjs --reference             check the vectors against the reference decision
//   node conformance/run.mjs --list                  list the vectors
//
// Build first in a checkout (`npm run build`); from npm it needs nothing. See conformance/README.md.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildVectors } from "./vectors.mjs";
import { referenceDecide } from "./reference.mjs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

async function loadSpec() {
  try {
    return await import("../dist/index.js");
  } catch {
    return await import("@authorizedretailers/spec");
  }
}

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

/** Runs every vector through `decide(input)`, prints one line each, and returns the failure count. */
export async function runVectors(spec, decide, { quiet = false } = {}) {
  const { vectors } = await buildVectors(spec);
  let failed = 0;
  for (const vec of vectors) {
    let got;
    try {
      got = await decide(vec.input);
    } catch (e) {
      got = { error: String(e?.message ?? e) };
    }
    const okDecision = got && vec.expect.decision.includes(got.decision);
    const okStale = vec.expect.stale === undefined || got?.stale === vec.expect.stale;
    const ok = okDecision && okStale;
    if (!ok) failed++;
    if (!quiet) {
      const want = vec.expect.decision.join(" or ") + (vec.expect.stale ? " (stale)" : "");
      console.log(`${ok ? green("PASS") : red("FAIL")} §${vec.section.padEnd(4)} ${vec.title}${vec.since ? dim(`  [v${vec.since}]`) : ""}`);
      if (!ok) console.log(`       expected ${want}, got ${JSON.stringify(got)}`);
    }
  }
  return failed;
}

function externalAgent(command) {
  return (input) => {
    const r = spawnSync(command, { shell: true, input: JSON.stringify(input), encoding: "utf8", timeout: 15_000 });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(`exited ${r.status}: ${(r.stderr || "").trim().slice(0, 200)}`);
    return JSON.parse(r.stdout);
  };
}

/** The registry's side: the demo brand's answers (conformance/demo-cases.json) must be well formed, signed and fresh. */
async function runRegistry(spec, base) {
  base = base.replace(/\/+$/, "");
  const cases = JSON.parse(readFileSync(here("./demo-cases.json"), "utf8"));
  const jwks = await (await fetch(`${base}/.well-known/jwks.json`)).json();
  let failed = 0;
  const report = (ok, text, why) => {
    if (!ok) failed++;
    console.log(`${ok ? green("PASS") : red("FAIL")} ${text}${ok ? "" : `\n       ${why}`}`);
  };
  report(Array.isArray(jwks.keys) && jwks.keys.length > 0, "§8 the key set is published", "no keys at /.well-known/jwks.json");

  for (const c of cases) {
    const body = { channel: c.channel, product: c.product, ...(c.territory ? { territory: c.territory } : {}) };
    const res = await fetch(`${base}/v0/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "authorized-retailers-conformance/0.7 (+https://authorizedretailers.ai/spec)" },
      body: JSON.stringify(body),
    });
    const a = await res.json();
    const problems = [];
    if (res.status !== 200) problems.push(`HTTP ${res.status}`);
    const shape = spec.validateVerifyResponse(a);
    if (!shape.valid) problems.push(`schema: ${shape.errors.map((e) => e.message).slice(0, 2).join("; ")}`);
    const sig = await spec.verifyDocument(a, jwks, { now: Date.now() });
    if (!sig.valid) problems.push(`signature: ${sig.reason}`);
    if (a.status !== c.expect.status) problems.push(`status ${a.status}, expected ${c.expect.status}`);
    if (c.expect.reason && a.reason !== c.expect.reason) problems.push(`reason ${a.reason}, expected ${c.expect.reason}`);
    if (c.expect.has_declaration && !a.declaration_id) problems.push("no declaration_id");
    if (!("observed" in a)) problems.push("`observed` missing (section 7: every answer MUST carry it)");
    const checked = Date.parse(a.checked);
    if (Date.parse(a.valid_until) - checked > 15 * 60_000) problems.push("valid_until is more than 15 minutes after checked (section 10.1)");
    if (Date.parse(a.stale_until) - checked > 24 * 3_600_000) problems.push("stale_until is more than 24 hours after checked (section 10.1)");
    report(problems.length === 0, `§9 ${c.ask}`, problems.join("; "));
  }

  const feed = await (await fetch(`${base}/v0/revocations`)).json();
  const feedCheck = await spec.checkRevocationFeed(feed, jwks);
  report(feedCheck.valid, "§10.3 the revocation feed is signed and fresh", `invalid: ${feedCheck.reason}`);
  return failed;
}

const args = process.argv.slice(2);
const flag = (name) => args.indexOf(name);
const spec = await loadSpec();
let failed = 0;

if (flag("--list") >= 0) {
  for (const v of (await buildVectors(spec)).vectors) console.log(`§${v.section.padEnd(4)} ${v.id.padEnd(26)} ${v.title}`);
} else if (flag("--agent") >= 0) {
  const command = args[flag("--agent") + 1];
  if (!command) throw new Error('usage: --agent "<command>"');
  failed = await runVectors(spec, externalAgent(command));
} else if (flag("--registry") >= 0) {
  const next = args[flag("--registry") + 1];
  failed = await runRegistry(spec, next && !next.startsWith("--") ? next : "https://authorizedretailers.ai");
} else if (flag("--reference") >= 0) {
  failed = await runVectors(spec, (input) => referenceDecide(spec, input));
} else {
  console.log('usage: run.mjs --agent "<command>" | --registry [url] | --reference | --list');
  process.exit(2);
}
if (flag("--list") < 0) console.log(failed === 0 ? `\n${green("All checks passed.")}` : `\n${red(`${failed} failed.`)}`);
process.exit(failed === 0 ? 0 : 1);
