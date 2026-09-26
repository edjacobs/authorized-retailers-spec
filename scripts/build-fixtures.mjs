// Generates fixtures/**.json and fixtures/manifest.json. Run: node scripts/build-fixtures.mjs
// Each invalid fixture is one targeted mutation of a valid base, so it fails for exactly one reason.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const JWS = "eyJhbGciOiJFZERTQSIsImtpZCI6ImFyLTIwMjYtMDkifQ..c2lnbmF0dXJlLXBsYWNlaG9sZGVy";
const brand = { name: "Example Brand", domain: "brand.example" };

const fullSigned = {
  spec: "authorized-retailers/0.1",
  form: "full",
  brand,
  issued: "2026-09-23T00:00:00Z",
  expires: "2026-12-22T00:00:00Z",
  authorizations: [
    {
      id: "auth_01J9X2",
      retailer: { name: "Example Retail LLC", entity_id: "ent_7Q4M" },
      channels: [
        { type: "amazon", marketplace: "US", seller_id: "A1B2C3D4E5F6G7" },
        { type: "walmart", marketplace: "US", seller_id: "101234567" },
        { type: "web", domain: "retailer.example" },
      ],
      scope: { territories: ["US", "CA"], product_lines: ["all"] },
      proposed_by: null,
      expires: "2026-12-22T00:00:00Z",
    },
  ],
  signature: { kid: "ar-2026-09", jws: JWS },
};
const { signature: _s, ...fullUnsigned } = fullSigned;

const pointer = {
  spec: "authorized-retailers/0.1",
  form: "pointer",
  brand,
  list: "https://authorizedretailers.ai/v0/brands/brand.example/list",
};
const priv = { spec: "authorized-retailers/0.1", form: "private", brand, verify: "https://authorizedretailers.ai/v0/verify" };

const request = {
  brand_domain: "brand.example",
  channel: { type: "amazon", marketplace: "US", seller_id: "A1B2C3D4E5F6G7" },
  territory: "US",
  product_line: "all",
};

const sig = { kid: "ar-2026-09", jws: JWS };
const authorized = {
  status: "authorized",
  authorization_id: "auth_01J9X2",
  expires: "2026-12-22T00:00:00Z",
  checked: "2026-09-23T14:02:11Z",
  valid_until: "2026-09-24T14:02:11Z",
  observed: null,
  signals: [],
  signature: sig,
};
const unlisted = { status: "unlisted", checked: authorized.checked, valid_until: authorized.valid_until, observed: null, signals: [], signature: sig };
const unverified = { ...unlisted, status: "brand_unverified", reason: "domain_unlinked" };

const clone = (o) => structuredClone(o);
const edit = (base, fn) => {
  const o = clone(base);
  fn(o);
  return o;
};
const auth0 = (fn) => edit(fullUnsigned, (f) => fn(f.authorizations[0]));

