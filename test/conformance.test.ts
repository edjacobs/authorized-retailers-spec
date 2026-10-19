// The agent conformance suite (conformance/) must stay consistent with the spec package: the
// reference decision passes every vector, and agents that skip a check fail the vector for it.
import { describe, expect, it } from "vitest";
import * as spec from "../src";
// @ts-expect-error: plain ES modules without type declarations
import { buildVectors } from "../conformance/vectors.mjs";
// @ts-expect-error: plain ES modules without type declarations
import { referenceDecide } from "../conformance/reference.mjs";

type Input = { now: string; verify_api: string; answer: Record<string, unknown> | null; jwks: unknown; feed: unknown };
type Vector = { id: string; section: string; input: Input; expect: { decision: string[]; stale?: boolean } };
type Decide = (input: Input) => Promise<{ decision: string; stale?: true }> | { decision: string; stale?: true };

const failures = async (decide: Decide) => {
  const { vectors } = (await buildVectors(spec)) as { vectors: Vector[] };
  const failed: string[] = [];
  for (const v of vectors) {
    const got = await decide(v.input);
    if (!v.expect.decision.includes(got.decision) || (v.expect.stale !== undefined && got.stale !== v.expect.stale)) failed.push(v.id);
  }
  return failed;
};

describe("agent conformance vectors", () => {
  it("every vector is passed by the reference decision", async () => {
    expect(await failures((input) => referenceDecide(spec, input))).toEqual([]);
  });

  it("an agent that trusts the status field without checking anything fails the checks it skips", async () => {
    const failed = await failures((input) => ({ decision: input.answer?.status === "authorized" ? "authorized" : "not_authorized" }));
    expect(failed).toEqual(expect.arrayContaining(["tampered", "unknown-key", "unsigned", "past-valid-until", "past-expires", "stale-no-feed"]));
  });

  it("an agent that never uses stale answers fails only the vector that allows one", async () => {
    const failed = await failures(async (input) => {
      const r = (await referenceDecide(spec, { ...input, verify_api: "reachable" })) as { decision: string; stale?: true };
      return r;
    });
    expect(failed).toEqual(["stale-api-down-feed"]);
  });

  it("an agent that checks a feed's signature but not when it was issued fails the v0.6 vector, and only that one", async () => {
    const old: Decide = async (input) => {
      const now = Date.parse(input.now);
      const a = input.answer as { stale_until?: string; revocation_id?: string; status?: string } | null;
      // The pre-0.6 rule: any signed, usable feed will do for a stale answer, whenever it was issued.
      if (a && a.status === "authorized" && input.verify_api === "unreachable" && input.feed && now > Date.parse((a as { valid_until?: string }).valid_until ?? "") && now <= Date.parse(a.stale_until ?? "")) {
        const feed = await spec.checkRevocationFeed(input.feed, input.jwks as spec.Jwks, { now });
        const answer = await spec.verifyDocument(a, input.jwks as spec.Jwks, { now: Date.parse((a as { valid_until?: string }).valid_until ?? "") });
        if (feed.valid && answer.valid) return feed.revoked(a.revocation_id ?? "") ? { decision: "unconfirmed" } : { decision: "authorized", stale: true };
        return { decision: "unconfirmed" };
      }
      return referenceDecide(spec, input);
    };
    expect(await failures(old)).toEqual(["stale-feed-before-answer"]);
  });

  it("each rule that needs v0.6 is labelled, so older agents know what's new", async () => {
    const { vectors } = (await buildVectors(spec)) as { vectors: (Vector & { since?: string })[] };
    expect(vectors.filter((v) => v.since === "0.6").map((v) => v.id).sort()).toEqual(["authorized-observed-null", "past-expires", "stale-feed-before-answer"]);
  });
});
