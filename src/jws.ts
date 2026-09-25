// Detached JWS (RFC 7515 Appendix F) with EdDSA / Ed25519 over RFC 8785 canonical JSON (§8).
//
// The signed payload is the canonical form of the document with its "signature" member removed.
// The compact serialization is "<header>..<signature>": the payload segment is empty because the
// reader recomputes it from the document it already has.

import { canonicalBytes, canonicalize } from "./jcs.js";
import { parseTimestamp } from "./timestamp.js";
import type { Signature } from "./types.js";

export const JWS_ALG = "EdDSA";
const ED25519 = { name: "Ed25519" } as const;

export interface PublicJwk {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid: string;
  alg?: "EdDSA";
  use?: "sig";
}

export interface Jwks {
  keys: PublicJwk[];
}

export function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/** The bytes a signature covers: the document minus "signature", canonicalized. */
export function signingPayload(doc: object): Uint8Array<ArrayBuffer> {
  const { signature: _omit, ...rest } = doc as Record<string, unknown>;
  return canonicalBytes(rest);
}

function protectedHeader(kid: string): string {
  return base64url(new TextEncoder().encode(canonicalize({ alg: JWS_ALG, kid })));
}

function signingInput(headerB64: string, payload: Uint8Array): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`${headerB64}.${base64url(payload)}`) as Uint8Array<ArrayBuffer>;
}

/**
 * Produces a compact detached JWS over `payload`. Holders of the private key (the signer Worker,
 * or a future managed key service) call this; nothing else in the registry sees the key.
 */
export async function signDetached(privateKey: CryptoKey, kid: string, payload: Uint8Array): Promise<string> {
  const header = protectedHeader(kid);
  const sig = new Uint8Array(await crypto.subtle.sign(ED25519, privateKey, signingInput(header, payload)));
  return `${header}..${base64url(sig)}`;
}

export type VerifyFailure =
  | "missing_signature"
  | "malformed_jws"
  | "alg_not_allowed"
  | "kid_mismatch"
  | "unknown_kid"
  | "bad_signature"
  | "answer_expired"
  | "list_expired";

export type SignatureCheck = { valid: true; kid: string } | { valid: false; reason: VerifyFailure };

export interface VerifyOptions {
  /** Epoch ms to check validity against. Defaults to Date.now(). */
  now?: number;
}

/**
 * Reference verifier for agents (§8, §9, §12). Checks, in order:
 *  - the signature is a well-formed detached EdDSA JWS whose header kid matches signature.kid;
 *  - the kid is in the current key set: signatures from keys no longer in the set are rejected (§8 MUST);
 *  - the signature verifies over the canonical document;
 *  - a verify answer is not past its valid_until (§9, §12 MUST), and a list is not past its expires (§5).
 * Callers SHOULD refetch the key set once on "unknown_kid" before giving up (§8).
 */
export async function verifyDocument(doc: object, jwks: Jwks, opts: VerifyOptions = {}): Promise<SignatureCheck> {
  const now = opts.now ?? Date.now();
  const sig = (doc as { signature?: Signature }).signature;
  if (!sig || typeof sig.jws !== "string" || typeof sig.kid !== "string") return { valid: false, reason: "missing_signature" };

  const parts = sig.jws.split(".");
  if (parts.length !== 3 || parts[1] !== "" || !parts[0] || !parts[2]) return { valid: false, reason: "malformed_jws" };
  let header: { alg?: unknown; kid?: unknown; crit?: unknown };
  let signature: Uint8Array<ArrayBuffer>;
  try {
    header = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[0])));
    signature = base64urlDecode(parts[2]);
  } catch {
    return { valid: false, reason: "malformed_jws" };
  }
  if (header.alg !== JWS_ALG || header.crit !== undefined) return { valid: false, reason: "alg_not_allowed" };
  if (header.kid !== sig.kid) return { valid: false, reason: "kid_mismatch" };

  const jwk = jwks.keys.find((k) => k.kid === sig.kid);
  if (!jwk || jwk.kty !== "OKP" || jwk.crv !== "Ed25519") return { valid: false, reason: "unknown_kid" };

  const key = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: jwk.x }, ED25519, false, ["verify"]);
  const ok = await crypto.subtle.verify(ED25519, key, signature, signingInput(parts[0], signingPayload(doc)));
  if (!ok) return { valid: false, reason: "bad_signature" };

  const d = doc as { valid_until?: unknown; expires?: unknown; form?: unknown };
  if (typeof d.valid_until === "string") {
    const until = parseTimestamp(d.valid_until);
    if (until === null || now > until) return { valid: false, reason: "answer_expired" };
  } else if (d.form === "full" && typeof d.expires === "string") {
    const expires = parseTimestamp(d.expires);
    if (expires === null || now >= expires) return { valid: false, reason: "list_expired" };
  }
  return { valid: true, kid: sig.kid };
}