// [kind, name, document, expected error code or null for valid, note]
const cases = [
  // ---- files: valid
  ["file", "full-signed", fullSigned, null, "Section 5 example"],
  ["file", "full-unsigned-handwritten", fullUnsigned, null, "Section 5: hand-written unsigned files are accepted"],
  ["file", "full-no-authorizations", edit(fullUnsigned, (f) => (f.authorizations = [])), null, "A brand with nothing authorized"],
  [
    "file",
    "full-worldwide-physical-proposed",
    edit(fullSigned, (f) => {
      f.authorizations.push({
        id: "auth_02",
        retailer: { name: "Corner Shoes" },
        channels: [
          { type: "ebay", marketplace: "GB", seller_id: "cornershoes" },
          { type: "physical", address: "1 High St, London", country: "GB" },
        ],
        scope: { territories: ["*"], product_lines: ["running", "trail"] },
        proposed_by: { name: "Example Distribution Ltd", entity_id: "ent_DIST1" },
        expires: "2026-11-01T00:00:00Z",
      });
    }),
    null,
    "Worldwide scope, named product lines, eBay + physical, distributor-proposed",
  ],
  ["file", "full-max-expiry", edit(fullUnsigned, (f) => { f.expires = "2027-03-22T00:00:00Z"; }), null, "Exactly 180 days after issued (section 10)"],
  ["file", "full-fractional-seconds", edit(fullUnsigned, (f) => { f.issued = "2026-09-23T00:00:00.123Z"; }), null, "Fractional seconds are allowed"],
  ["file", "pointer", pointer, null, "Section 5 pointer form"],
  ["file", "private", priv, null, "Section 5 private form"],

  // ---- files: invalid, schema
  ["file", "full-no-channels", auth0((a) => (a.channels = [])), "schema", "Section 6: at least one channel identifier"],
  ["file", "full-name-only-retailer", auth0((a) => delete a.channels), "schema", "Section 6: a name alone is not verifiable"],
  ["file", "full-missing-scope", auth0((a) => delete a.scope), "schema", "Section 3: every authorization MUST carry a scope"],
  ["file", "full-missing-territories", auth0((a) => delete a.scope.territories), "schema", "Section 3: scope needs territories"],
  ["file", "full-missing-product-lines", auth0((a) => delete a.scope.product_lines), "schema", "Section 3: scope needs product lines"],
  ["file", "full-missing-authorization-expires", auth0((a) => delete a.expires), "schema", "Section 3: scope needs an expiry"],
  ["file", "full-empty-territories", auth0((a) => (a.scope.territories = [])), "schema", "Territories cannot be empty"],
  ["file", "full-wildcard-mixed", auth0((a) => (a.scope.territories = ["*", "US"])), "schema", "'*' must stand alone"],
  ["file", "full-lowercase-territory", auth0((a) => (a.scope.territories = ["us"])), "schema", "Country codes are uppercase alpha-2"],
  ["file", "full-all-mixed", auth0((a) => (a.scope.product_lines = ["all", "running"])), "schema", "'all' must stand alone"],
  ["file", "full-unknown-channel-type", auth0((a) => a.channels.push({ type: "shopify", domain: "shop.example" })), "schema", "Section 6: unlisted channel type"],
  ["file", "full-amazon-missing-seller-id", auth0((a) => delete a.channels[0].seller_id), "schema", "Section 6: amazon needs seller_id"],
  ["file", "full-web-missing-domain", auth0((a) => delete a.channels[2].domain), "schema", "Section 6: web needs domain"],
  ["file", "full-web-domain-is-url", auth0((a) => (a.channels[2].domain = "https://retailer.example/")), "schema", "Domains are bare hostnames"],
  ["file", "full-physical-only", auth0((a) => (a.channels = [{ type: "physical", address: "1 High St, London", country: "GB" }])), "no_online_channel", "Section 6: physical alone does not authorize"],
  ["file", "full-physical-missing-country", auth0((a) => a.channels.push({ type: "physical", address: "1 Main St" })), "schema", "Section 6: physical needs country"],
  ["file", "full-wrong-spec", edit(fullUnsigned, (f) => (f.spec = "authorized-retailers/1.0")), "schema", "Unknown spec version"],
  ["file", "full-missing-file-expires", edit(fullUnsigned, (f) => delete f.expires), "schema", "File needs expires"],
  ["file", "full-non-utc-timestamp", edit(fullUnsigned, (f) => (f.issued = "2026-09-23T00:00:00+01:00")), "schema", "Timestamps are UTC with Z"],
  ["file", "full-extra-property", edit(fullUnsigned, (f) => (f.price = 10)), "schema", "Section 1: no pricing; unknown properties rejected"],
  ["file", "full-attached-jws", edit(fullSigned, (f) => (f.signature.jws = "aGVhZA.cGF5bG9hZA.c2ln")), "schema", "Section 8: JWS must be detached"],
  ["file", "full-signature-missing-kid", edit(fullSigned, (f) => delete f.signature.kid), "schema", "Section 8: every signature names its kid"],
  ["file", "pointer-http-url", edit(pointer, (f) => (f.list = "http://authorizedretailers.ai/v0/brands/brand.example/list")), "schema", "Pointer must be HTTPS"],
  ["file", "private-missing-verify", edit(priv, (f) => delete f.verify), "schema", "Private form needs a verify endpoint"],
  ["file", "private-with-authorizations", edit(priv, (f) => (f.authorizations = fullSigned.authorizations)), "schema", "Section 5: private form carries no retailers"],
  ["file", "unknown-form", edit(priv, (f) => (f.form = "partial")), "schema", "Only full, pointer, private"],

  // ---- files: invalid, semantic
  ["file", "full-authorization-expires-after-file", auth0((a) => (a.expires = "2026-12-23T00:00:00Z")), "authorization_expires_after_file", "Section 5 MUST"],
  ["file", "full-expiry-over-180-days", edit(fullUnsigned, (f) => { f.expires = "2027-03-22T00:00:01Z"; }), "file_expiry_exceeds_max", "Section 10: max 180 days"],
  ["file", "full-expires-before-issued", edit(fullUnsigned, (f) => { f.expires = "2026-09-22T00:00:00Z"; f.authorizations[0].expires = "2026-09-22T00:00:00Z"; }), "expires_not_after_issued", "Expiry must follow issue"],
  ["file", "full-duplicate-authorization-id", edit(fullUnsigned, (f) => f.authorizations.push(clone(f.authorizations[0]))), "duplicate_authorization_id", "Authorization ids are unique within a file"],
  ["file", "full-impossible-date", edit(fullUnsigned, (f) => (f.issued = "2026-02-30T00:00:00Z")), "schema", "Feb 30 does not exist (format date-time; parseTimestamp also rejects it)"],

  // ---- verify request
  ["verify-request", "amazon", request, null, "Section 9 example"],
  ["verify-request", "web-no-product-line", { brand_domain: "brand.example", channel: { type: "web", domain: "retailer.example" }, territory: "CA" }, null, "product_line defaults to all"],
  ["verify-request", "physical-channel", edit(request, (r) => (r.channel = { type: "physical", address: "1 Main St", country: "US" })), "schema", "Section 6: physical is not verifiable"],
  ["verify-request", "wildcard-territory", edit(request, (r) => (r.territory = "*")), "schema", "A request names one territory"],
  ["verify-request", "missing-channel", edit(request, (r) => delete r.channel), "schema", "Channel is required"],
  ["verify-request", "retailer-name-only", edit(request, (r) => { delete r.channel; r.retailer = "Example Retail LLC"; }), "schema", "Section 6: agents match on identifiers, not names"],
  ["verify-request", "domain-with-scheme", edit(request, (r) => (r.brand_domain = "https://brand.example")), "schema", "Bare hostname only"],

  // ---- verify response: valid
  ["verify-response", "authorized", authorized, null, "Section 9 example"],
  ["verify-response", "authorized-observed", edit(authorized, (r) => (r.observed = { last_seen: "2026-09-20T00:00:00Z" })), null, "Section 7: seen selling within 30 days"],
  ["verify-response", "expired", edit(authorized, (r) => { r.status = "expired"; r.expires = "2026-09-01T00:00:00Z"; }), null, ""],
  ["verify-response", "disputed", edit(authorized, (r) => (r.status = "disputed")), null, ""],
  ["verify-response", "unlisted", unlisted, null, ""],
  ["verify-response", "brand-unverified-reason", unverified, null, "Section 9 reason"],
  ["verify-response", "brand-unverified-no-reason", edit(unverified, (r) => delete r.reason), null, "reason is optional"],
  ["verify-response", "with-signal", edit(authorized, (r) => r.signals.push({ type: "account_name_changed", observed: "2026-09-20T00:00:00Z", detail: "Storefront name changed" })), null, "Section 7 signals"],

  // ---- verify response: invalid
  ["verify-response", "missing-observed", edit(authorized, (r) => delete r.observed), "schema", "Section 7: every answer MUST carry observed"],
  ["verify-response", "unlisted-observed", edit(unlisted, (r) => (r.observed = { last_seen: "2026-09-20T00:00:00Z" })), "schema", "Section 7: observed is null unless authorized"],
  ["verify-response", "observed-without-last-seen", edit(authorized, (r) => (r.observed = {})), "schema", "Section 7: observed carries last_seen"],
  ["verify-response", "with-tier", edit(authorized, (r) => (r.tier = "brand_attested")), "schema", "Evidence tiers were removed (section 7)"],
  ["verify-response", "unlisted-with-reason", edit(unlisted, (r) => (r.reason = "domain_unlinked")), "schema", "Section 9: reason only on brand_unverified"],
  ["verify-response", "unlisted-with-authorization-id", edit(unlisted, (r) => (r.authorization_id = "auth_01J9X2")), "schema", "Unlisted answers leak nothing about other authorizations"],
  ["verify-response", "authorized-missing-authorization-id", edit(authorized, (r) => delete r.authorization_id), "schema", ""],
  ["verify-response", "missing-valid-until", edit(authorized, (r) => delete r.valid_until), "schema", "Section 9: valid_until is required"],
  ["verify-response", "missing-signature", edit(authorized, (r) => delete r.signature), "schema", "Answers are signed"],
  ["verify-response", "unknown-status", edit(authorized, (r) => (r.status = "unlawful")), "schema", "Section 1: unlisted is not unlawful"],
  ["verify-response", "valid-until-over-24h", edit(authorized, (r) => (r.valid_until = "2026-09-24T14:02:12Z")), "valid_until_exceeds_max", "Section 9 MUST"],
  ["verify-response", "valid-until-before-checked", edit(authorized, (r) => (r.valid_until = "2026-09-23T14:02:11Z")), "valid_until_not_after_checked", ""],
];

rmSync(root, { recursive: true, force: true });
const manifest = [];
for (const [kind, name, doc, expect, note] of cases) {
  const rel = `${kind}/${expect === null ? "valid" : "invalid"}/${name}.json`;
  mkdirSync(join(root, dirname(rel)), { recursive: true });
  writeFileSync(join(root, rel), JSON.stringify(doc, null, 2) + "\n");
  manifest.push({ path: rel, kind, valid: expect === null, ...(expect ? { expect } : {}), ...(note ? { note } : {}) });
}
writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${manifest.length} fixtures`);
