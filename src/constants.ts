import type { MarketplaceChannelType } from "./types.js";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** Section 10.1: a signed list's or answer's valid_until is at most 15 minutes after it was issued. */
export const MAX_VALIDITY_MS = 15 * MINUTE_MS;
/** Section 10.2: stale_until is at most 24 hours after issue. */
export const MAX_STALE_MS = 24 * HOUR_MS;
/** Section 10: the verify API reflects a revocation within this long. */
export const REVOCATION_MAX_DELAY_MS = MINUTE_MS;
/** Section 5.1: readers may follow this many HTTPS redirects when fetching a pointer. */
export const MAX_POINTER_REDIRECTS = 3;

/** Section 5.1: a pointer's list URL must be on this origin. */
export const REGISTRY_ORIGIN = "https://authorizedretailers.ai";
export const REGISTRY_JWKS_URL = `${REGISTRY_ORIGIN}/.well-known/jwks.json`;
export const REGISTRY_REVOCATIONS_URL = `${REGISTRY_ORIGIN}/revocations`;
/** Section 10.2: mirror base URLs. None yet; listed here and in the spec when they launch. */
export const MIRRORS: readonly string[] = [];

/** Section 4: the DNS TXT record value prefix. */
export const DNS_VERIFY_PREFIX = "authorizedretailers-verify=";
export const POINTER_PATH = "/.well-known/authorized-retailers.json";

/** Section 6: marketplace domains, their channel type and country. */
export const MARKETPLACE_DOMAINS: Readonly<Record<string, { type: MarketplaceChannelType; country: string }>> = {
  "amazon.com": { type: "amazon", country: "US" },
  "amazon.ca": { type: "amazon", country: "CA" },
  "amazon.co.uk": { type: "amazon", country: "GB" },
  "amazon.de": { type: "amazon", country: "DE" },
  "amazon.fr": { type: "amazon", country: "FR" },
  "amazon.it": { type: "amazon", country: "IT" },
  "amazon.es": { type: "amazon", country: "ES" },
  "amazon.com.au": { type: "amazon", country: "AU" },
  "walmart.com": { type: "walmart", country: "US" },
  "walmart.ca": { type: "walmart", country: "CA" },
  "ebay.com": { type: "ebay", country: "US" },
  "ebay.co.uk": { type: "ebay", country: "GB" },
  "ebay.ca": { type: "ebay", country: "CA" },
  "ebay.de": { type: "ebay", country: "DE" },
  "ebay.com.au": { type: "ebay", country: "AU" },
};

/** Section 6.2: two-letter domain endings widely used as generic domains, so they imply no territory. */
export const GENERIC_CCTLDS: ReadonlySet<string> = new Set([
  "ac", "ai", "cc", "co", "fm", "gg", "io", "la", "ly", "me", "sh", "so", "to", "tv", "vc", "ws",
]);

/**
 * Section 3.1: named groups a product's regions may use. EU: the 27 member states. The United
 * Kingdom (GB) is not in the EU and is listed on its own.
 */
export const REGION_GROUPS: Readonly<Record<string, readonly string[]>> = {
  EU: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"],
};
