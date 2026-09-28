import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  base64url,
  base64urlDecode,
  checkPublishedList,
  checkRevocationFeed,
  canonicalize,
  signDetached,
  signingPayload,
  validAuthorizations,
  verifyDocument,
  type PublicList,
  type RevocationFeed,
  type Jwks,
  type PublicJwk,
  type VerifyResponse,
} from "../src";

const fx = (p: string) => JSON.parse(readFileSync(join(import.meta.dirname, "..", "fixtures", p), "utf8"));

async function newKey(kid: string) {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pub = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const jwk: PublicJwk = { kty: "OKP", crv: "Ed25519", x: pub.x!, kid, alg: "EdDSA", use: "sig" };
  return { privateKey: pair.privateKey, jwk };
}

async function sign<T extends object>(doc: T, key: { privateKey: CryptoKey; jwk: PublicJwk }): Promise<T> {
  const jws = await signDetached(key.privateKey, key.jwk.kid, signingPayload(doc));
  return { ...doc, signature: { kid: key.jwk.kid, jws } };
}

let k1: Awaited<ReturnType<typeof newKey>>;
let k2: Awaited<ReturnType<typeof newKey>>;
let jwks: Jwks;
const list = (): PublicList => fx("list/valid/list-no-catalog.json");
const answer = (): VerifyResponse => fx("verify-response/valid/authorized-observed.json");
const feed = (): RevocationFeed => fx("revocation-feed/valid/feed.json");
const LIST_LIVE = Date.parse("2026-09-28T14:10:00Z");
const ANSWER_LIVE = Date.parse("2026-09-28T14:10:00Z");
const STALE = Date.parse("2026-09-28T20:00:00Z"); // past valid_until, before stale_until

beforeAll(async () => {
  k1 = await newKey("ar-20260923-0001");
  k2 = await newKey("ar-20260923-0002");
  jwks = { keys: [k1.jwk, k2.jwk] };
});

describe("detached JWS", () => {
  it("is compact with an empty payload segment and a canonical {alg, kid} header", async () => {
    const signed = await sign(list(), k1);
    const [h, p, s] = signed.signature!.jws.split(".");
    expect(p).toBe("");
    expect(new TextDecoder().decode(base64urlDecode(h!))).toBe(canonicalize({ alg: "EdDSA", kid: k1.jwk.kid }));
    expect(base64urlDecode(s!)).toHaveLength(64);
  });

  it("signs the canonical document without its signature member", async () => {
    const a = signingPayload({ b: 1, a: 2, signature: { kid: "x", jws: "y" } });
    expect(new TextDecoder().decode(a)).toBe('{"a":2,"b":1}');
  });

  it("verifies regardless of key order or whitespace in transit", async () => {
    const signed = await sign(list(), k1);
    const reverseKeys = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(reverseKeys)
      : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)]))
      : v;
    const reordered = JSON.parse(JSON.stringify(reverseKeys(signed), null, 4));
    expect(Object.keys(reordered)[0]).toBe("signature");
    expect(await verifyDocument(reordered, jwks, { now: LIST_LIVE })).toEqual({ valid: true, kid: k1.jwk.kid });
  });

  it("base64url round-trips", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(37));
    expect(base64urlDecode(base64url(bytes))).toEqual(bytes);
  });
});

