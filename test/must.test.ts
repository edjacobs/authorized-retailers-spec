// One test (or more) per MUST rule the spec package can enforce. See docs/MUST-coverage.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  answerForRequest,
  authorizationsForChannel,
  channelKey,
  expandRegions,
  findProduct,
  matchRequest,
  normalizeVerifyRequest,
  privateProductResult,
  productInRegion,
  productResult,
  resolveClaims,
  validAuthorizations,
  validateFile,
  validateList,
  validateResolveRequest,
  validateResolveResponse,
  validateVerifyRequest,
  validateVerifyResponse,
  type PublicList,
} from "../src";

const fx = (p: string) => JSON.parse(readFileSync(join(import.meta.dirname, "..", "fixtures", p), "utf8"));
const plain = (): PublicList => fx("list/valid/list-no-catalog.json");
const withCatalog = (): PublicList => fx("list/valid/list-catalog-line-scope.json");
const codes = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code);
const at = (iso: string) => Date.parse(iso);

describe("§3 each authorization MUST carry channels and a product scope", () => {
  for (const drop of ["scope", "channels"] as const) {
    it(`rejects an authorization without ${drop}`, () => {
      const l = plain() as unknown as { authorizations: Record<string, unknown>[] };
      delete l.authorizations[0]![drop];
      expect(validateList(l).valid).toBe(false);
    });
  }
  it("rejects a scope with neither product_lines nor products", () => {
    const l = plain();
    l.authorizations[0]!.scope = { territories: ["US"] };
    expect(validateList(l).valid).toBe(false);
  });
  it("accepts an authorization with no end date (section 10)", () => {
    expect(plain().authorizations[0]!.expires).toBeUndefined();
    expect(validateList(plain()).valid).toBe(true);
  });
});

describe("§3.1 catalog rules", () => {
  it("each product MUST have a gtin or an ASIN", () => {
    const l = withCatalog();
    delete l.catalog![2]!.gtin;
    expect(codes(validateList(l))).toContain("product_without_identifier");
  });
  it("a GTIN or ASIN MUST NOT appear on two products", () => {
    const l = withCatalog();
    l.catalog![3]!.asins = ["B0EXAMPLE2"];
    expect(codes(validateList(l))).toContain("duplicate_identifier");
  });
  it("Walmart item IDs or WPIDs alone identify a product, and MUST NOT appear on two products", () => {
    const l = withCatalog();
    delete l.catalog![2]!.gtin;
    l.catalog![2]!.wpids = ["9Z8Y7X6W5V4U"];
    expect(validateList(l).valid).toBe(true);
    l.catalog![3]!.wpids = ["9Z8Y7X6W5V4U"];
    expect(codes(validateList(l))).toContain("duplicate_identifier");
  });
  it("every named product line MUST exist in the catalog", () => {
    const l = withCatalog();
    l.authorizations[0]!.scope.product_lines = ["Hats"];
    expect(codes(validateList(l))).toEqual(["unknown_product_line"]);
  });
  it("every named or excluded product MUST exist in the catalog", () => {
    const l = withCatalog();
    l.exclusions = { products: ["NOPE"] };
    expect(codes(validateList(l))).toEqual(["unknown_product"]);
  });
  it("exclusions always win over inclusions", () => {
    const l = withCatalog();
    l.authorizations[0]!.scope = { territories: ["US"], product_lines: ["all"], products: ["EB-DTC-1"] };
    const r = matchRequest(l, { brand_domain: "brand.example", channel: l.authorizations[0]!.channels[0]!, product: { gtin: "12345678901231" } }, at("2026-09-28T14:05:00Z"));
    expect(r).toMatchObject({ status: "unlisted", reason: "product_excluded" });
  });
});

