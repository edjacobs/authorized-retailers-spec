// One test (or more) per MUST rule the spec package can enforce. See docs/MUST-coverage.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authorizationsForChannel,
  channelKey,
  validAuthorizations,
  validateFile,
  validateFullFile,
  validateVerifyRequest,
  validateVerifyResponse,
  type FullFile,
} from "../src";

const fx = (p: string) => JSON.parse(readFileSync(join(import.meta.dirname, "..", "fixtures", p), "utf8"));
const signed = (): FullFile => fx("file/valid/full-signed.json");
const at = (iso: string) => Date.parse(iso);

describe("§3 each authorization MUST carry a scope (territories, channels, product lines, expiry)", () => {
  for (const drop of ["scope", "channels", "expires"] as const) {
    it(`rejects an authorization without ${drop}`, () => {
      const f = signed() as unknown as { authorizations: Record<string, unknown>[] };
      delete f.authorizations[0]![drop];
      expect(validateFile(f).valid).toBe(false);
    });
  }
  for (const drop of ["territories", "product_lines"] as const) {
    it(`rejects a scope without ${drop}`, () => {
      const f = signed() as unknown as { authorizations: { scope: Record<string, unknown> }[] };
      delete f.authorizations[0]!.scope[drop];
      expect(validateFile(f).valid).toBe(false);
    });
  }
});

describe("§5 an authorization's expires MUST NOT be later than the file's expires", () => {
  it("accepts equal", () => {
    expect(validateFullFile(signed()).valid).toBe(true);
  });
  it("rejects one second later", () => {
    const f = signed();
    f.authorizations[0]!.expires = "2026-12-22T00:00:01Z";
    const r = validateFullFile(f);
    expect(r.valid).toBe(false);
    expect(r.errors.map((e) => e.code)).toEqual(["authorization_expires_after_file"]);
    expect(r.errors[0]!.path).toBe("/authorizations/0/expires");
  });
});

describe("§5 readers MUST treat an expired file as containing no valid authorizations", () => {
  it("returns the authorizations before expiry", () => {
    expect(validAuthorizations(signed(), at("2026-10-01T00:00:00Z"))).toHaveLength(1);
  });
  it("returns none at and after the file's expiry", () => {
    expect(validAuthorizations(signed(), at("2026-12-22T00:00:00Z"))).toEqual([]);
    expect(validAuthorizations(signed(), at("2027-01-01T00:00:00Z"))).toEqual([]);
  });
  it("returns none even if an authorization claims a later expiry (malformed file)", () => {
    const f = signed();
    f.expires = "2026-10-01T00:00:00Z";
    expect(validAuthorizations(f, at("2026-11-01T00:00:00Z"))).toEqual([]);
  });
  it("drops individually expired authorizations from a live file", () => {
    const f = signed();
    f.authorizations[0]!.expires = "2026-10-01T00:00:00Z";
    expect(validAuthorizations(f, at("2026-11-01T00:00:00Z"))).toEqual([]);
  });
});

describe("§5 readers MUST treat an unsigned file as no file, and a file vouches only for its own domain", () => {
  // An unsigned file is still well-formed JSON for the schema; checkPublishedFile is what refuses it.
  // Tested with real keys in test/jws.test.ts.
  it("a hand-written file validates against the schema but carries no signature", () => {
    const f = fx("file/valid/full-unsigned-handwritten.json");
    expect(validateFile(f).valid).toBe(true);
    expect(f.signature).toBeUndefined();
  });
});

describe("§6 every authorization MUST name at least one channel identifier", () => {
  it("rejects an empty channel list", () => {
    expect(validateFile(fx("file/invalid/full-no-channels.json")).valid).toBe(false);
  });
  it("rejects a name-only retailer", () => {
    expect(validateFile(fx("file/invalid/full-name-only-retailer.json")).valid).toBe(false);
  });
});

