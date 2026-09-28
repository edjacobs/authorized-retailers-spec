// Section 5.2: which signed lists count. Only a list signed with the registry's keys, and only for a
// brand domain the list names. Agents reading lists directly or from a mirror apply this.

import { normalizeDomain } from "./identity.js";
import { isRevoked, verifyDocument, type Jwks, type VerifyFailure, type VerifyOptions } from "./jws.js";
import { parseTimestamp } from "./timestamp.js";
import type { Authorization, PublicList, RevocationFeed, SignedList } from "./types.js";

export type PublishedListCheck =
  | { counts: true; kid: string; stale?: true }
  | { counts: false; reason: VerifyFailure | "domain_mismatch" | "not_a_list" };

/**
 * Whether a fetched list counts for `brandDomain`, given the registry's keys. An unsigned list, a
 * bad signature, a list past its valid_until (or stale_until, with allowStale) or a list that
 * doesn't name the domain doesn't count: treat it as no list at all.
 */
export async function checkPublishedList(
  brandDomain: string,
  list: unknown,
  jwks: Jwks,
  opts: VerifyOptions = {},
): Promise<PublishedListCheck> {
  const domains = (list as SignedList | null)?.brand?.domains;
  if (typeof list !== "object" || list === null || !Array.isArray(domains) || typeof (list as SignedList).public !== "boolean") {
    return { counts: false, reason: "not_a_list" };
  }
  const want = normalizeDomain(brandDomain);
  if (!domains.some((d) => typeof d === "string" && normalizeDomain(d) === want)) return { counts: false, reason: "domain_mismatch" };
  const sig = await verifyDocument(list, jwks, opts);
  if (!sig.valid) return { counts: false, reason: sig.reason };
  return sig.stale ? { counts: true, kid: sig.kid, stale: true } : { counts: true, kid: sig.kid };
}

/**
 * The authorizations a reader may rely on at `now`: those without an end date or not yet past it.
 * With a revocation feed (for a stale list, section 10.3), revoked authorizations are dropped too.
 */
export function validAuthorizations(list: PublicList, now: number = Date.now(), revocationFeed?: RevocationFeed): Authorization[] {
  return list.authorizations.filter((a) => {
    if (revocationFeed && isRevoked(revocationFeed, a.revocation_id)) return false;
    if (a.expires === undefined) return true;
    const exp = parseTimestamp(a.expires);
    return exp !== null && now < exp;
  });
}
