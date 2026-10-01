// Section 3.1: product identifiers and catalog lookups.

import { REGION_GROUPS } from "./constants.js";
import type { AnswerBrand, Authorization, Exclusions, Product, ProductDetail, ProductRef, ProductResult, PublicList } from "./types.js";

/** Whether a GTIN (8, 12, 13 or 14 digits) has a valid GS1 check digit. */
export function isValidGtin(gtin: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(gtin)) return false;
  const digits = [...gtin].map(Number);
  const check = digits.pop()!;
  // Weights alternate 3, 1, 3, ... from the digit next to the check digit.
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** GTIN-14 form used for matching: left-padded with zeros. Throws on an invalid GTIN. */
export function toGtin14(gtin: string): string {
  if (!isValidGtin(gtin)) throw new Error(`invalid GTIN: ${gtin}`);
  return gtin.padStart(14, "0");
}

/** An ASIN: 10 uppercase letters or digits. */
export function isValidAsin(asin: string): boolean {
  return /^[A-Z0-9]{10}$/.test(asin);
}

/** A Walmart item ID: 5 to 15 digits, as in a walmart.com product URL. */
export function isValidWalmartItemId(id: string): boolean {
  return /^[0-9]{5,15}$/.test(id);
}

/** A Walmart product ID (WPID): 8 to 16 uppercase letters or digits. */
export function isValidWpid(wpid: string): boolean {
  return /^[A-Z0-9]{8,16}$/.test(wpid);
}

/** The identifiers that find a product, in the order they're tried and reported (section 9.5). */
export const PRODUCT_IDENTIFIERS = ["gtin", "asin", "walmart_item_id", "wpid"] as const;
export type ProductIdentifier = (typeof PRODUCT_IDENTIFIERS)[number];

/** Whether a catalog product carries this one identifier. */
function hasIdentifier(p: Product, kind: ProductIdentifier, value: string): boolean {
  switch (kind) {
    case "gtin":
      return isValidGtin(value) && p.gtin !== undefined && isValidGtin(p.gtin) && toGtin14(p.gtin) === toGtin14(value);
    case "asin":
      return p.asins?.includes(value.toUpperCase()) ?? false;
    case "walmart_item_id":
      return p.walmart_item_ids?.includes(value) ?? false;
    case "wpid":
      return p.wpids?.includes(value.toUpperCase()) ?? false;
  }
}

/**
 * The catalog product a GTIN, ASIN, Walmart item ID or WPID refers to, or undefined when it isn't in
 * the catalog. When the request gives more than one, they're tried in PRODUCT_IDENTIFIERS order (section 9.5).
 */
export function findProduct(catalog: Product[] | undefined, ref: ProductRef): Product | undefined {
  if (!catalog) return undefined;
  for (const kind of PRODUCT_IDENTIFIERS) {
    const value = ref[kind];
    if (value === undefined) continue;
    const hit = catalog.find((p) => hasIdentifier(p, kind, value));
    if (hit) return hit;
  }
  return undefined;
}

/** Section 9.5: the registered brands whose catalogs hold a product, by the identifier that matched. */
export type ProductClaims = { [K in ProductIdentifier]?: AnswerBrand[] };

export type Resolution =
  | { status: "resolved"; brand: AnswerBrand; resolved_by: ProductIdentifier }
  | { status: "product_not_found" }
  | { status: "brand_ambiguous"; candidates: AnswerBrand[] };

/**
 * Section 9.5: the brand a product belongs to, from the registered brands claiming its identifiers.
 * One brand across every identifier given resolves; none is product_not_found; more than one,
 * including two identifiers that point to different brands, is brand_ambiguous.
 * Each brand is counted once: the caller passes one entry per brand, whatever its number of domains.
 */
export function resolveClaims(claims: ProductClaims): Resolution {
  const byDomain = new Map<string, AnswerBrand>();
  for (const kind of PRODUCT_IDENTIFIERS) for (const b of claims[kind] ?? []) if (!byDomain.has(b.domain)) byDomain.set(b.domain, b);
  const all = [...byDomain.values()].sort((a, b) => a.domain.localeCompare(b.domain));
  if (all.length === 0) return { status: "product_not_found" };
  if (all.length > 1) return { status: "brand_ambiguous", candidates: all };
  return { status: "resolved", brand: all[0]!, resolved_by: PRODUCT_IDENTIFIERS.find((k) => claims[k]?.length)! };
}

/**
 * Section 9.5 over public lists an agent holds, e.g. from a mirror. The registry resolves across
 * every registered brand, including those whose lists aren't public, so its answer is the one to use.
 */
export function resolveFromLists(lists: PublicList[], ref: ProductRef): Resolution {
  const claims: ProductClaims = {};
  for (const l of lists) {
    const brand = { domain: l.brand.domains[0]!, name: l.brand.name };
    for (const kind of PRODUCT_IDENTIFIERS) {
      const value = ref[kind];
      if (value !== undefined && l.catalog?.some((p) => hasIdentifier(p, kind, value))) (claims[kind] ??= []).push(brand);
    }
  }
  return resolveClaims(claims);
}