describe("§5.1 pointer rules", () => {
  const pointer = () => fx("pointer/valid/pointer.json");
  it("readers MUST treat the v0.1 full and private forms as no file", () => {
    expect(codes(validateFile({ ...pointer(), form: "full" }))).toEqual(["form_not_supported"]);
    expect(codes(validateFile({ ...pointer(), form: "private" }))).toEqual(["form_not_supported"]);
  });
  it("brand.domain MUST be the domain the pointer was fetched from", () => {
    expect(validateFile(pointer(), "brand.example").valid).toBe(true);
    expect(validateFile(pointer(), "www.brand.example").valid).toBe(true);
    expect(codes(validateFile(pointer(), "evil.example"))).toEqual(["brand_domain_mismatch"]);
  });
  it("list MUST be an https://authorizedretailers.ai/ URL", () => {
    expect(codes(validateFile({ ...pointer(), list: "https://authorizedretailers.ai.evil.example/x" }))).toContain("list_not_on_registry");
    expect(codes(validateFile({ ...pointer(), list: "https://lists.example/x" }))).toContain("list_not_on_registry");
  });
});

describe("§5.2 a list that is not public carries no retailers or catalog", () => {
  it("rejects a not-public response with authorizations", () => {
    expect(validateList({ ...fx("list/valid/list-not-public.json"), authorizations: [] }).valid).toBe(false);
  });
});

describe("§6 channel rules", () => {
  it("every authorization MUST name at least one channel", () => {
    const l = plain();
    l.authorizations[0]!.channels = [];
    expect(validateList(l).valid).toBe(false);
  });
  it("a marketplace channel's domain MUST be one of that type's domains", () => {
    const l = plain();
    l.authorizations[0]!.channels[0]!.domain = "ebay.com";
    expect(codes(validateList(l))).toEqual(["marketplace_domain_mismatch"]);
  });
  it("a web channel MUST NOT use a marketplace domain", () => {
    const l = plain();
    l.authorizations[0]!.channels[2]!.domain = "walmart.com";
    expect(codes(validateList(l))).toEqual(["marketplace_domain_mismatch"]);
  });
  it("readers MUST reject the removed marketplace field and physical type", () => {
    const l = plain() as unknown as { authorizations: { channels: unknown[] }[] };
    l.authorizations[0]!.channels[0] = { type: "amazon", marketplace: "US", seller_id: "A1B2C3D4E5F6G7" };
    l.authorizations[0]!.channels[1] = { type: "physical", address: "1 Main St", country: "US" };
    expect(codes(validateList(l))).toEqual(["marketplace_field_removed", "unknown_channel_type"]);
    expect(codes(validateVerifyRequest({ brand_domain: "brand.example", channel: { type: "amazon", marketplace: "US", seller_id: "A1" } }))).toContain("marketplace_field_removed");
  });
});

describe("§6.1 agents MUST match on the channel identifier, never the retailer name", () => {
  const auths = plain().authorizations;
  it("matches a different retailer name with the same identifier", () => {
    const renamed = [{ ...auths[0]!, retailer: { name: "Totally Different Name" } }];
    expect(authorizationsForChannel(renamed, { type: "amazon", domain: "amazon.com", seller_id: "a1b2c3d4e5f6g7" })).toHaveLength(1);
  });
  it("does not match the same retailer name with a different identifier", () => {
    expect(authorizationsForChannel(auths, { type: "amazon", domain: "amazon.com", seller_id: "OTHER" })).toHaveLength(0);
  });
  it("does not match the same seller ID on a different marketplace domain", () => {
    expect(authorizationsForChannel(auths, { type: "amazon", domain: "amazon.ca", seller_id: "A1B2C3D4E5F6G7" })).toHaveLength(0);
  });
  it("does not match the same seller ID on a different platform", () => {
    expect(channelKey({ type: "walmart", domain: "walmart.com", seller_id: "A1B2C3D4E5F6G7" })).not.toBe(channelKey(auths[0]!.channels[0]!));
  });
  it("verify requests cannot carry a retailer name instead of an identifier", () => {
    expect(validateVerifyRequest({ brand_domain: "brand.example", retailer: "Example Retail LLC" }).valid).toBe(false);
  });
});

