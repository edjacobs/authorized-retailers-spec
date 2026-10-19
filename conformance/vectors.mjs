// Agent conformance vectors: signed verify answers and revocation feeds, minted with a throwaway key
// the vector itself names in its own key set, so an agent can check its decisions offline. Each
// vector is one situation from the spec (sections 7 to 12) and the decisions that conform to it.
//
// What an agent is asked: given the answer it holds, the key set, the revocation feed (if any), the
// time, and whether the verify API is reachable, may it describe the seller as authorized?
//
//   input  { now, question, verify_api: "reachable" | "unreachable", answer, jwks, feed }
//   output { decision: "authorized" | "not_authorized" | "unconfirmed", stale?: true }
//
// `expect.decision` lists every decision that conforms. The one rule behind the whole suite is that
// an agent MUST NOT describe a seller as authorized unless a current, correctly signed answer says so.

const MIN = 60_000;
const HOUR = 60 * MIN;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/** @param spec the @authorizedretailers/spec module (injected so the same vectors run from source or from the built package) */
export async function buildVectors(spec) {
  const { signDetached, signingPayload } = spec;
  const kid = "ar-conformance-0001";
  const pair = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  const other = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
  const publicJwk = async (key, id) => {
    const jwk = await crypto.subtle.exportKey("jwk", key.publicKey);
    return { kty: "OKP", crv: "Ed25519", x: jwk.x, kid: id, alg: "EdDSA", use: "sig" };
  };
  const jwks = { keys: [await publicJwk(pair, kid)] };
  const sign = async (input, key = pair, id = kid) => {
    const doc = JSON.parse(JSON.stringify(input)); // drops fields left undefined, as a real answer would not carry them
    return { ...doc, signature: { kid: id, jws: await signDetached(key.privateKey, id, signingPayload(doc)) } };
  };

  const T0 = Date.parse("2026-10-20T12:00:00Z"); // when the answer was checked
  const question = { brand_domain: "brand.example", channel: { type: "amazon", domain: "amazon.com", seller_id: "ASELLER0001" }, territory: "US" };
  const answerDoc = (over = {}) => ({
    status: "authorized",
    brand: { domain: "brand.example", name: "Example Brand" },
    resolved_by: "brand_domain",
    authorization_id: "auth_conformance",
    revocation_id: "rv_ConformanceAnswer01",
    checked: iso(T0),
    valid_until: iso(T0 + 15 * MIN),
    stale_until: iso(T0 + 24 * HOUR),
    observed: { last_seen: iso(T0 - 5 * 86_400_000) },
    signals: [],
    ...over,
  });
  const feedDoc = (issuedMs, entries = [], over = {}) => ({
    spec: "authorized-retailers/0.6",
    feed: "revocations",
    issued: iso(issuedMs),
    valid_until: iso(issuedMs + 15 * MIN),
    stale_until: iso(issuedMs + 24 * HOUR),
    entries,
    ...over,
  });

  const live = T0 + MIN; // a minute after the answer: well within valid_until
  const stale = T0 + 3 * HOUR; // past valid_until, before stale_until
  const goodFeed = await sign(feedDoc(T0 + 2 * HOUR + 59 * MIN));
  const authorized = await sign(answerDoc());

  const v = (id, section, title, input, expect, extra = {}) => ({
    id,
    section,
    title,
    ...extra,
    input: { question, verify_api: "reachable", feed: null, jwks, ...input },
    expect,
  });
  const NOT_AUTH = ["not_authorized", "unconfirmed"];

  return {
    jwks,
    vectors: [
      v("authorized-live", "9", "A current, correctly signed `authorized` answer is authorized", { now: iso(live), answer: authorized }, { decision: ["authorized"] }),
      v(
        "authorized-observed-null",
        "7",
        "`observed: null` is not a negative signal: the answer is still authorized",
        { now: iso(live), answer: await sign(answerDoc({ observed: null })) },
        { decision: ["authorized"] },
        { since: "0.6" },
      ),
      v("unlisted", "9", "`unlisted` is not authorized", { now: iso(live), answer: await sign(answerDoc({ status: "unlisted", reason: "no_authorization", authorization_id: undefined, revocation_id: undefined, observed: null })) }, { decision: NOT_AUTH }),
      v("unauthorized", "9", "A brand's `unauthorized` declaration means do not buy", { now: iso(live), answer: await sign(answerDoc({ status: "unauthorized", declaration_id: "dcl_conformance", declared: iso(T0 - 86_400_000), authorization_id: undefined, revocation_id: undefined, observed: null })) }, { decision: ["not_authorized"] }),
      v("expired-status", "9", "`expired` is not authorized", { now: iso(live), answer: await sign(answerDoc({ status: "expired", expires: iso(T0 - 86_400_000), revocation_id: undefined, observed: null })) }, { decision: NOT_AUTH }),
      v("unknown-status", "9", "A status the agent doesn't recognise MUST be treated as not authorized", { now: iso(live), answer: await sign(answerDoc({ status: "quarantined", authorization_id: undefined, revocation_id: undefined, observed: null })) }, { decision: NOT_AUTH }),
      v("tampered", "8", "An answer edited after signing (here, `unlisted` changed to `authorized`) is never authorized", { now: iso(live), answer: { ...(await sign(answerDoc({ status: "unlisted", reason: "no_authorization", authorization_id: undefined, revocation_id: undefined, observed: null }))), status: "authorized" } }, { decision: ["unconfirmed"] }),
      v("unknown-key", "8", "A signature from a key that isn't in the key set is rejected", { now: iso(live), answer: await sign(answerDoc(), other, "ar-conformance-9999") }, { decision: ["unconfirmed"] }),
      v("unsigned", "8", "An unsigned answer is no answer", { now: iso(live), answer: answerDoc() }, { decision: ["unconfirmed"] }),
      v("past-valid-until", "10.1", "An answer past `valid_until` can't be relied on while the verify API is reachable", { now: iso(stale), answer: authorized }, { decision: ["unconfirmed"] }),
      v("past-expires", "10.1", "An answer is not authorized after its `expires`, even before its `valid_until`", { now: iso(T0 + 10 * MIN), answer: await sign(answerDoc({ expires: iso(T0 + 5 * MIN) })) }, { decision: NOT_AUTH }, { since: "0.6" }),
      v("stale-api-down-feed", "10.2", "With the verify API unreachable, a stale answer is usable with a current feed that doesn't list it, and is marked stale", { now: iso(stale), verify_api: "unreachable", answer: authorized, feed: goodFeed }, { decision: ["authorized"], stale: true }),
      v("stale-api-up", "10.2", "A stale answer is not used while the verify API is reachable, even with a feed", { now: iso(stale), verify_api: "reachable", answer: authorized, feed: goodFeed }, { decision: ["unconfirmed"] }),
      v("stale-no-feed", "10.2", "A stale answer needs a revocation feed", { now: iso(stale), verify_api: "unreachable", answer: authorized, feed: null }, { decision: ["unconfirmed"] }),
      v("stale-revoked", "10.3", "A stale answer whose `revocation_id` is in the feed is dropped", { now: iso(stale), verify_api: "unreachable", answer: authorized, feed: await sign(feedDoc(T0 + 2 * HOUR + 59 * MIN, [{ revocation_id: "rv_ConformanceAnswer01", revoked: iso(T0 + 2 * HOUR) }])) }, { decision: ["unconfirmed"] }),
      v("stale-feed-before-answer", "10.2", "A feed issued before the answer says nothing about later revocations", { now: iso(stale), verify_api: "unreachable", answer: authorized, feed: await sign(feedDoc(T0 - 30 * MIN)) }, { decision: ["unconfirmed"] }, { since: "0.6" }),
      v("stale-feed-tampered", "10.3", "A feed with a broken signature is no feed", { now: iso(stale), verify_api: "unreachable", answer: authorized, feed: { ...goodFeed, entries: [{ revocation_id: "rv_Other", revoked: iso(T0) }] } }, { decision: ["unconfirmed"] }),
      v("past-stale-until", "10.2", "After `stale_until` an answer is unusable, even with a feed", { now: iso(T0 + 25 * HOUR), verify_api: "unreachable", answer: authorized, feed: await sign(feedDoc(T0 + 24 * HOUR + 30 * MIN)) }, { decision: ["unconfirmed"] }),
      v("no-answer", "10.2", "With no answer at all the seller is unconfirmed, not unauthorized and not authorized", { now: iso(live), verify_api: "unreachable", answer: null }, { decision: ["unconfirmed"] }),
    ],
  };
}
