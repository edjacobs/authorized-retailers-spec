import type { Authorization, Channel, MarketplaceChannel } from "./types.js";
import { GENERIC_CCTLDS, MARKETPLACE_DOMAINS } from "./constants.js";
import { common } from "./schemas.js";

/** ISO 3166-1 alpha-2 codes, from the schema so the two can't disagree. */
const ISO_COUNTRIES: ReadonlySet<string> = new Set(common.$defs.countryCode.enum);

/** Codes people commonly type in place of ISO 3166-1 alpha-2. Schemas accept only the ISO code. */
const COUNTRY_ALIASES: Record<string, string> = { UK: "GB" };

/** Section 6: lowercase, no trailing dot, no leading "www.". */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

/** Uppercases and maps common aliases (UK) to ISO 3166-1 alpha-2 (GB). */
export function normalizeCountry(code: string): string {
  const upper = code.trim().toUpperCase();
  return COUNTRY_ALIASES[upper] ?? upper;
}

export function isCountryCode(code: string): boolean {
  return ISO_COUNTRIES.has(code);
}

export function isMarketplaceDomain(domain: string): boolean {
  return Object.hasOwn(MARKETPLACE_DOMAINS, normalizeDomain(domain));
}

/**
 * Section 6.2: the country a domain implies. A marketplace domain's country from the table, a
 * country-code domain's country (".co.uk" is GB), or null for a generic domain (".com", ".io").
 */
export function territoryForDomain(domain: string): string | null {
  const d = normalizeDomain(domain);
  const market = MARKETPLACE_DOMAINS[d];
  if (market) return market.country;
  const tld = d.slice(d.lastIndexOf(".") + 1);
  if (tld.length !== 2 || GENERIC_CCTLDS.has(tld)) return null;
  const country = tld === "uk" ? "GB" : tld.toUpperCase();
  return ISO_COUNTRIES.has(country) ? country : null;
}

/**
 * Section 6.2: the territories one channel of an authorization covers. A marketplace channel covers
 * only its domain's country, and only if the scope (when given) allows it. A web store covers
 * scope.territories when given, otherwise its domain's country. An empty result means none: a
 * marketplace country the scope leaves out, or a generic-domain web store with no territories.
 */
export function effectiveTerritories(authorization: Authorization, channel: Channel): string[] {
  const listed = authorization.scope.territories;
  const own = territoryForDomain(channel.domain);
  if (channel.type !== "web") {
    if (own === null) return [];
    return !listed || listed[0] === "*" || listed.includes(own) ? [own] : [];
  }
  if (listed) return listed;
  return own === null ? [] : [own];
}

/** Whether a channel of an authorization covers a territory. */
export function coversTerritory(authorization: Authorization, channel: Channel, territory: string): boolean {
  const t = effectiveTerritories(authorization, channel);
  return t[0] === "*" || t.includes(territory);
}

/**
 * Section 6.1: the identity an agent matches on (never the retailer name). Domains are normalized;
 * Amazon seller IDs are uppercased, eBay user IDs lowercased and Walmart partner IDs kept as they are.
 */
export function channelKey(channel: Channel): string {
  const domain = normalizeDomain(channel.domain);
  switch (channel.type) {
    case "amazon":
      return `amazon:${domain}:${channel.seller_id.trim().toUpperCase()}`;
    case "walmart":
      return `walmart:${domain}:${channel.seller_id.trim()}`;
    case "ebay":
      return `ebay:${domain}:${channel.seller_id.trim().toLowerCase()}`;
    case "web":
      return `web:${domain}`;
  }
}

/** The marketplace channel's type as its domain implies, or null for a non-marketplace domain. */
export function marketplaceTypeForDomain(domain: string): MarketplaceChannel["type"] | null {
  return MARKETPLACE_DOMAINS[normalizeDomain(domain)]?.type ?? null;
}

/** Authorizations naming this channel. Matching uses channelKey only; retailer names are ignored. */
export function authorizationsForChannel(authorizations: Authorization[], channel: Channel): Authorization[] {
  const key = channelKey(channel);
  return authorizations.filter((a) => a.channels.some((c) => channelKey(c) === key));
}

/**
 * Brings raw agent input into the canonical form validateVerifyRequest expects: trims strings,
 * lowercases domains (dropping "www."), uppercases country codes and ASINs, maps "UK" to "GB",
 * strips spaces and dashes from GTINs and fills in channel.type from the domain when it's missing. Leaves unexpected shapes alone so the validator reports them.
 */
export function normalizeVerifyRequest(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const out: Record<string, unknown> = { ...input };
  if (typeof out.brand_domain === "string") out.brand_domain = normalizeDomain(out.brand_domain);
  if (typeof out.territory === "string") out.territory = normalizeCountry(out.territory);
  if (typeof out.product_line === "string") out.product_line = out.product_line.trim();
  if (typeof out.as_of === "string") out.as_of = out.as_of.trim();
  if (out.product !== undefined) out.product = normalizeProductRef(out.product);
  out.channel = normalizeChannel(out.channel);
  // Section 9: type is optional in a request. A marketplace domain implies its type; any other domain is a web store.
  if (isRecord(out.channel) && out.channel.type === undefined && typeof out.channel.domain === "string") {
    out.channel = { type: marketplaceTypeForDomain(out.channel.domain) ?? "web", ...out.channel };
  }
  return out;
}

/** normalizeVerifyRequest for a resolve request (section 9.5). */
export function normalizeResolveRequest(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const out: Record<string, unknown> = { ...input };
  if (typeof out.domain === "string") out.domain = normalizeDomain(out.domain);
  if (out.product !== undefined) out.product = normalizeProductRef(out.product);
  return out;
}

function normalizeProductRef(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const p: Record<string, unknown> = { ...input };
  if (typeof p.gtin === "string") p.gtin = p.gtin.replace(/[\s-]/g, "");
  if (typeof p.asin === "string") p.asin = p.asin.trim().toUpperCase();
  if (typeof p.mpn === "string") p.mpn = p.mpn.trim();
  if (typeof p.style_code === "string") p.style_code = p.style_code.trim();
  return p;
}

/**
 * Canonical form of a channel as typed by a person or agent: trims, lowercases the type and domain
 * (dropping "www."). Seller ID case is kept; channelKey decides how case compares.
 */
export function normalizeChannel(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const ch: Record<string, unknown> = { ...input };
  if (typeof ch.type === "string") ch.type = ch.type.trim().toLowerCase();
  if (typeof ch.seller_id === "string") ch.seller_id = ch.seller_id.trim();
  if (typeof ch.domain === "string") ch.domain = normalizeDomain(ch.domain);
  return ch;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