describe("§6.2 territory rules", () => {
  it("a web store on a generic domain MUST list territories", () => {
    const l = plain();
    l.authorizations[0]!.scope = { product_lines: ["all"] };
    expect(codes(validateList(l))).toEqual(["territories_required"]);
  });
  it("an authorization listing territories that leave out a marketplace's country is invalid", () => {
    const l = plain();
    l.authorizations[0]!.scope.territories = ["GB"];
    expect(codes(validateList(l))).toContain("territory_mismatch");
  });
  it("warns, but accepts, a ccTLD store listing another territory", () => {
    const l = plain();
    l.authorizations[0]!.channels = [{ type: "web", domain: "shop.co.uk" }];
    l.authorizations[0]!.scope = { territories: ["IE"], product_lines: ["all"] };
    const r = validateList(l);
    expect(r.valid).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(["territory_differs_from_domain"]);
  });
  it("country codes are ISO 3166-1: GB, not UK", () => {
    const l = plain();
    l.authorizations[0]!.scope.territories = ["UK"];
    expect(codes(validateList(l))).toContain("invalid_country");
  });
});

describe("§7 every answer MUST carry observed, null unless authorized", () => {
  const answer = () => fx("verify-response/valid/authorized.json");
  it("rejects an answer with no observed field", () => {
    const a = answer();
    delete a.observed;
    expect(validateVerifyResponse(a).valid).toBe(false);
  });
  it("allows last_seen on authorized answers only", () => {
    expect(validateVerifyResponse({ ...answer(), observed: { last_seen: "2026-09-20T00:00:00Z" } }).valid).toBe(true);
    expect(validateVerifyResponse({ ...fx("verify-response/valid/unlisted.json"), observed: { last_seen: "2026-09-20T00:00:00Z" } }).valid).toBe(false);
  });
});

describe("§9 every signed answer MUST carry valid_until (15 minutes) and stale_until (24 hours)", () => {
  const answer = () => fx("verify-response/valid/authorized.json");
  it("rejects a missing valid_until or stale_until", () => {
    for (const drop of ["valid_until", "stale_until"]) {
      const a = answer();
      delete a[drop];
      expect(validateVerifyResponse(a).valid).toBe(false);
    }
  });
  it("accepts exactly 15 minutes and rejects one second more", () => {
    expect(validateVerifyResponse({ ...answer(), valid_until: "2026-09-28T14:17:11Z" }).valid).toBe(true);
    expect(codes(validateVerifyResponse({ ...answer(), valid_until: "2026-09-28T14:17:12Z" }))).toEqual(["valid_until_exceeds_max"]);
  });
  it("accepts exactly 24 hours of stale_until and rejects one second more", () => {
    expect(validateVerifyResponse({ ...answer(), stale_until: "2026-09-29T14:02:11Z" }).valid).toBe(true);
    expect(codes(validateVerifyResponse({ ...answer(), stale_until: "2026-09-29T14:02:12Z" }))).toEqual(["stale_until_exceeds_max"]);
  });
});

describe("§9 reason MUST NOT appear on authorized, expired or disputed", () => {
  for (const status of ["authorized", "expired", "disputed"]) {
    it(`rejects reason on ${status}`, () => {
      const a = { ...fx("verify-response/valid/authorized.json"), status, expires: "2026-09-01T00:00:00Z", reason: "product_excluded" };
      if (status !== "authorized") delete a.revocation_id;
      expect(validateVerifyResponse(a).valid).toBe(false);
    });
  }
});

describe("§9.1 seller first: a product never makes an uncovered seller authorized", () => {
  it("an unknown seller asking with a catalog product stays unlisted", () => {
    const l = withCatalog();
    const r = matchRequest(l, { brand_domain: "brand.example", channel: { type: "amazon", domain: "amazon.com", seller_id: "AUNKNOWN" }, product: { asin: "B0EXAMPLE1" } }, at("2026-09-28T14:05:00Z"));
    expect(r.status).toBe("unlisted");
    expect(r.reason).toBeUndefined();
  });
});

