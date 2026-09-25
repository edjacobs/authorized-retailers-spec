import { describe, expect, it } from "vitest";
import { channelKey, normalizeVerifyRequest, parseTimestamp, validateVerifyRequest } from "../src";

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
});

describe("channelKey", () => {
  it("normalizes case, whitespace, www and the UK alias", () => {
    expect(channelKey({ type: "amazon", marketplace: "UK", seller_id: " a1b2c3 " })).toBe("amazon:GB:A1B2C3");
    expect(channelKey({ type: "ebay", marketplace: "US", seller_id: "CornerShoes" })).toBe("ebay:US:cornershoes");
    expect(channelKey({ type: "web", domain: "WWW.Retailer.Example." })).toBe("web:retailer.example");
    expect(channelKey({ type: "walmart", marketplace: "us", seller_id: "101234567" })).toBe("walmart:US:101234567");
  });
});

describe("normalizeVerifyRequest", () => {
  it("turns sloppy agent input into a valid canonical request", () => {
    const raw = {
      brand_domain: " WWW.Brand.Example ",
      channel: { type: "Amazon", marketplace: "us", seller_id: " A1B2C3D4E5F6G7 " },
      territory: "uk",
    };
    const norm = normalizeVerifyRequest(raw);
    expect(norm).toEqual({
      brand_domain: "brand.example",
      channel: { type: "amazon", marketplace: "US", seller_id: "A1B2C3D4E5F6G7" },
      territory: "GB",
    });
    expect(validateVerifyRequest(norm).valid).toBe(true);
    expect(validateVerifyRequest(raw).valid).toBe(false);
  });
  it("passes non-objects through for the validator to reject", () => {
    expect(normalizeVerifyRequest("nope")).toBe("nope");
    expect(validateVerifyRequest(normalizeVerifyRequest(null)).valid).toBe(false);
  });
});

describe("validateScope / validateChannel", () => {
  it("accept valid values and reject invalid ones", async () => {
    const { validateScope, validateChannel } = await import("../src");
    expect(validateScope({ territories: ["*"], product_lines: ["all"] }).valid).toBe(true);
    expect(validateScope({ territories: ["*", "US"], product_lines: ["all"] }).valid).toBe(false);
    expect(validateScope({ territories: ["US"] }).valid).toBe(false);
    expect(validateChannel({ type: "web", domain: "shop.example.com" }).valid).toBe(true);
    expect(validateChannel({ type: "amazon", marketplace: "US" }).valid).toBe(false);
  });
});

describe("normalizeChannel", () => {
  it("canonicalizes each channel type", async () => {
    const { normalizeChannel, validateChannel } = await import("../src");
    expect(normalizeChannel({ type: " Amazon ", marketplace: "uk", seller_id: " a1 " })).toEqual({ type: "amazon", marketplace: "GB", seller_id: "a1" });
    expect(normalizeChannel({ type: "web", domain: "WWW.Shop.Example." })).toEqual({ type: "web", domain: "shop.example" });
    const phys = normalizeChannel({ type: "physical", address: " 1 High St ", country: "gb" });
    expect(phys).toEqual({ type: "physical", address: "1 High St", country: "GB" });
    expect(validateChannel(phys).valid).toBe(true);
    expect(normalizeChannel(null)).toBeNull();
  });
});