describe("§6 agents MUST match on the channel identifier, never the retailer name", () => {
  const f = signed();
  it("matches a different retailer name with the same identifier", () => {
    const renamed = structuredClone(f.authorizations);
    renamed[0]!.retailer.name = "Totally Different Name Inc";
    expect(authorizationsForChannel(renamed, { type: "amazon", marketplace: "US", seller_id: "A1B2C3D4E5F6G7" })).toHaveLength(1);
  });
  it("does not match the same retailer name with a different identifier", () => {
    expect(authorizationsForChannel(f.authorizations, { type: "amazon", marketplace: "US", seller_id: "ZZZZZZZZZZZZZZ" })).toEqual([]);
  });
  it("does not match the same seller id in a different marketplace", () => {
    expect(authorizationsForChannel(f.authorizations, { type: "amazon", marketplace: "CA", seller_id: "A1B2C3D4E5F6G7" })).toEqual([]);
  });
  it("does not match the same seller id on a different platform", () => {
    expect(authorizationsForChannel(f.authorizations, { type: "walmart", marketplace: "US", seller_id: "A1B2C3D4E5F6G7" })).toEqual([]);
  });
  it("verify requests cannot carry a retailer name instead of an identifier", () => {
    expect(validateVerifyRequest(fx("verify-request/invalid/retailer-name-only.json")).valid).toBe(false);
  });
  it("physical channels never match (not verifiable by agents)", () => {
    expect(channelKey({ type: "physical", address: "1 High St", country: "GB" })).toBeNull();
  });
});

describe("§7 every answer MUST carry observed, null unless authorized", () => {
  it("rejects an answer with no observed field", () => {
    expect(validateVerifyResponse(fx("verify-response/invalid/missing-observed.json")).valid).toBe(false);
  });
  it("allows last_seen on authorized answers only", () => {
    expect(validateVerifyResponse(fx("verify-response/valid/authorized.json")).valid).toBe(true);
    expect(validateVerifyResponse(fx("verify-response/valid/authorized-observed.json")).valid).toBe(true);
    expect(validateVerifyResponse(fx("verify-response/invalid/unlisted-observed.json")).valid).toBe(false);
    expect(validateVerifyResponse(fx("verify-response/invalid/observed-without-last-seen.json")).valid).toBe(false);
  });
  it("has no evidence tier", () => {
    expect(validateVerifyResponse(fx("verify-response/invalid/with-tier.json")).valid).toBe(false);
  });
});

describe("§9 every signed answer MUST carry valid_until, no later than 24h after checked", () => {
  it("rejects a missing valid_until", () => {
    expect(validateVerifyResponse(fx("verify-response/invalid/missing-valid-until.json")).valid).toBe(false);
  });
  it("accepts exactly 24h", () => {
    expect(validateVerifyResponse(fx("verify-response/valid/authorized-observed.json")).valid).toBe(true);
  });
  it("rejects 24h plus one second", () => {
    const r = validateVerifyResponse(fx("verify-response/invalid/valid-until-over-24h.json"));
    expect(r.errors.map((e) => e.code)).toEqual(["valid_until_exceeds_max"]);
  });
});

describe("§9 reason MUST NOT appear on any status other than brand_unverified", () => {
  for (const status of ["authorized", "unlisted", "expired", "disputed"]) {
    it(`rejects reason on ${status}`, () => {
      const base = fx(status === "unlisted" ? "verify-response/valid/unlisted.json" : "verify-response/valid/authorized-observed.json");
      base.status = status;
      base.reason = "domain_unlinked";
      expect(validateVerifyResponse(base).valid).toBe(false);
    });
  }
});

describe("§5 private form carries no retailers (supports §9 private-mode MUST)", () => {
  it("rejects a private file with authorizations", () => {
    expect(validateFile(fx("file/invalid/private-with-authorizations.json")).valid).toBe(false);
  });
  it("rejects an unlisted answer that names an authorization", () => {
    expect(validateVerifyResponse(fx("verify-response/invalid/unlisted-with-authorization-id.json")).valid).toBe(false);
  });
});

describe("§8 every signature names its kid", () => {
  it("rejects a signature without kid", () => {
    expect(validateFile(fx("file/invalid/full-signature-missing-kid.json")).valid).toBe(false);
  });
});