describe("§9.3 lists that are not public: answers name no other authorization", () => {
  it("rejects an unlisted answer that names an authorization", () => {
    expect(validateVerifyResponse({ ...fx("verify-response/valid/unlisted.json"), authorization_id: "auth_01J9X2" }).valid).toBe(false);
  });
  it("rejects product id on a product not in the catalog", () => {
    expect(validateVerifyResponse({ ...fx("verify-response/valid/unlisted.json"), product: { in_catalog: false, id: "X" } }).valid).toBe(false);
  });
});

describe("§10 authorizations last until revoked unless the brand sets an end date", () => {
  it("keeps authorizations with no end date, drops those past theirs", () => {
    const l = plain();
    expect(validAuthorizations(l, at("2030-01-01T00:00:00Z"))).toHaveLength(1);
    l.authorizations[0]!.expires = "2026-10-01T00:00:00Z";
    expect(validAuthorizations(l, at("2026-09-30T00:00:00Z"))).toHaveLength(1);
    expect(validAuthorizations(l, at("2026-10-01T00:00:00Z"))).toHaveLength(0);
  });
});

describe("§8 every signature names its kid", () => {
  it("rejects a signature without kid", () => {
    const l = plain() as unknown as { signature: Record<string, unknown> };
    delete l.signature.kid;
    expect(validateList(l).valid).toBe(false);
  });
});

