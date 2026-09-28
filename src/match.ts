// Section 9: answering a verify request from a public list. The registry and agents holding a
// cached public list use the same function, so they reach the same answer.

import { channelKey, coversTerritory, territoryForDomain } from "./identity.js";
import { productCovered, productLineCovered } from "./product.js";
import { parseTimestamp } from "./timestamp.js";
import type { Authorization, ProductResult, PublicList, UnlistedReason, VerifyRequest } from "./types.js";

export interface MatchResult {
  status: "authorized" | "unlisted" | "expired";
  reason?: UnlistedReason;
  /** The authorization behind an authorized or expired answer. */
  authorization?: Authorization;
  /** Present when the request named a product (section 9). */
  product?: ProductResult;
  /** Signal types to attach to the answer, e.g. "product_not_in_catalog" (section 9.2 rule 5). */
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
      return { status: "expired", authorization: latest, signals: [], ...productOnly(list, request) };
    }
    // Section 6.2: a marketplace domain fixes the territory. Say so when the seller is listed there.
    const marketplaceElsewhere = named.some(
      ({ a, channel }) => channel.type !== "web" && !expiresBy(a, at) && territoryForDomain(channel.domain) !== territory,
    );
    return {
      status: "unlisted",
      ...(marketplaceElsewhere ? { reason: "territory_mismatch" as const } : {}),
      signals: [],
      ...productOnly(list, request),
    };
  }

  let candidates = live;
  if (request.product_line !== undefined) {
    candidates = candidates.filter((a) => productLineCovered(a, request.product_line!, list.exclusions));
    if (candidates.length === 0) return { status: "unlisted", signals: [], ...productOnly(list, request) };
  }

  if (request.product === undefined) return { status: "authorized", authorization: candidates[0]!, signals: [] };

  const results = candidates.map((a) => ({ a, r: productCovered(list, a, request.product!) }));
  const hit = results.find(({ r }) => r.coverage === "covered");
  const first = results[0]!.r;
  const product: ProductResult = first.in_catalog
    ? { in_catalog: true, id: first.product.id, ...(first.product.product_line ? { product_line: first.product.product_line } : {}) }
    : { in_catalog: false };
  if (hit) {
    return {
      status: "authorized",
      authorization: hit.a,
      product,
      signals: hit.r.in_catalog ? [] : ["product_not_in_catalog"],
    };
  }
  const reason: UnlistedReason = !first.in_catalog
    ? "product_not_in_catalog"
    : results.some(({ r }) => r.coverage === "excluded")
      ? "product_excluded"
      : "product_not_in_scope";
  return { status: "unlisted", reason, product, signals: [] };
}

/** The product part of an answer that was decided before the product was considered. */
function productOnly(list: PublicList, request: VerifyRequest): { product?: ProductResult } {
  if (request.product === undefined) return {};
  const probe = productCovered(list, { scope: {} } as Authorization, request.product);
  if (!probe.in_catalog) return { product: { in_catalog: false } };
  const p = probe.product;
  return { product: { in_catalog: true, id: p.id, ...(p.product_line ? { product_line: p.product_line } : {}) } };
}
