import { describe, expect, it } from "vitest";
import {
  channelKey,
  effectiveTerritories,
  isValidAsin,
  isValidGtin,
  normalizeChannel,
  normalizeVerifyRequest,
  parseAsOf,
  parseTimestamp,
  territoryForDomain,
  toGtin14,
  validateChannel,
  validateProduct,
  validateScope,
  validateVerifyRequest,
  type Authorization,
} from "../src";

describe("parseTimestamp", () => {
  it("parses UTC timestamps", () => {
    expect(parseTimestamp("2026-09-23T00:00:00Z")).toBe(Date.UTC(2026, 8, 23));
    expect(parseTimestamp("2026-09-23T00:00:00.5Z")).toBe(Date.UTC(2026, 8, 23) + 500);
  });
  it("rejects impossible and non-UTC dates", () => {
    expect(parseTimestamp("2026-02-30T00:00:00Z")).toBeNull();
    expect(parseTimestamp("2026-09-23T24:00:00Z")).toBeNull();
    expect(parseTimestamp("2026-09-23T00:00:00+01:00")).toBeNull();
    expect(parseTimestamp("2026-09-23")).toBeNull();
  });
  it("parseAsOf reads a bare date as the start of that day, UTC", () => {
    expect(parseAsOf("2026-09-28")).toBe(Date.UTC(2026, 8, 28));
    expect(parseAsOf("2026-09-28T12:00:00Z")).toBe(Date.UTC(2026, 8, 28, 12));
    expect(parseAsOf("2026-02-30")).toBeNull();
  });
});

describe("§6.1 channelKey", () => {
  it("normalizes domains and seller IDs per type", () => {
    expect(channelKey({ type: "amazon", domain: "Amazon.co.uk", seller_id: " a1b2c3 " })).toBe("amazon:amazon.co.uk:A1B2C3");
    expect(channelKey({ type: "ebay", domain: "ebay.com", seller_id: "CornerShoes" })).toBe("ebay:ebay.com:cornershoes");
    expect(channelKey({ type: "walmart", domain: "walmart.com", seller_id: "Ab12" })).toBe("walmart:walmart.com:Ab12");
    expect(channelKey({ type: "web", domain: "WWW.Retailer.Example." })).toBe("web:retailer.example");
  });
  it("keeps the same seller ID on different marketplace domains apart", () => {
    expect(channelKey({ type: "amazon", domain: "amazon.com", seller_id: "A1" })).not.toBe(channelKey({ type: "amazon", domain: "amazon.ca", seller_id: "A1" }));
  });
});

describe("§6.2 territoryForDomain", () => {
  it("reads marketplace domains from the table", () => {
    expect(territoryForDomain("amazon.com")).toBe("US");
    expect(territoryForDomain("amazon.co.uk")).toBe("GB");
    expect(territoryForDomain("ebay.com.au")).toBe("AU");
    expect(territoryForDomain("walmart.ca")).toBe("CA");
  });
  it("reads country-code domains, with uk as GB", () => {
    expect(territoryForDomain("footlocker.co.uk")).toBe("GB");
    expect(territoryForDomain("shop.de")).toBe("DE");
    expect(territoryForDomain("www.store.ca")).toBe("CA");
  });
  it("treats generic domains and generic-use ccTLDs as having no territory", () => {
    for (const d of ["footlocker.com", "store.net", "brand.shop", "startup.io", "brand.co", "maker.ai", "shop.tv", "brand.eu"]) {
      expect(territoryForDomain(d)).toBeNull();
    }
  });
  it("gives each channel its effective territories", () => {
    const a = (territories?: string[]) => ({ scope: territories ? { territories, product_lines: ["all"] } : { product_lines: ["all"] } }) as Authorization;
    const amazonUS = { type: "amazon", domain: "amazon.com", seller_id: "A1" } as const;
    expect(effectiveTerritories(a(), amazonUS)).toEqual(["US"]);
    expect(effectiveTerritories(a(["US", "CA"]), amazonUS)).toEqual(["US"]);
    expect(effectiveTerritories(a(["CA"]), amazonUS)).toEqual([]);
    expect(effectiveTerritories(a(["*"]), amazonUS)).toEqual(["US"]);
    expect(effectiveTerritories(a(), { type: "web", domain: "shop.co.uk" })).toEqual(["GB"]);
    expect(effectiveTerritories(a(["IE"]), { type: "web", domain: "shop.co.uk" })).toEqual(["IE"]);
    expect(effectiveTerritories(a(), { type: "web", domain: "shop.example" })).toEqual([]);
  });
});