describe("§9.5 finding the brand from a product", () => {
  const amazon = { type: "amazon", domain: "amazon.com", seller_id: "A1B2C3D4E5F6G7" };
  const ex = { domain: "brand.example", name: "Example Brand" };
  const other = { domain: "other.example", name: "Other Brand" };

  it("a verify request MUST name a brand_domain or a product", () => {
    expect(codes(validateVerifyRequest({ channel: amazon }))).toContain("brand_or_product_required");
    expect(validateVerifyRequest({ channel: amazon, product: { gtin: "012345678905" } }).valid).toBe(true);
  });

  it("the UPC-A, EAN-13 and GTIN-14 forms of one number find the same product; a bad check digit is rejected", () => {
    const l = withCatalog();
    const ids = ["012345678905", "0012345678905", "00012345678905"].map((gtin) => findProduct(l.catalog, { gtin })?.id);
    expect(new Set(ids)).toEqual(new Set(["EB-TEE-BLK-M"]));
    expect(codes(validateVerifyRequest({ channel: amazon, product: { gtin: "012345678906" } }))).toContain("invalid_gtin");
  });

  it("an ASIN alone finds a brand only on an Amazon channel", () => {
    const walmart = { type: "walmart", domain: "walmart.com", seller_id: "900000001" };
    expect(codes(validateVerifyRequest({ channel: walmart, product: { asin: "B0EXAMPLE1" } }))).toContain("asin_needs_amazon_channel");
    expect(validateVerifyRequest({ channel: walmart, brand_domain: "brand.example", product: { asin: "B0EXAMPLE1" } }).valid).toBe(true);
    expect(validateVerifyRequest({ channel: amazon, product: { asin: "B0EXAMPLE1" } }).valid).toBe(true);
  });

  it("a Walmart item ID or WPID alone finds a brand only on a walmart channel on walmart.com", () => {
    const walmart = { type: "walmart", domain: "walmart.com", seller_id: "900000001" };
    const walmartCa = { type: "walmart", domain: "walmart.ca", seller_id: "900000001" };
    expect(codes(validateVerifyRequest({ channel: amazon, product: { walmart_item_id: "123456789" } }))).toContain("walmart_id_needs_walmart_channel");
    expect(codes(validateVerifyRequest({ channel: walmartCa, product: { wpid: "1A2B3C4D5E6F" } }))).toContain("walmart_id_needs_walmart_channel");
    expect(validateVerifyRequest({ channel: walmart, product: { walmart_item_id: "123456789" } }).valid).toBe(true);
    expect(validateVerifyRequest({ channel: amazon, product: { gtin: "012345678905", walmart_item_id: "123456789" } }).valid).toBe(true);
    expect(codes(validateResolveRequest({ product: { walmart_item_id: "123456789" }, domain: "amazon.com" }))).toContain("walmart_id_needs_walmart_channel");
    expect(validateResolveRequest({ product: { walmart_item_id: "123456789" }, domain: "walmart.com" }).valid).toBe(true);
    expect(codes(validateResolveRequest({ product: { asin: "B0EXAMPLE1" }, domain: "walmart.com" }))).toContain("asin_needs_amazon_channel");
  });

  it("more than one brand claiming a product MUST NOT resolve, and brand_ambiguous is never authorized", () => {
    expect(resolveClaims({ gtin: [ex, other] })).toEqual({ status: "brand_ambiguous", candidates: [ex, other] });
    expect(resolveClaims({ gtin: [ex], asin: [other] })).toEqual({ status: "brand_ambiguous", candidates: [ex, other] });
    expect(resolveClaims({ asin: [ex], walmart_item_id: [other] })).toEqual({ status: "brand_ambiguous", candidates: [ex, other] });
    const answer = fx("verify-response/valid/brand-ambiguous.json");
    expect(validateVerifyResponse({ ...answer, status: "authorized", authorization_id: "auth_1", revocation_id: "rv_Q2l8dX4bT0aN5kPw" }).valid).toBe(false);
  });

  it("one brand resolves, preferring the GTIN when both identifiers agree; none is product_not_found", () => {
    expect(resolveClaims({ gtin: [ex], asin: [ex] })).toEqual({ status: "resolved", brand: ex, resolved_by: "gtin" });
    expect(resolveClaims({ asin: [ex] })).toEqual({ status: "resolved", brand: ex, resolved_by: "asin" });
    expect(resolveClaims({ walmart_item_id: [ex], wpid: [ex] })).toEqual({ status: "resolved", brand: ex, resolved_by: "walmart_item_id" });
    expect(resolveClaims({ wpid: [ex] })).toEqual({ status: "resolved", brand: ex, resolved_by: "wpid" });
    expect(resolveClaims({})).toEqual({ status: "product_not_found" });
  });

  it("a brand name MUST NOT resolve a brand", () => {
    expect(validateVerifyRequest({ channel: amazon, brand_name: "Example Brand" }).valid).toBe(false);
    expect(validateResolveRequest({ product: { gtin: "012345678905" }, brand_name: "Example Brand" }).valid).toBe(false);
  });

  it("a resolve answer MUST NOT carry retailers", () => {
    expect(validateResolveResponse(fx("resolve-response/invalid/resolved-with-retailers.json")).valid).toBe(false);
  });

  it("every answer about a brand names it and how it was found; a mismatch names the other brands", () => {
    const authorized = fx("verify-response/valid/authorized.json");
    delete authorized.brand;
    expect(validateVerifyResponse(authorized).valid).toBe(false);
    const mismatch = fx("verify-response/valid/brand-mismatch.json");
    expect(validateVerifyResponse(mismatch).valid).toBe(true);
    delete mismatch.candidates;
    expect(validateVerifyResponse(mismatch).valid).toBe(false);
  });
});

