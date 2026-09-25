import type { Authorization, Channel, FullFile } from "./types.js";
import { parseTimestamp } from "./timestamp.js";

/** Marketplace codes some platforms use in place of ISO 3166-1 alpha-2. */
const MARKETPLACE_ALIASES: Record<string, string> = { UK: "GB" };

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function normalizeCountry(code: string): string {
  const upper = code.trim().toUpperCase();
  return MARKETPLACE_ALIASES[upper] ?? upper;
}

/**
 * The identity an agent matches on (section 6: match on the channel identifier, never the
 * retailer name). Returns null for physical channels, which agents cannot verify.
 */
export function channelKey(channel: Channel): string | null {
  switch (channel.type) {
    case "amazon":
      return `amazon:${normalizeCountry(channel.marketplace)}:${channel.seller_id.trim().toUpperCase()}`;
    case "walmart":
      return `walmart:${normalizeCountry(channel.marketplace)}:${channel.seller_id.trim()}`;
    case "ebay":
      return `ebay:${normalizeCountry(channel.marketplace)}:${channel.seller_id.trim().toLowerCase()}`;
    case "web":
      return `web:${normalizeDomain(channel.domain)}`;
    case "physical":
      return null;
  }
}

/** Authorizations naming this channel. Matching uses channelKey only; retailer names are ignored. */
export function authorizationsForChannel(authorizations: Authorization[], channel: Channel): Authorization[] {
  const key = channelKey(channel);
  if (key === null) return [];
  return authorizations.filter((a) => a.channels.some((c) => channelKey(c) === key));
}

/**
 * The authorizations a reader may rely on at `now`. Section 5: an expired file contains no valid
 * authorizations. Individually expired authorizations are dropped too.
 */
export function validAuthorizations(file: FullFile, now: number = Date.now()): Authorization[] {
  const fileExpires = parseTimestamp(file.expires);
  if (fileExpires === null || now >= fileExpires) return [];
  return file.authorizations.filter((a) => {
    const exp = parseTimestamp(a.expires);
    return exp !== null && now < exp;
  });
}

/**
 * Brings raw agent input into the canonical form validateVerifyRequest expects: trims strings,
 * lowercases domains (dropping "www."), uppercases country codes. Leaves unexpected shapes alone
 * so the validator reports them.
 */
export function normalizeVerifyRequest(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const out: Record<string, unknown> = { ...input };
  if (typeof out.brand_domain === "string") out.brand_domain = normalizeDomain(out.brand_domain);
  if (typeof out.territory === "string") out.territory = normalizeCountry(out.territory);
  if (typeof out.product_line === "string") out.product_line = out.product_line.trim();
  out.channel = normalizeChannel(out.channel);
  return out;
}

/**
 * Canonical form of a channel as typed by a person or agent: trims, lowercases the type and
 * domains (dropping "www."), uppercases country codes. Unexpected shapes pass through untouched.
 * Identifier case is kept; channelKey decides how case compares.
 */
export function normalizeChannel(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const ch: Record<string, unknown> = { ...input };
  if (typeof ch.type === "string") ch.type = ch.type.trim().toLowerCase();
  if (typeof ch.marketplace === "string") ch.marketplace = normalizeCountry(ch.marketplace);
  if (typeof ch.seller_id === "string") ch.seller_id = ch.seller_id.trim();
  if (typeof ch.domain === "string") ch.domain = normalizeDomain(ch.domain);
  if (typeof ch.address === "string") ch.address = ch.address.trim();
  if (typeof ch.country === "string") ch.country = ch.country.trim().toUpperCase();
  return ch;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
