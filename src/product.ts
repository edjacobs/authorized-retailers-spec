// Section 3.1: product identifiers and catalog lookups.

import type { Authorization, Exclusions, Product, ProductRef, PublicList } from "./types.js";

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

/** The catalog product a GTIN or ASIN refers to, or undefined when it isn't in the catalog. */
export function findProduct(catalog: Product[] | undefined, ref: ProductRef): Product | undefined {
  if (!catalog) return undefined;
  if ("gtin" in ref) {
    if (!isValidGtin(ref.gtin)) return undefined;
    const want = toGtin14(ref.gtin);
    return catalog.find((p) => p.gtin !== undefined && isValidGtin(p.gtin) && toGtin14(p.gtin) === want);
  }
  const asin = ref.asin.toUpperCase();
  return catalog.find((p) => p.asins?.includes(asin));
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
