// One test (or more) per MUST rule the spec package can enforce. See docs/MUST-coverage.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authorizationsForChannel,
  channelKey,
  matchRequest,
  validAuthorizations,
  validateFile,
  validateList,
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