export type Coverage = "covered" | "excluded" | "not_in_scope";

/**
 * Section 3.1: whether an authorization covers a catalog product. Exclusions (the authorization's
 * and the brand's) always win over inclusions.
 */
export function productCoverage(authorization: Authorization, product: Product, brandExclusions?: Exclusions): Coverage {
  const s = authorization.scope;
  const line = product.product_line;
  const excluded =
    (line !== undefined && (s.exclude_product_lines?.includes(line) || brandExclusions?.product_lines?.includes(line))) ||
    s.exclude_products?.includes(product.id) ||
    brandExclusions?.products?.includes(product.id);
  if (excluded) return "excluded";
  const included =
    s.product_lines?.[0] === "all" ||
    (line !== undefined && s.product_lines?.includes(line)) ||
    s.products?.includes(product.id);
  return included ? "covered" : "not_in_scope";
}

/** Whether the authorization is scoped to every product (product_lines ["all"]). */
export function coversAllProducts(authorization: Authorization): boolean {
  return authorization.scope.product_lines?.[0] === "all";
}

/**
 * Section 9: whether an authorization covers a whole product line, for requests that ask with
 * product_line. The line is covered when the scope is ["all"] or names it, and nobody excludes it.
 */
export function productLineCovered(authorization: Authorization, line: string, brandExclusions?: Exclusions): boolean {
  const s = authorization.scope;
  if (s.exclude_product_lines?.includes(line) || brandExclusions?.product_lines?.includes(line)) return false;
  return s.product_lines?.[0] === "all" || (s.product_lines?.includes(line) ?? false);
}

/**
 * Section 9.2, for one authorization: covered, excluded, not in scope, or (for a product the catalog
 * doesn't hold) whether the authorization's ["all"] scope still covers it.
 */
export function productCovered(
  list: Pick<PublicList, "catalog" | "exclusions">,
  authorization: Authorization,
  product: ProductRef,
):
  | { in_catalog: true; product: Product; coverage: Coverage }
  | { in_catalog: false; coverage: "covered" | "not_in_catalog" } {
  const found = findProduct(list.catalog, product);
  if (found) return { in_catalog: true, product: found, coverage: productCoverage(authorization, found, list.exclusions) };
  return { in_catalog: false, coverage: coversAllProducts(authorization) ? "covered" : "not_in_catalog" };
}

/** Section 3.1: the countries a product's regions stand for, with named groups expanded. */
export function expandRegions(regions: readonly string[]): Set<string> {
  return new Set(regions.flatMap((r) => REGION_GROUPS[r] ?? [r]));
}

/** Section 3.1: whether a product is made for a territory. A product with no regions is made for every one. */
export function productInRegion(product: Product, territory: string): boolean {
  return product.regions === undefined || expandRegions(product.regions).has(territory);
}

const sameDetail = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

/**
 * Section 9: what an answer says about a catalog product. Status fields always; identifying detail
 * (id, line, name, MPNs, style code) too, which the registry drops for a list that isn't public
 * (see privateProductResult). A request's mpn or style_code is confirmed or mismatched against it.
 */
export function productResult(product: Product, ref: ProductRef): ProductResult {
  const confirmed: ProductDetail[] = [];
  const mismatched: ProductDetail[] = [];
  if (ref.mpn !== undefined && product.mpns?.length) (product.mpns.some((m) => sameDetail(m, ref.mpn!)) ? confirmed : mismatched).push("mpn");
  if (ref.style_code !== undefined && product.style_code !== undefined) (sameDetail(product.style_code, ref.style_code) ? confirmed : mismatched).push("style_code");
  return {
    in_catalog: true,
    id: product.id,
    ...(product.product_line ? { product_line: product.product_line } : {}),
    name: product.name,
    ...(product.mpns?.length ? { mpns: product.mpns } : {}),
    ...(product.style_code ? { style_code: product.style_code } : {}),
    ...statusFields(product),
    ...(confirmed.length ? { confirmed } : {}),
    ...(mismatched.length ? { mismatched } : {}),
  };
}

/** Section 9.3: the product part of an answer for a list that isn't public. Status is safety information and always shows. */
export function privateProductResult(result: ProductResult): ProductResult {
  if (!result.in_catalog) return { in_catalog: false };
  const { in_catalog, status, status_since, recall_url, regions, confirmed, mismatched } = result;
  return {
    in_catalog,
    ...(status ? { status } : {}),
    ...(status_since ? { status_since } : {}),
    ...(recall_url ? { recall_url } : {}),
    ...(regions ? { regions } : {}),
    ...(confirmed ? { confirmed } : {}),
    ...(mismatched ? { mismatched } : {}),
  };
}

function statusFields(p: Product): Pick<ProductResult, "status" | "status_since" | "recall_url" | "regions"> {
  const notActive = p.status !== undefined && p.status !== "active";
  return {
    ...(notActive ? { status: p.status } : {}),
    ...(notActive && p.status_since ? { status_since: p.status_since } : {}),
    ...(p.status === "recalled" && p.recall_url ? { recall_url: p.recall_url } : {}),
    ...(p.regions ? { regions: p.regions } : {}),
  };
}