describe("§3.1 product status, regions and details", () => {
  const amazon = { type: "amazon", domain: "amazon.com", seller_id: "A1B2C3D4E5F6G7" };

  it("a recalled product MUST name its recall notice", () => {
    const l = withCatalog();
    l.catalog![0]!.status = "recalled";
    expect(codes(validateList(l))).toContain("recall_url_required");
    l.catalog![0]!.recall_url = "https://www.cpsc.gov/Recalls/2026/example";
    expect(validateList(l).valid).toBe(true);
  });

  it("regions are country codes or named groups; EU has the 27 member states and not GB", () => {
    const l = withCatalog();
    l.catalog![0]!.regions = ["UK"];
    expect(codes(validateList(l))).toContain("invalid_region");
    l.catalog![0]!.regions = ["EU", "GB"];
    expect(validateList(l).valid).toBe(true);
    const eu = expandRegions(["EU"]);
    expect(eu.size).toBe(27);
    expect(eu.has("FR")).toBe(true);
    expect(eu.has("GB")).toBe(false);
    expect(productInRegion({ id: "x", name: "x", gtin: "96385074" }, "JP")).toBe(true);
  });

  it("an mpn or style_code MUST NOT find a product on its own", () => {
    expect(codes(validateVerifyRequest({ brand_domain: "brand.example", channel: amazon, product: { mpn: "EB-100" } }))).toContain("product_identifier_required");
    expect(validateVerifyRequest({ brand_domain: "brand.example", channel: amazon, product: { asin: "B0EXAMPLE1", mpn: "EB-100" } }).valid).toBe(true);
  });

  it("§9.3 a list that isn't public still shows the product's status, and nothing that identifies it", () => {
    const full = productResult(
      { id: "EB-1", name: "Tee", product_line: "Tees", gtin: "96385074", mpns: ["M-1"], status: "recalled", status_since: "2026-09-01", recall_url: "https://example.org/recall" },
      { gtin: "96385074", mpn: "M-2" },
    );
    expect(privateProductResult(full)).toEqual({ in_catalog: true, status: "recalled", status_since: "2026-09-01", recall_url: "https://example.org/recall", mismatched: ["mpn"] });
  });

  it("§9 channel.type can be left out: the domain implies it", () => {
    expect(normalizeVerifyRequest({ brand_domain: "brand.example", channel: { domain: "Walmart.com", seller_id: "1" } })).toMatchObject({ channel: { type: "walmart", domain: "walmart.com" } });
    expect(normalizeVerifyRequest({ brand_domain: "brand.example", channel: { domain: "shop.example" }, territory: "US" })).toMatchObject({ channel: { type: "web" } });
  });
});

describe("§3.2, §9.6 declared unauthorized sellers", () => {
  const unauthorized = () => fx("verify-response/valid/unauthorized.json");
  it("an unauthorized answer MUST name the declaration and carry no authorization, reason or observation", () => {
    expect(validateVerifyResponse(unauthorized()).valid).toBe(true);
    for (const f of ["unauthorized-no-declaration", "unauthorized-no-declared", "unauthorized-with-reason", "unauthorized-with-authorization", "unauthorized-observed"]) {
      expect(validateVerifyResponse(fx(`verify-response/invalid/${f}.json`)).valid, f).toBe(false);
    }
  });
  it("a disputed answer is about an authorization or a declaration, never both", () => {
    expect(validateVerifyResponse(fx("verify-response/valid/disputed.json")).valid).toBe(true);
    expect(validateVerifyResponse(fx("verify-response/valid/disputed-declaration.json")).valid).toBe(true);
    expect(validateVerifyResponse(fx("verify-response/invalid/disputed-both-ids.json")).valid).toBe(false);
  });
  it("a request that pins v0.3 MUST get the v0.3 answer: unlisted, with no declaration; others get the latest", () => {
    const v03 = { spec: "authorized-retailers/0.3" } as const;
    for (const status of ["unauthorized", "disputed"] as const) {
      const answer = { ...unauthorized(), status };
      const old = answerForRequest(answer, v03);
      expect(old.status).toBe("unlisted");
      expect(old).not.toHaveProperty("declaration_id");
      expect(old).not.toHaveProperty("declared");
      expect(validateVerifyResponse(old).valid).toBe(true);
      expect(answerForRequest(answer, {})).toEqual(answer);
      expect(answerForRequest(answer, { spec: "authorized-retailers/0.4" })).toEqual(answer);
    }
    const authorized = fx("verify-response/valid/authorized.json");
    expect(answerForRequest(authorized, v03)).toEqual(authorized);
    expect(answerForRequest(fx("verify-response/valid/disputed.json"), v03).status).toBe("disputed");
    expect(validateVerifyResponse(fx("verify-response/invalid/unlisted-with-declaration.json")).valid).toBe(false);
  });
  it("a request names v0.3 or v0.4", () => {
    expect(validateVerifyRequest(fx("verify-request/valid/spec-0.4.json")).valid).toBe(true);
    expect(validateVerifyRequest(fx("verify-request/invalid/spec-0.1.json")).valid).toBe(false);
  });
});
