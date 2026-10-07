// Section 9: answering a verify request from a public list. The registry and agents holding a
// cached public list use the same function, so they reach the same answer.

import { channelKey, coversTerritory, territoryForDomain } from "./identity.js";
import { findProduct, productCovered, productInRegion, productLineCovered, productResult } from "./product.js";
import { parseTimestamp } from "./timestamp.js";
import type { Authorization, ProductResult, PublicList, UnlistedReason, VerifyRequest } from "./types.js";

export interface MatchResult {
  status: "authorized" | "unlisted" | "expired";
  reason?: UnlistedReason;
  /** The authorization behind an authorized or expired answer. */
  authorization?: Authorization;
  /** Present when the request named a product (section 9). */
  product?: ProductResult;
  /** Signal types to attach to the answer, e.g. "product_not_in_catalog" (section 9.2 rule 6). */
  signals: string[];
}

/** An as_of value (ISO date or UTC date-time) as epoch ms; a bare date means the start of that day, UTC. */
export function parseAsOf(value: string): number | null {
  return parseTimestamp(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
}

function expiresBy(a: Authorization, at: number): boolean {
  if (a.expires === undefined) return false;
  const exp = parseTimestamp(a.expires);
  return exp === null || at >= exp;
}

/**
 * Matches a validated verify request against a brand's public list (sections 6.2, 9.1, 9.2).
 * Seller first: channel, seller ID, territory and date. Then product line or product, only among the
 * authorizations that cover the seller, so a product never makes an uncovered seller authorized.
 * Does not know about registration, disputes or observation: the registry adds those.
 * Throws if the territory can't be worked out (a generic-domain web store with no territory).
 */
export function matchRequest(list: PublicList, request: VerifyRequest, now: number = Date.now()): MatchResult {
  const at = request.as_of !== undefined ? parseAsOf(request.as_of) : now;
  if (at === null) throw new TypeError(`invalid as_of: ${request.as_of}`);
  const territory = request.territory ?? territoryForDomain(request.channel.domain);
  if (territory === null) throw new TypeError("territory is required for a web store on a generic domain (section 6.2)");

  const key = channelKey(request.channel);
  const named = list.authorizations
    .map((a) => ({ a, channel: a.channels.find((c) => channelKey(c) === key) }))
    .filter((x): x is { a: Authorization; channel: NonNullable<typeof x.channel> } => x.channel !== undefined);
  const inTerritory = named.filter(({ a, channel }) => coversTerritory(a, channel, territory));

  const live = inTerritory.filter(({ a }) => !expiresBy(a, at)).map(({ a }) => a);
  if (live.length === 0) {
    const ended = inTerritory.filter(({ a }) => expiresBy(a, at)).map(({ a }) => a);
    if (ended.length > 0) {
      const latest = ended.reduce((x, y) => (parseTimestamp(y.expires!)! > parseTimestamp(x.expires!)! ? y : x));
      return { status: "expired", authorization: latest, ...productOnly(list, request) };
    }
    // Section 6.2: a marketplace domain fixes the territory. Say so when the seller is listed there.
    const marketplaceElsewhere = named.some(
      ({ a, channel }) => channel.type !== "web" && !expiresBy(a, at) && territoryForDomain(channel.domain) !== territory,
    );
    return {
      status: "unlisted",
      ...(marketplaceElsewhere ? { reason: "territory_mismatch" as const } : {}),
      ...productOnly(list, request),
    };
  }

  let candidates = live;
  if (request.product_line !== undefined) {
    candidates = candidates.filter((a) => productLineCovered(a, request.product_line!, list.exclusions));
    if (candidates.length === 0) return { status: "unlisted", ...productOnly(list, request) };
  }

  if (request.product === undefined) return { status: "authorized", authorization: candidates[0]!, signals: [] };

  const { product, signals } = productOnly(list, request) as { product: ProductResult; signals: string[] };
  // Section 3.1: a product made for other regions is covered nowhere else, whatever the authorization says.
  const found = findProduct(list.catalog, request.product);
  if (found && !productInRegion(found, territory)) return { status: "unlisted", reason: "product_not_for_region", product, signals };

  const results = candidates.map((a) => ({ a, r: productCovered(list, a, request.product!) }));
  const hit = results.find(({ r }) => r.coverage === "covered");
  const first = results[0]!.r;
  if (hit) {
    return {
      status: "authorized",
      authorization: hit.a,
      product,
      signals: hit.r.in_catalog ? signals : ["product_not_in_catalog", ...signals],
    };
  }
  const reason: UnlistedReason = !first.in_catalog
    ? "product_not_in_catalog"
    : results.some(({ r }) => r.coverage === "excluded")
      ? "product_excluded"
      : "product_not_in_scope";
  return { status: "unlisted", reason, product, signals };
}

/**
 * The product part of an answer: what the catalog says about it (section 9) and the
 * product_details_mismatch signal when a sent mpn or style_code doesn't match.
 */
function productOnly(list: PublicList, request: VerifyRequest): { product?: ProductResult; signals: string[] } {
  if (request.product === undefined) return { signals: [] };
  const found = findProduct(list.catalog, request.product);
  if (!found) return { product: { in_catalog: false }, signals: [] };
  const product = productResult(found, request.product);
  return { product, signals: product.mismatched ? ["product_details_mismatch"] : [] };
}

/** Section 9.6: whether a request can be answered `unauthorized`: every request except one that pins v0.3. */
export function requestAllowsDeclarations(request: Pick<VerifyRequest, "spec">): boolean {
  return request.spec !== "authorized-retailers/0.3";
}

/**
 * Section 9.6: the answer for a request that pins v0.3; any other request gets it unchanged. `unauthorized` and
 * a `disputed` declaration don't exist there, so both become `unlisted`, without the declaration's
 * fields: in v0.3 terms, no authorization covers the seller. Every other answer is unchanged.
 */
export function answerForRequest<T extends { status: string }>(answer: T, request: Pick<VerifyRequest, "spec">): T {
  if (requestAllowsDeclarations(request) || !("declaration_id" in answer)) return answer;
  const { declaration_id: _id, declared: _at, ...rest } = answer as T & { declaration_id: string; declared: string };
  return { ...rest, status: "unlisted" } as unknown as T;
}
