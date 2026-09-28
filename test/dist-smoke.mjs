// Runs against the built package in plain Node, the way an agent developer would use it.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { canonicalize, checkPublishedList, matchRequest, signDetached, signingPayload, validateFile, validateList, verifyDocument } from "../dist/index.js";
import { verifyDocument as verifyFromJws } from "../dist/jws.js";

const fx = (p) => JSON.parse(readFileSync(new URL(`../fixtures/${p}`, import.meta.url), "utf8"));
assert.equal(validateFile(fx("pointer/valid/pointer.json"), "brand.example").valid, true, "validator works from dist");
assert.equal(canonicalize({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');

const { signature: _s, ...unsigned } = fx("list/valid/list-catalog-line-scope.json");
assert.equal(validateList({ ...unsigned, signature: _s }).valid, true);
const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const { x } = await crypto.subtle.exportKey("jwk", publicKey);
const kid = "ar-20260928-0001";
const jwks = { keys: [{ kty: "OKP", crv: "Ed25519", x, kid }] };
const list = { ...unsigned, signature: { kid, jws: await signDetached(privateKey, kid, signingPayload(unsigned)) } };
const now = Date.parse("2026-09-28T14:05:00Z");
assert.deepEqual(await checkPublishedList("brand.example", list, jwks, { now }), { counts: true, kid });
assert.equal((await verifyFromJws(list, jwks, { now })).valid, true, "jws entry point works alone");
assert.equal((await verifyDocument(list, jwks, { now })).valid, true);
const answer = matchRequest(list, { brand_domain: "brand.example", channel: { type: "amazon", domain: "amazon.com", seller_id: "A1B2C3D4E5F6G7" }, product: { asin: "B0EXAMPLE1" } }, now);
assert.equal(answer.status, "authorized");
console.log("dist smoke test passed");