describe("reference verifier", () => {
  it("rejects any change to the signed content", async () => {
    const signed = await sign(list(), k1);
    signed.authorizations[0]!.channels[0] = { type: "amazon", domain: "amazon.com", seller_id: "EVIL" };
    expect(await verifyDocument(signed, jwks, { now: LIST_LIVE })).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("§8 MUST reject signatures from keys no longer in the set", async () => {
    const signed = await sign(list(), k1);
    expect(await verifyDocument(signed, { keys: [k2.jwk] }, { now: LIST_LIVE })).toEqual({ valid: false, reason: "unknown_kid" });
  });

  it("§8 every signature names its kid, and the header must agree", async () => {
    const signed = await sign(list(), k1);
    signed.signature!.kid = k2.jwk.kid;
    expect(await verifyDocument(signed, jwks, { now: LIST_LIVE })).toEqual({ valid: false, reason: "kid_mismatch" });
  });

  it("rejects a signature made by a different key under the same kid", async () => {
    const impostor = await newKey(k1.jwk.kid);
    const signed = await sign(list(), impostor);
    expect(await verifyDocument(signed, jwks, { now: LIST_LIVE })).toEqual({ valid: false, reason: "bad_signature" });
  });

  it("rejects algorithms other than EdDSA, including none", async () => {
    const signed = await sign(list(), k1);
    const none = base64url(new TextEncoder().encode(JSON.stringify({ alg: "none", kid: k1.jwk.kid })));
    signed.signature!.jws = `${none}..${signed.signature!.jws.split(".")[2]}`;
    expect(await verifyDocument(signed, jwks, { now: LIST_LIVE })).toEqual({ valid: false, reason: "alg_not_allowed" });
  });

  it("rejects attached (non-detached) and malformed JWS", async () => {
    const signed = await sign(list(), k1);
    const [h, , s] = signed.signature!.jws.split(".");
    signed.signature!.jws = `${h}.${base64url(signingPayload(signed))}.${s}`;
    expect(await verifyDocument(signed, jwks, { now: LIST_LIVE })).toEqual({ valid: false, reason: "malformed_jws" });
    expect(await verifyDocument({ ...signed, signature: { kid: "x", jws: "!!..!!" } }, jwks)).toEqual({ valid: false, reason: "malformed_jws" });
    const { signature: _s, ...unsigned } = signed;
    expect(await verifyDocument(unsigned, jwks)).toEqual({ valid: false, reason: "missing_signature" });
  });

  it("§9/§12 MUST NOT rely on a verify answer after valid_until", async () => {
    const signed = await sign(answer(), k1);
    expect(await verifyDocument(signed, jwks, { now: ANSWER_LIVE })).toEqual({ valid: true, kid: k1.jwk.kid });
    expect(await verifyDocument(signed, jwks, { now: Date.parse(signed.valid_until) })).toEqual({ valid: true, kid: k1.jwk.kid });
    expect(await verifyDocument(signed, jwks, { now: Date.parse(signed.valid_until) + 1 })).toEqual({ valid: false, reason: "answer_expired" });
  });

  it("§10.1 treats a list past its valid_until as invalid", async () => {
    const signed = await sign(list(), k1);
    expect(await verifyDocument(signed, jwks, { now: Date.parse(signed.valid_until) + 1 })).toEqual({ valid: false, reason: "list_expired" });
  });
});

describe("§10.2 stale answers and lists, §10.3 revocation feed", () => {
  it("never accepts a stale answer without allowStale, or without a feed", async () => {
    const signed = await sign(answer(), k1);
    expect(await verifyDocument(signed, jwks, { now: STALE })).toEqual({ valid: false, reason: "answer_expired" });
    expect(await verifyDocument(signed, jwks, { now: STALE, allowStale: true })).toEqual({ valid: false, reason: "revocation_feed_required" });
  });
  it("accepts a stale answer that the feed doesn't list, flagged stale", async () => {
    const signed = await sign(answer(), k1);
    const f = await sign(feed(), k1);
    expect(await verifyDocument(signed, jwks, { now: STALE, allowStale: true, revocationFeed: f })).toEqual({ valid: true, kid: k1.jwk.kid, stale: true });
  });
  it("MUST drop a stale answer whose revocation_id is in the feed", async () => {
    const signed = await sign(answer(), k1);
    const f = await sign({ ...feed(), entries: [{ revocation_id: signed.status === "authorized" ? signed.revocation_id : "", revoked: "2026-09-28T15:00:00Z" }] }, k1);
    expect(await verifyDocument(signed, jwks, { now: STALE, allowStale: true, revocationFeed: f })).toEqual({ valid: false, reason: "revoked" });
  });
  it("rejects an unsigned or tampered feed", async () => {
    const signed = await sign(answer(), k1);
    const f = await sign(feed(), k1);
    const tampered = { ...f, entries: [] };
    expect(await verifyDocument(signed, jwks, { now: STALE, allowStale: true, revocationFeed: tampered })).toEqual({ valid: false, reason: "revocation_feed_invalid" });
  });
  it("is unusable after stale_until, even with a feed", async () => {
    const signed = await sign(answer(), k1);
    const f = await sign(feed(), k1);
    expect(await verifyDocument(signed, jwks, { now: Date.parse(signed.stale_until) + 1, allowStale: true, revocationFeed: f })).toEqual({ valid: false, reason: "answer_expired" });
  });
  it("a feed is usable to its own stale_until, flagged stale after valid_until", async () => {
    const f = await sign(feed(), k1);
    const live = await checkRevocationFeed(f, jwks, { now: Date.parse(f.issued) });
    expect(live).toMatchObject({ valid: true, stale: false });
    const stale = await checkRevocationFeed(f, jwks, { now: STALE });
    expect(stale).toMatchObject({ valid: true, stale: true });
    expect(stale.valid && stale.revoked("rv_Z9y8X7w6V5u4T3s2")).toBe(true);
    expect(stale.valid && stale.revoked("rv_Q2l8dX4bT0aN5kPw")).toBe(false);
    expect(await checkRevocationFeed(f, jwks, { now: Date.parse(f.stale_until) + 1 })).toEqual({ valid: false, reason: "feed_expired" });
    expect(await checkRevocationFeed({ entries: [] }, jwks)).toEqual({ valid: false, reason: "not_a_feed" });
  });
  it("drops revoked authorizations from a stale list", async () => {
    const l = await sign(list(), k1);
    const f = await sign({ ...feed(), entries: [{ revocation_id: l.authorizations[0]!.revocation_id, revoked: "2026-09-28T15:00:00Z" }] }, k1);
    expect(await verifyDocument(l, jwks, { now: STALE, allowStale: true, revocationFeed: f })).toEqual({ valid: true, kid: k1.jwk.kid, stale: true });
    expect(validAuthorizations(l, STALE, f)).toEqual([]);
    expect(validAuthorizations(l, STALE)).toHaveLength(1);
  });
});

describe("§5.2 only registry-signed lists count, and only for the domains they name", () => {
  it("counts a signed list for a domain it names", async () => {
    const l = await sign({ ...list(), brand: { name: "Example Brand", domains: ["brand.example", "brand.co.uk"] } }, k1);
    expect(await checkPublishedList("brand.example", l, jwks, { now: LIST_LIVE })).toEqual({ counts: true, kid: k1.jwk.kid });
    expect(await checkPublishedList("WWW.Brand.co.uk", l, jwks, { now: LIST_LIVE })).toMatchObject({ counts: true });
  });
  it("doesn't count an unsigned list, a tampered one, or one naming other domains", async () => {
    const l = await sign(list(), k1);
    const { signature: _, ...unsigned } = l;
    expect(await checkPublishedList("brand.example", unsigned, jwks, { now: LIST_LIVE })).toEqual({ counts: false, reason: "missing_signature" });
    const tampered = { ...l, authorizations: [] };
    expect(await checkPublishedList("brand.example", tampered, jwks, { now: LIST_LIVE })).toEqual({ counts: false, reason: "bad_signature" });
    expect(await checkPublishedList("lookalike-brand.example", l, jwks, { now: LIST_LIVE })).toEqual({ counts: false, reason: "domain_mismatch" });
    expect(await checkPublishedList("brand.example", { form: "pointer" }, jwks)).toEqual({ counts: false, reason: "not_a_list" });
  });
  it("counts a signed not-public response the same way", async () => {
    const np = await sign(fx("list/valid/list-not-public.json"), k1);
    expect(await checkPublishedList("brand.example", np, jwks, { now: LIST_LIVE })).toEqual({ counts: true, kid: k1.jwk.kid });
  });
});