describe("§3.1 product identifiers", () => {
  it("checks GTIN check digits for every length", () => {
    expect(isValidGtin("96385074")).toBe(true); // GTIN-8
    expect(isValidGtin("012345678905")).toBe(true); // UPC-A
    expect(isValidGtin("4006381333931")).toBe(true); // EAN-13
    expect(isValidGtin("00012345678905")).toBe(true); // GTIN-14
    expect(isValidGtin("4006381333932")).toBe(false);
    expect(isValidGtin("12345678905")).toBe(false); // 11 digits
  });
  it("compares GTINs as GTIN-14", () => {
    expect(toGtin14("012345678905")).toBe("00012345678905");
    expect(() => toGtin14("123")).toThrow();
  });
  it("checks ASINs", () => {
    expect(isValidAsin("B0EXAMPLE1")).toBe(true);
    expect(isValidAsin("b0example1")).toBe(false);
    expect(isValidAsin("B0EXAMPLE")).toBe(false);
  });
  it("validateProduct names each problem", () => {
    expect(validateProduct({ id: "A", name: "Tee", gtin: "96385074" }).valid).toBe(true);
    expect(validateProduct({ id: "A", name: "Tee" }).errors.map((e) => e.code)).toContain("product_without_identifier");
    expect(validateProduct({ id: "A", name: "Tee", gtin: "96385075" }).errors.map((e) => e.code)).toContain("invalid_gtin");
  });
});

describe("normalizeVerifyRequest", () => {
  it("turns sloppy agent input into a valid canonical request", () => {
    const raw = {
      brand_domain: " WWW.Brand.Example ",
      channel: { type: "Amazon", domain: "WWW.Amazon.co.uk", seller_id: " A1B2C3D4E5F6G7 " },
      territory: "uk",
      product: { gtin: "0 12345-67890 5" },
    };
    const norm = normalizeVerifyRequest(raw);
    expect(norm).toEqual({
      brand_domain: "brand.example",
      channel: { type: "amazon", domain: "amazon.co.uk", seller_id: "A1B2C3D4E5F6G7" },
      territory: "GB",
      product: { gtin: "012345678905" },
    });
    expect(validateVerifyRequest(norm).valid).toBe(true);
    expect(validateVerifyRequest(raw).valid).toBe(false);
  });
  it("uppercases ASINs", () => {
    expect(normalizeVerifyRequest({ product: { asin: " b0example1 " } })).toMatchObject({ product: { asin: "B0EXAMPLE1" } });
  });
  it("passes non-objects through for the validator to reject", () => {
    expect(normalizeVerifyRequest("nope")).toBe("nope");
    expect(validateVerifyRequest(normalizeVerifyRequest(null)).valid).toBe(false);
  });
});

describe("validateScope / validateChannel", () => {
  it("accept valid values and reject invalid ones", () => {
    expect(validateScope({ territories: ["*"], product_lines: ["all"] }).valid).toBe(true);
    expect(validateScope({ products: ["EB-1"] }).valid).toBe(true);
    expect(validateScope({ territories: ["*", "US"], product_lines: ["all"] }).valid).toBe(false);
    expect(validateScope({ territories: ["US"] }).valid).toBe(false);
    expect(validateScope({ territories: ["UK"], product_lines: ["all"] }).errors.map((e) => e.code)).toContain("invalid_country");
    expect(validateChannel({ type: "web", domain: "shop.example.com" }).valid).toBe(true);
    expect(validateChannel({ type: "amazon", domain: "amazon.de", seller_id: "A1" }).valid).toBe(true);
    expect(validateChannel({ type: "amazon", marketplace: "US", seller_id: "A1" }).errors.map((e) => e.code)).toContain("marketplace_field_removed");
    expect(validateChannel({ type: "ebay", domain: "amazon.com", seller_id: "x" }).errors.map((e) => e.code)).toContain("marketplace_domain_mismatch");
    expect(validateChannel({ type: "physical", address: "1 High St", country: "GB" }).errors.map((e) => e.code)).toContain("unknown_channel_type");
  });
});

describe("normalizeChannel", () => {
  it("canonicalizes each channel type", () => {
    expect(normalizeChannel({ type: " Amazon ", domain: "WWW.AMAZON.COM", seller_id: " a1 " })).toEqual({ type: "amazon", domain: "amazon.com", seller_id: "a1" });
    expect(normalizeChannel({ type: "web", domain: "WWW.Shop.Example." })).toEqual({ type: "web", domain: "shop.example" });
    expect(normalizeChannel(null)).toBeNull();
  });
});

describe("normalizeVerifyRequest with no channel", () => {
  it("leaves the key out, so validation refuses the request instead of throwing", () => {
    const out = normalizeVerifyRequest({ brand_domain: "Brand.example" }) as Record<string, unknown>;
    expect("channel" in out).toBe(false);
    expect(validateVerifyRequest(out).valid).toBe(false);
    expect(validateVerifyRequest(normalizeVerifyRequest({})).valid).toBe(false);
  });
});
