// Section 5: which published files count. Only a file signed by a registry, and only for the domain
// it was fetched from. Indexes and agents reading brands' files directly both apply this.

import { normalizeDomain } from "./identity.js";
import { verifyDocument, type Jwks, type VerifyFailure } from "./jws.js";
import type { AuthorizedRetailersFile } from "./types.js";

export type PublishedFileCheck =
  | { counts: true; kid: string }
  | { counts: false; reason: VerifyFailure | "domain_mismatch" };

/**
 * Whether a published file counts, given the domain it was fetched from and the registry's keys.
 * An unsigned file, a bad signature, an expired list, or a file naming another brand's domain
 * doesn't count: treat it as no file at all.
 */
export async function checkPublishedFile(
  fetchedFrom: string,
  file: AuthorizedRetailersFile,
  jwks: Jwks,
  now: number = Date.now(),
): Promise<PublishedFileCheck> {
  if (normalizeDomain(file.brand.domain) !== normalizeDomain(fetchedFrom)) return { counts: false, reason: "domain_mismatch" };
  const sig = await verifyDocument(file, jwks, { now });
  return sig.valid ? { counts: true, kid: sig.kid } : { counts: false, reason: sig.reason };
}
