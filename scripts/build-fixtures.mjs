// Generates fixtures/**.json and fixtures/manifest.json. Run: node scripts/build-fixtures.mjs
// Each invalid fixture is one targeted mutation of a valid base, so it fails for exactly one reason.
// "match" fixtures pair a public list with a verify request and the answer section 9 requires, so
// other implementations can check their matching against the same cases.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
const SPEC = "authorized-retailers/0.3";
const JWS = "eyJhbGciOiJFZERTQSIsImtpZCI6ImFyLTIwMjYwOTI4LTZlMzcifQ..c2lnbmF0dXJlLXBsYWNlaG9sZGVy";
const sig = { kid: "ar-20260928-6e37", jws: JWS };

const clone = (o) => structuredClone(o);
const edit = (base, fn) => {
  const o = clone(base);
  fn(o);
  return o;
};

// ---- pointer (section 5.1)
const pointer = {
  spec: SPEC,
  form: "pointer",
  brand: { name: "Example Brand", domain: "brand.example" },
  verify_token: "tok_4f9KqX2mB7cD1eR8",
  list: "https://authorizedretailers.ai/v0/brands/brand.example/list",
};

// ---- signed list (section 5.2)
const times = { issued: "2026-09-28T14:00:00Z", valid_until: "2026-09-28T14:15:00Z", stale_until: "2026-09-29T14:00:00Z" };
const catalog = [
  { id: "EB-TEE-BLK-M", name: "Classic Tee, Black, M", product_line: "Classic Tee", attributes: { color: "Black", size: "M" }, gtin: "00012345678905", asins: ["B0EXAMPLE1"], mpns: ["EB-100-BLK"], style_code: "EB-TEE" },
  { id: "EB-TEE-WHT-M", name: "Classic Tee, White, M", product_line: "Classic Tee", gtin: "4006381333931", asins: ["B0EXAMPLE2"] },
  { id: "EB-RUN-V2", name: "Runner V2", product_line: "Running", gtin: "96385074" },
  { id: "EB-RUN-V3", name: "Runner V3", product_line: "Running", asins: ["B0EXAMPLE3"] },
  { id: "EB-DTC-1", name: "Founders Edition", product_line: "Limited", gtin: "12345678901231" },
  { id: "EB-TEE-US", name: "Classic Tee, US formula dye", product_line: "Classic Tee", gtin: "012345678912", regions: ["US"] },
  { id: "EB-TEE-EU", name: "Classic Tee, EU formula dye", product_line: "Classic Tee", gtin: "4012345678901", regions: ["EU"] },
  { id: "EB-TEE-OLD", name: "Classic Tee, 2019 dye", product_line: "Classic Tee", gtin: "012345678929", status: "recalled", status_since: "2026-09-01", recall_url: "https://www.cpsc.gov/Recalls/2026/example" },
];
const retailer = {
  id: "auth_01J9X2",
  revocation_id: "rv_Q2l8dX4bT0aN5kPw",
  retailer: { name: "Example Retail LLC", entity_id: "ent_7Q4M" },
  channels: [
    { type: "amazon", domain: "amazon.com", seller_id: "A1B2C3D4E5F6G7" },
    { type: "walmart", domain: "walmart.com", seller_id: "101234567" },
    { type: "web", domain: "retailer.example" },
  ],
  scope: { territories: ["US"], product_lines: ["all"] },
  proposed_by: null,
};
const listNoCatalog = { spec: SPEC, brand: { name: "Example Brand", domains: ["brand.example"] }, public: true, ...times, authorizations: [retailer], signature: sig };
const listWithCatalog = edit(listNoCatalog, (l) => {
  l.brand.domains.push("brand.co.uk");
  l.catalog = clone(catalog);
  l.exclusions = { products: ["EB-DTC-1"] };
  l.authorizations[0].scope = { territories: ["US"], product_lines: ["Classic Tee"] };
});
const notPublic = { spec: SPEC, brand: { name: "Example Brand", domains: ["brand.example"] }, public: false, ...times, signature: sig };
const auth0 = (base, fn) => edit(base, (l) => fn(l.authorizations[0]));
const noCatalog = (fn) => auth0(listNoCatalog, fn);

// ---- verify request / response (section 9)
const request = {
  brand_domain: "brand.example",
  channel: { type: "amazon", domain: "amazon.com", seller_id: "A1B2C3D4E5F6G7" },
  territory: "US",
  product: { asin: "B0EXAMPLE1" },
  as_of: "2026-09-28",
};
const exampleBrand = { domain: "brand.example", name: "Example Brand" };
const otherBrand = { domain: "other.example", name: "Other Brand" };
const authorized = {
  status: "authorized",
  brand: exampleBrand,
  resolved_by: "brand_domain",
  authorization_id: "auth_01J9X2",
  revocation_id: "rv_Q2l8dX4bT0aN5kPw",
  checked: "2026-09-28T14:02:11Z",
  valid_until: "2026-09-28T14:17:11Z",
  stale_until: "2026-09-29T14:02:11Z",
  product: { in_catalog: true, id: "EB-TEE-BLK-M", product_line: "Classic Tee" },
  observed: null,
  signals: [],
  signature: sig,
};
const base = { checked: authorized.checked, valid_until: authorized.valid_until, stale_until: authorized.stale_until, observed: null, signals: [], signature: sig };
const unlisted = { status: "unlisted", brand: exampleBrand, resolved_by: "brand_domain", ...base };
const notRegistered = { status: "brand_not_registered", reason: "domain_unlinked", brand: { domain: "brand.example" }, resolved_by: "brand_domain", ...base };
const productNotFound = { status: "product_not_found", product: { in_catalog: false }, ...base };
const ambiguous = { status: "brand_ambiguous", candidates: [exampleBrand, otherBrand], product: { in_catalog: true }, ...base };
const mismatch = { status: "brand_mismatch", brand: exampleBrand, resolved_by: "brand_domain", candidates: [otherBrand], product: { in_catalog: false }, ...base };

// ---- resolve (section 9.5)
const resolved = { status: "resolved", brand: exampleBrand, resolved_by: "gtin", checked: base.checked, valid_until: base.valid_until, stale_until: base.stale_until, signature: sig };

// ---- revocation feed (section 10.3)
const feed = {
  spec: SPEC,
  feed: "revocations",
  issued: "2026-09-28T14:02:00Z",
  valid_until: "2026-09-28T14:17:00Z",
  stale_until: "2026-09-29T14:02:00Z",
  entries: [{ revocation_id: "rv_Z9y8X7w6V5u4T3s2", revoked: "2026-09-28T13:40:12Z" }],
  signature: sig,
};

// ---- matching (section 9)
const NOW = "2026-09-28T14:05:00Z";
const matchList = edit(listWithCatalog, (l) => {
  l.authorizations = [
    // Amazon US seller: Classic Tee only, except the white one.
    { ...clone(retailer), scope: { territories: ["US"], product_lines: ["Classic Tee"], exclude_products: ["EB-TEE-WHT-M"] } },
    // Web store worldwide: everything except the Running line.
    {
      id: "auth_02",
      revocation_id: "rv_A1b2C3d4E5f6G7h8",
      retailer: { name: "Global Shoes" },
      channels: [{ type: "web", domain: "globalshoes.example" }],
      scope: { territories: ["*"], product_lines: ["all"], exclude_product_lines: ["Running"] },
    },
    // UK store on a ccTLD, one named product, with an end date in the past.
    {
      id: "auth_03",
      revocation_id: "rv_J9k8L7m6N5o4P3q2",
      retailer: { name: "UK Runners" },
      channels: [{ type: "web", domain: "ukrunners.co.uk" }],
      scope: { products: ["EB-RUN-V3"] },
      expires: "2026-09-01T00:00:00Z",
    },
    // Amazon UK seller: all products, including the Founders Edition by name (the brand excludes it).
    {
      id: "auth_04",
      revocation_id: "rv_R1s2T3u4V5w6X7y8",
      retailer: { name: "Brit Retail" },
      channels: [{ type: "amazon", domain: "amazon.co.uk", seller_id: "A9Z8Y7X6W5V4U3" }],
      scope: { product_lines: ["all"], products: ["EB-DTC-1"] },
    },
  ];
});
// A second registered brand: shares one GTIN with Example Brand and has an ASIN of its own.
const otherList = {
  spec: SPEC,
  brand: { name: "Other Brand", domains: ["other.example"], aliases: ["Other"] },
  public: true,
  ...times,
  catalog: [
    { id: "OB-HAT", name: "Other Hat", gtin: "4006381333931" },
    { id: "OB-CAP", name: "Other Cap", asins: ["B0OTHER001"] },
  ],
  authorizations: [],
  signature: sig,
};
const resolveCase = (product, expect) => ({ lists: [matchList, otherList], product, expect });
const amazonUS = { type: "amazon", domain: "amazon.com", seller_id: "A1B2C3D4E5F6G7" };
const amazonUK = { type: "amazon", domain: "amazon.co.uk", seller_id: "A9Z8Y7X6W5V4U3" };
const global = { type: "web", domain: "globalshoes.example" };
const req = (channel, extra = {}) => ({ brand_domain: "brand.example", channel, ...extra });
const match = (request, expect) => ({ list: matchList, request, now: NOW, expect });

// [kind, name, document, expected error code or null for valid, note, extra manifest fields]
const cases = [
  // ---- pointer: valid
  ["pointer", "pointer", pointer, null, "Section 5.1 example", { fetched_from: "brand.example" }],
  ["pointer", "pointer-v0.2", edit(pointer, (p) => (p.spec = "authorized-retailers/0.2")), null, "Section 5.1: a pointer published under v0.2 stays valid", { fetched_from: "brand.example" }],
  ["pointer", "pointer-fetched-via-www", pointer, null, "Section 5.1: www is ignored when matching the domain", { fetched_from: "www.brand.example" }],

  // ---- pointer: invalid
  ["pointer", "pointer-other-host", edit(pointer, (p) => (p.list = "https://lists.example/brand.example")), "list_not_on_registry", "Section 5.1: list MUST be on authorizedretailers.ai"],
  ["pointer", "pointer-http-url", edit(pointer, (p) => (p.list = "http://authorizedretailers.ai/v0/brands/brand.example/list")), "schema", "Pointer list must be HTTPS"],
  ["pointer", "pointer-missing-verify-token", edit(pointer, (p) => delete p.verify_token), "schema", "Section 5.1: verify_token is required"],
  ["pointer", "pointer-domain-mismatch", pointer, "brand_domain_mismatch", "Section 5.1: a pointer vouches only for its own domain", { fetched_from: "other.example" }],
  ["pointer", "full-form", edit(pointer, (p) => { p.form = "full"; p.authorizations = []; }), "form_not_supported", "v0.1 full form was removed"],
  ["pointer", "private-form", edit(pointer, (p) => (p.form = "private")), "form_not_supported", "v0.1 private form was removed"],
  ["pointer", "unknown-form", edit(pointer, (p) => (p.form = "partial")), "form_not_supported", "Only pointer"],
  ["pointer", "pointer-wrong-spec", edit(pointer, (p) => (p.spec = "authorized-retailers/0.1")), "schema", "A pointer names 0.2 or 0.3"],

  // ---- list: valid
  ["list", "list-no-catalog", listNoCatalog, null, "Section 5.2, no catalog"],
  ["list", "list-catalog-line-scope", listWithCatalog, null, "Section 3.1: catalog with a line-scoped authorization and a brand exclusion"],
  ["list", "list-product-scope", auth0(listWithCatalog, (a) => (a.scope = { territories: ["US"], products: ["EB-TEE-BLK-M", "EB-RUN-V3"] })), null, "Section 3.1: authorization scoped to named products"],
  ["list", "list-no-expires", listNoCatalog, null, "Section 10: no end date, lasts until revoked"],
  ["list", "list-with-expires", noCatalog((a) => (a.expires = "2027-09-28T00:00:00Z")), null, "Section 10: brand-set end date"],
  ["list", "list-generic-web-territories", noCatalog((a) => { a.channels = [{ type: "web", domain: "retailer.example" }]; a.scope = { territories: ["US", "CA"], product_lines: ["all"] }; }), null, "Section 6.2: generic-domain web store lists territories"],
  ["list", "list-cctld-web", noCatalog((a) => { a.channels = [{ type: "web", domain: "retailer.co.uk" }]; a.scope = { product_lines: ["all"] }; }), null, "Section 6.2: ccTLD web store takes GB from its domain"],
  ["list", "list-marketplace-no-territories", noCatalog((a) => { a.channels = [a.channels[0]]; a.scope = { product_lines: ["all"] }; }), null, "Section 6.2: marketplace territory comes from the domain"],
  ["list", "list-worldwide", noCatalog((a) => (a.scope.territories = ["*"])), null, "Worldwide scope"],
  ["list", "list-proposed-by", noCatalog((a) => (a.proposed_by = { name: "Example Distribution Ltd", entity_id: "ent_DIST1" })), null, "Section 3: distributor-proposed"],
  ["list", "list-not-public", notPublic, null, "Section 5.2: signed not-public response"],
  ["list", "list-no-authorizations", edit(listNoCatalog, (l) => (l.authorizations = [])), null, "A brand with nothing authorized"],
  ["list", "list-fractional-seconds", edit(listNoCatalog, (l) => (l.issued = "2026-09-28T14:00:00.123Z")), null, "Fractional seconds are allowed"],

  // ---- list: invalid (section 6)
  ["list", "list-marketplace-field", noCatalog((a) => (a.channels[0] = { type: "amazon", marketplace: "US", seller_id: "A1B2C3D4E5F6G7" })), "marketplace_field_removed", "Section 6: marketplace was replaced by domain"],
  ["list", "list-amazon-on-walmart-domain", noCatalog((a) => (a.channels[0].domain = "walmart.com")), "marketplace_domain_mismatch", "Section 6: type and domain must match"],
  ["list", "list-web-on-marketplace-domain", noCatalog((a) => (a.channels[2].domain = "amazon.com")), "marketplace_domain_mismatch", "Section 6: a web channel can't use a marketplace domain"],
  ["list", "list-physical", noCatalog((a) => (a.channels = [{ type: "physical", address: "1 High St, London", country: "GB" }])), "unknown_channel_type", "Section 6: physical was removed"],
  ["list", "list-unknown-channel-type", noCatalog((a) => a.channels.push({ type: "shopify", domain: "shop.example" })), "unknown_channel_type", "Section 6: unlisted channel type"],
  ["list", "list-amazon-missing-seller-id", noCatalog((a) => delete a.channels[0].seller_id), "schema", "Section 6: amazon needs seller_id"],
  ["list", "list-web-domain-is-url", noCatalog((a) => (a.channels[2].domain = "https://retailer.example/")), "schema", "Domains are bare hostnames"],
  ["list", "list-no-channels", noCatalog((a) => (a.channels = [])), "schema", "Section 6: at least one channel identifier"],
  ["list", "list-name-only-retailer", noCatalog((a) => delete a.channels), "schema", "Section 6: a name alone is not verifiable"],

  // ---- list: invalid (section 6.2)
  ["list", "list-generic-web-no-territories", noCatalog((a) => { a.channels = [{ type: "web", domain: "retailer.example" }]; a.scope = { product_lines: ["all"] }; }), "territories_required", "Section 6.2: generic domain needs territories"],
  ["list", "list-marketplace-territory-mismatch", noCatalog((a) => (a.scope.territories = ["CA"])), "territory_mismatch", "Section 6.2: amazon.com is US"],
  ["list", "list-territory-uk", noCatalog((a) => (a.scope.territories = ["UK"])), "invalid_country", "ISO 3166-1: the United Kingdom is GB"],
  ["list", "list-lowercase-territory", noCatalog((a) => (a.scope.territories = ["us"])), "invalid_country", "Country codes are uppercase alpha-2"],
  ["list", "list-wildcard-mixed", noCatalog((a) => (a.scope.territories = ["*", "US"])), "schema", "'*' must stand alone"],
  ["list", "list-empty-territories", noCatalog((a) => (a.scope.territories = [])), "schema", "Territories cannot be empty when given"],

  // ---- list: invalid (section 3 and 3.1)
  ["list", "list-missing-scope", noCatalog((a) => delete a.scope), "schema", "Section 3: every authorization carries a scope"],
  ["list", "list-scope-no-products", noCatalog((a) => (a.scope = { territories: ["US"] })), "schema", "Section 3: product_lines, products or both"],
  ["list", "list-all-mixed", noCatalog((a) => (a.scope.product_lines = ["all", "Running"])), "schema", "'all' must stand alone"],
  ["list", "list-bad-gtin", edit(listWithCatalog, (l) => (l.catalog[0].gtin = "00012345678906")), "invalid_gtin", "Section 3.1: GTIN check digit"],
  ["list", "list-bad-region", edit(listWithCatalog, (l) => (l.catalog[0].regions = ["UK"])), "invalid_region", "Section 3.1: the United Kingdom is GB"],
  ["list", "list-recalled-no-url", edit(listWithCatalog, (l) => { l.catalog[0].status = "recalled"; }), "recall_url_required", "Section 3.1: a recall names its notice"],
  ["list", "list-bad-asin", edit(listWithCatalog, (l) => (l.catalog[0].asins = ["b0example1"])), "invalid_asin", "Section 3.1: ASINs are 10 uppercase letters or digits"],
  ["list", "list-product-no-identifier", edit(listWithCatalog, (l) => { delete l.catalog[0].gtin; delete l.catalog[0].asins; }), "product_without_identifier", "Section 3.1: gtin or asins"],
  ["list", "list-duplicate-asin", edit(listWithCatalog, (l) => (l.catalog[1].asins = ["B0EXAMPLE1"])), "duplicate_identifier", "Section 3.1: one ASIN on two products"],
  ["list", "list-gtin-11-digits", edit(listWithCatalog, (l) => (l.catalog[1].gtin = "12345678905")), "schema", "11 digits is not a GTIN length"],
  ["list", "list-duplicate-gtin", edit(listWithCatalog, (l) => (l.catalog[1].gtin = "0012345678905")), "duplicate_identifier", "Section 3.1: GTIN-13 and GTIN-14 of the same number collide"],
  ["list", "list-duplicate-product-id", edit(listWithCatalog, (l) => (l.catalog[1].id = "EB-TEE-BLK-M")), "duplicate_product_id", "Product IDs are unique"],
  ["list", "list-unknown-line", auth0(listWithCatalog, (a) => (a.scope.product_lines = ["Hats"])), "unknown_product_line", "Section 3.1: scope names a line not in the catalog"],
  ["list", "list-unknown-product", auth0(listWithCatalog, (a) => (a.scope.products = ["NOPE"])), "unknown_product", "Section 3.1: scope names a product not in the catalog"],
  ["list", "list-exclude-unknown-product", auth0(listWithCatalog, (a) => (a.scope.exclude_products = ["NOPE"])), "unknown_product", "Section 3.1: exclusions must exist in the catalog"],
  ["list", "list-brand-exclusion-no-catalog", edit(listNoCatalog, (l) => (l.exclusions = { product_lines: ["Running"] })), "unknown_product_line", "Section 3.1: exclusions need a catalog"],
  ["list", "list-duplicate-authorization-id", edit(listNoCatalog, (l) => l.authorizations.push(clone(l.authorizations[0]))), "duplicate_authorization_id", "Authorization IDs are unique within a list"],
  ["list", "list-missing-revocation-id", noCatalog((a) => delete a.revocation_id), "schema", "Section 10.3: every authorization has a revocation_id"],

  // ---- list: invalid (sections 5.2 and 10)
  ["list", "list-expires-field", edit(listNoCatalog, (l) => (l.expires = "2026-12-22T00:00:00Z")), "schema", "Since v0.2, lists use valid_until, not expires"],
  ["list", "list-valid-over-15-minutes", edit(listNoCatalog, (l) => (l.valid_until = "2026-09-28T14:15:01Z")), "valid_until_exceeds_max", "Section 10.1: 15 minutes at most"],
  ["list", "list-stale-over-24-hours", edit(listNoCatalog, (l) => (l.stale_until = "2026-09-29T14:00:01Z")), "stale_until_exceeds_max", "Section 10.2: 24 hours at most"],
  ["list", "list-missing-stale-until", edit(listNoCatalog, (l) => delete l.stale_until), "schema", "stale_until is required"],
  ["list", "list-single-domain", edit(listNoCatalog, (l) => (l.brand = { name: "Example Brand", domain: "brand.example" })), "schema", "Section 5.2: lists name brand.domains"],
  ["list", "list-not-public-with-authorizations", edit(notPublic, (l) => (l.authorizations = [])), "schema", "Section 5.2: a not-public response carries no authorizations"],
  ["list", "list-not-public-with-catalog", edit(notPublic, (l) => (l.catalog = [])), "schema", "Section 5.2: nor a catalog"],
  ["list", "list-extra-property", edit(listNoCatalog, (l) => (l.price = 10)), "schema", "Section 1: no pricing; unknown properties rejected"],
  ["list", "list-attached-jws", edit(listNoCatalog, (l) => (l.signature.jws = "aGVhZA.cGF5bG9hZA.c2ln")), "schema", "Section 8: JWS must be detached"],
  ["list", "list-unsigned", edit(listNoCatalog, (l) => delete l.signature), "schema", "Section 5.2: lists are signed"],
  ["list", "list-non-utc-timestamp", edit(listNoCatalog, (l) => (l.issued = "2026-09-28T14:00:00+01:00")), "schema", "Timestamps are UTC with Z"],
  ["list", "list-impossible-date", noCatalog((a) => (a.expires = "2026-02-30T00:00:00Z")), "schema", "Feb 30 does not exist"],

  // ---- verify request: valid
  ["verify-request", "full", request, null, "Section 9 example"],
  ["verify-request", "minimal-marketplace", req(amazonUS), null, "Territory defaults to amazon.com's country"],
  ["verify-request", "web-generic-with-territory", req({ type: "web", domain: "retailer.example" }, { territory: "CA", product_line: "Running" }), null, "Section 6.2: generic domain names its territory"],
  ["verify-request", "web-cctld-no-territory", req({ type: "web", domain: "retailer.co.uk" }), null, "Section 6.2: ccTLD implies GB"],
  ["verify-request", "gtin", req(amazonUS, { product: { gtin: "00012345678905" } }), null, "Product by GTIN"],
  ["verify-request", "gtin-and-asin", req(amazonUS, { product: { gtin: "00012345678905", asin: "B0EXAMPLE1" } }), null, "Section 9: a product may name both"],
  ["verify-request", "product-only-upc", { channel: amazonUS, product: { gtin: "012345678905" } }, null, "Section 9.5: no brand_domain, found by UPC-A"],
  ["verify-request", "product-only-ean", { channel: { type: "web", domain: "retailer.co.uk" }, product: { gtin: "4006381333931" } }, null, "Section 9.5: no brand_domain, found by EAN-13"],
  ["verify-request", "product-only-asin", { channel: amazonUS, product: { asin: "B0EXAMPLE1" } }, null, "Section 9.5: an ASIN on an Amazon channel"],
  ["verify-request", "as-of-datetime", req(amazonUS, { as_of: "2026-09-01T12:00:00Z" }), null, "as_of as a UTC date-time"],

  // ---- verify request: invalid
  ["verify-request", "marketplace-field", req({ type: "amazon", marketplace: "US", seller_id: "A1B2C3D4E5F6G7" }), "marketplace_field_removed", "Section 6: marketplace was replaced by domain"],
  ["verify-request", "mpn-only", req(amazonUS, { product: { mpn: "EB-100-BLK" } }), "product_identifier_required", "Section 9: an mpn only confirms a GTIN or ASIN"],
  ["verify-request", "no-brand-no-product", { channel: amazonUS }, "brand_or_product_required", "Section 9: brand_domain, product or both"],
  ["verify-request", "asin-only-on-walmart", { channel: { type: "walmart", domain: "walmart.com", seller_id: "900000001" }, product: { asin: "B0EXAMPLE1" } }, "asin_needs_amazon_channel", "Section 9.5: an ASIN alone finds a brand only on Amazon"],
  ["verify-request", "empty-product", req(amazonUS, { product: {} }), "schema", "A product names a gtin, an asin or both"],
  ["verify-request", "product-only-bad-gtin", { channel: amazonUS, product: { gtin: "012345678906" } }, "invalid_gtin", "Section 9.5: a bad check digit is rejected, never resolved"],
  ["verify-request", "bad-gtin", req(amazonUS, { product: { gtin: "00012345678906" } }), "invalid_gtin", "GTIN check digit"],
  ["verify-request", "territory-uk", req(amazonUS, { territory: "UK" }), "invalid_country", "ISO 3166-1: GB, not UK (normalizeVerifyRequest maps it)"],
  ["verify-request", "generic-web-no-territory", req({ type: "web", domain: "retailer.example" }), "territory_required", "Section 6.2: generic domain needs a territory"],
  ["verify-request", "physical-channel", req({ type: "physical", address: "1 Main St", country: "US" }), "unknown_channel_type", "physical was removed"],
  ["verify-request", "wildcard-territory", req(amazonUS, { territory: "*" }), "schema", "A request names one territory"],
  ["verify-request", "missing-channel", { brand_domain: "brand.example" }, "schema", "Channel is required"],
  ["verify-request", "retailer-name-only", { brand_domain: "brand.example", retailer: "Example Retail LLC" }, "schema", "Section 6: agents match on identifiers, not names"],
  ["verify-request", "domain-with-scheme", req(amazonUS, { brand_domain: "https://brand.example" }), "schema", "Bare hostname only"],
  ["verify-request", "bad-as-of", req(amazonUS, { as_of: "yesterday" }), "schema", "as_of is an ISO 8601 date or UTC date-time"],

  // ---- verify response: valid
  ["verify-response", "authorized", authorized, null, "Section 9 example"],
  ["verify-response", "authorized-no-product", edit(authorized, (r) => delete r.product), null, "No product asked"],
  ["verify-response", "authorized-with-end-date", edit(authorized, (r) => (r.expires = "2027-09-28T00:00:00Z")), null, "Brand-set end date"],
  ["verify-response", "authorized-observed", edit(authorized, (r) => (r.observed = { last_seen: "2026-09-20T00:00:00Z" })), null, "Section 7: seen selling within 30 days"],
  ["verify-response", "authorized-not-in-catalog", edit(authorized, (r) => { r.product = { in_catalog: false }; r.signals = [{ type: "product_not_in_catalog", observed: "2026-09-28T14:02:11Z" }]; }), null, "Section 9.2 rule 6"],
  ["verify-response", "authorized-private-product", edit(authorized, (r) => (r.product = { in_catalog: true })), null, "Section 9: private lists show only in_catalog"],
  ["verify-response", "expired", edit(authorized, (r) => { r.status = "expired"; r.expires = "2026-09-01T00:00:00Z"; delete r.revocation_id; }), null, ""],
  ["verify-response", "disputed", edit(authorized, (r) => { r.status = "disputed"; delete r.revocation_id; }), null, ""],
  ["verify-response", "unlisted", unlisted, null, ""],
  ["verify-response", "unlisted-territory-mismatch", { ...unlisted, reason: "territory_mismatch" }, null, "Section 6.2"],
  ["verify-response", "unlisted-product-excluded", { ...unlisted, reason: "product_excluded", product: { in_catalog: true, id: "EB-DTC-1", product_line: "Limited" } }, null, "Section 9.2 rule 3"],
  ["verify-response", "unlisted-product-not-in-catalog", { ...unlisted, reason: "product_not_in_catalog", product: { in_catalog: false } }, null, "Section 9.2 rule 5"],
  ["verify-response", "not-registered-reason", notRegistered, null, "Section 4 reason"],
  ["verify-response", "not-registered-no-reason", edit(notRegistered, (r) => delete r.reason), null, "reason is optional"],
  ["verify-response", "with-as-of", edit(authorized, (r) => (r.as_of = "2026-09-28T00:00:00Z")), null, "Section 9: as_of echoed"],
  ["verify-response", "with-signal", edit(authorized, (r) => r.signals.push({ type: "account_name_changed", observed: "2026-09-20T00:00:00Z", detail: "Storefront name changed" })), null, "Section 7 signals"],

  ["verify-response", "authorized-resolved-by-asin", { ...authorized, resolved_by: "asin" }, null, "Section 9.5: brand found from the ASIN"],
  ["verify-response", "recalled-product", edit(authorized, (r) => (r.product = { in_catalog: true, status: "recalled", status_since: "2026-09-01", recall_url: "https://www.cpsc.gov/Recalls/2026/example" })), null, "Section 9.3: status shows on every list"],
  ["verify-response", "not-for-region", { ...unlisted, reason: "product_not_for_region", product: { in_catalog: true, regions: ["US"] } }, null, "Section 9.2"],
  ["verify-response", "product-not-found", productNotFound, null, "Section 9.5: no registered brand's catalog has it"],
  ["verify-response", "brand-ambiguous", ambiguous, null, "Section 9.5: two brands claim the product"],
  ["verify-response", "brand-mismatch", mismatch, null, "Section 9.5: the product belongs to another brand"],

  // ---- verify response: invalid
  ["verify-response", "recalled-without-url", edit(authorized, (r) => (r.product = { in_catalog: true, status: "recalled" })), "schema", "A recalled product names its recall notice"],
  ["verify-response", "not-in-catalog-with-status", edit(authorized, (r) => (r.product = { in_catalog: false, status: "active" })), "schema", "A product not in the catalog has no status"],
  ["verify-response", "authorized-missing-brand", edit(authorized, (r) => delete r.brand), "schema", "Section 9.5: every answer about a brand names it"],
  ["verify-response", "authorized-missing-resolved-by", edit(authorized, (r) => delete r.resolved_by), "schema", "Section 9.5: and says how it was found"],
  ["verify-response", "ambiguous-one-candidate", { ...ambiguous, candidates: [exampleBrand] }, "schema", "Section 9.5: ambiguous means two or more brands"],
  ["verify-response", "ambiguous-with-brand", { ...ambiguous, brand: exampleBrand }, "schema", "Section 9.5: an ambiguous answer picks no brand"],
  ["verify-response", "ambiguous-authorized", { ...authorized, status: "brand_ambiguous", candidates: [exampleBrand, otherBrand] }, "schema", "Section 9.5: brand_ambiguous is never authorized"],
  ["verify-response", "not-found-with-candidates", { ...productNotFound, candidates: [otherBrand] }, "schema", "Candidates only on brand_ambiguous and brand_mismatch"],
  ["verify-response", "mismatch-resolved-by-gtin", { ...mismatch, resolved_by: "gtin" }, "schema", "Section 9.5: a mismatch is about the brand_domain asked"],
  ["verify-response", "unlisted-with-candidates", { ...unlisted, candidates: [otherBrand] }, "schema", "Candidates only on brand_ambiguous and brand_mismatch"],
  ["verify-response", "brand-unverified", { ...notRegistered, status: "brand_unverified" }, "schema", "Renamed brand_not_registered in v0.2"],
  ["verify-response", "authorized-missing-revocation-id", edit(authorized, (r) => delete r.revocation_id), "schema", "Section 10.3: authorized answers carry revocation_id"],
  ["verify-response", "unlisted-with-revocation-id", { ...unlisted, revocation_id: "rv_Q2l8dX4bT0aN5kPw" }, "schema", "Only authorized answers carry revocation_id"],
  ["verify-response", "unlisted-with-not-registered-reason", { ...unlisted, reason: "domain_unlinked" }, "schema", "Section 9: reasons belong to their status"],
  ["verify-response", "not-registered-with-unlisted-reason", { ...notRegistered, reason: "product_excluded" }, "schema", "Section 9: reasons belong to their status"],
  ["verify-response", "authorized-with-reason", { ...authorized, reason: "product_excluded" }, "schema", "Section 9: no reason on authorized"],
  ["verify-response", "not-in-catalog-with-id", { ...unlisted, reason: "product_not_in_catalog", product: { in_catalog: false, id: "X" } }, "schema", "A product not in the catalog has no id"],
  ["verify-response", "expired-without-expires", edit(authorized, (r) => { r.status = "expired"; delete r.revocation_id; }), "schema", "expired names the end date"],
  ["verify-response", "missing-observed", edit(authorized, (r) => delete r.observed), "schema", "Section 7: every answer MUST carry observed"],
  ["verify-response", "unlisted-observed", { ...unlisted, observed: { last_seen: "2026-09-20T00:00:00Z" } }, "schema", "Section 7: observed is null unless authorized"],
  ["verify-response", "unlisted-with-authorization-id", { ...unlisted, authorization_id: "auth_01J9X2" }, "schema", "Unlisted answers name no authorization"],
  ["verify-response", "missing-stale-until", edit(authorized, (r) => delete r.stale_until), "schema", "Section 10.2: stale_until is required"],
  ["verify-response", "missing-signature", edit(authorized, (r) => delete r.signature), "schema", "Answers are signed"],
  ["verify-response", "with-tier", edit(authorized, (r) => (r.tier = "brand_attested")), "schema", "Evidence tiers were removed (section 7)"],
  ["verify-response", "with-stale-flag", edit(authorized, (r) => (r.stale = true)), "schema", "stale is the verifier's verdict, not part of a signed answer"],
  ["verify-response", "valid-until-over-15-minutes", edit(authorized, (r) => (r.valid_until = "2026-09-28T14:17:12Z")), "valid_until_exceeds_max", "Section 9 MUST"],
  ["verify-response", "valid-until-before-checked", edit(authorized, (r) => (r.valid_until = "2026-09-28T14:02:11Z")), "valid_until_not_after_issued", ""],
  ["verify-response", "stale-until-over-24-hours", edit(authorized, (r) => (r.stale_until = "2026-09-29T14:02:12Z")), "stale_until_exceeds_max", "Section 10.2"],

  // ---- resolve request and response (section 9.5)
  ["resolve-request", "gtin", { product: { gtin: "012345678905" } }, null, "UPC-A"],
  ["resolve-request", "asin-with-domain", { product: { asin: "B0EXAMPLE1" }, domain: "amazon.co.uk" }, null, "ASIN and the marketplace it was seen on"],
  ["resolve-request", "gtin-and-asin", { product: { gtin: "4006381333931", asin: "B0EXAMPLE2" } }, null, "Both identifiers"],
  ["resolve-request", "no-product", { domain: "amazon.com" }, "schema", "product is required"],
  ["resolve-request", "bad-gtin", { product: { gtin: "4006381333932" } }, "invalid_gtin", "Bad check digit"],
  ["resolve-request", "non-amazon-domain", { product: { asin: "B0EXAMPLE1" }, domain: "walmart.com" }, "asin_needs_amazon_channel", "domain is an Amazon marketplace"],
  ["resolve-request", "brand-name", { product: { gtin: "012345678905" }, brand_name: "Example Brand" }, "schema", "Section 4.2: a name never resolves a brand"],
  ["resolve-response", "resolved", resolved, null, ""],
  ["resolve-response", "not-found", { ...resolved, status: "product_not_found", brand: undefined, resolved_by: undefined }, null, ""],
  ["resolve-response", "ambiguous", { ...resolved, status: "brand_ambiguous", brand: undefined, resolved_by: undefined, candidates: [exampleBrand, otherBrand] }, null, ""],
  ["resolve-response", "resolved-by-brand-domain", { ...resolved, resolved_by: "brand_domain" }, "schema", "A resolve request has no brand_domain"],
  ["resolve-response", "resolved-with-retailers", { ...resolved, authorizations: [] }, "schema", "Section 9.5: resolution never reveals retailers"],
  ["resolve-response", "valid-until-over-15-minutes", { ...resolved, valid_until: "2026-09-28T14:17:12Z" }, "valid_until_exceeds_max", "Section 9"],

  // ---- revocation feed
  ["revocation-feed", "feed", feed, null, "Section 10.3 example"],
  ["revocation-feed", "feed-empty", edit(feed, (f) => (f.entries = [])), null, "No revocations in the last 24 hours"],
  ["revocation-feed", "feed-hashed-entry", edit(feed, (f) => (f.entries = [{ hash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", revoked: "2026-09-28T13:40:12Z" }])), "schema", "Section 10.3: entries are revocation IDs, not hashes"],
  ["revocation-feed", "feed-valid-over-15-minutes", edit(feed, (f) => (f.valid_until = "2026-09-28T14:17:01Z")), "valid_until_exceeds_max", "Section 10.1"],

  // ---- matching (section 9)
  ["match", "seller-authorized-for-line", match(req(amazonUS, { product: { asin: "B0EXAMPLE1" } }), { status: "authorized", authorization_id: "auth_01J9X2", product: { in_catalog: true, id: "EB-TEE-BLK-M", product_line: "Classic Tee", name: "Classic Tee, Black, M", mpns: ["EB-100-BLK"], style_code: "EB-TEE" }, signals: [] }), null, "Rule 2: in the catalog and covered"],
  ["match", "seller-authorized-by-gtin", match(req(amazonUS, { product: { gtin: "012345678905" } }), { status: "authorized", authorization_id: "auth_01J9X2", product: { in_catalog: true, id: "EB-TEE-BLK-M", product_line: "Classic Tee", name: "Classic Tee, Black, M", mpns: ["EB-100-BLK"], style_code: "EB-TEE" }, signals: [] }), null, "GTIN-12 matches the catalog's GTIN-14"],
  ["match", "product-excluded-by-authorization", match(req(amazonUS, { product: { asin: "B0EXAMPLE2" } }), { status: "unlisted", reason: "product_excluded", product: { in_catalog: true, id: "EB-TEE-WHT-M", product_line: "Classic Tee", name: "Classic Tee, White, M" }, signals: [] }), null, "Rule 3: authorization excludes the product"],
  ["match", "product-not-in-scope", match(req(amazonUS, { product: { gtin: "96385074" } }), { status: "unlisted", reason: "product_not_in_scope", product: { in_catalog: true, id: "EB-RUN-V2", product_line: "Running", name: "Runner V2" }, signals: [] }), null, "Rule 4: in the catalog, not included"],
  ["match", "duplicate-asin-authorized-seller", match(req(amazonUS, { product: { asin: "B0DUPL1CAT" } }), { status: "unlisted", reason: "product_not_in_catalog", product: { in_catalog: false }, signals: [] }), null, "Rule 5: line-scoped seller, ASIN not in the catalog"],
  ["match", "duplicate-asin-unauthorized-seller", match(req({ type: "amazon", domain: "amazon.com", seller_id: "AUNKNOWNSELLER" }, { product: { asin: "B0DUPL1CAT" } }), { status: "unlisted", product: { in_catalog: false }, signals: [] }), null, "Section 9.1: an unauthorized seller's duplicate ASIN never authorizes"],
  ["match", "all-scope-not-in-catalog", match(req(global, { territory: "US", product: { asin: "B0DUPL1CAT" } }), { status: "authorized", authorization_id: "auth_02", product: { in_catalog: false }, signals: ["product_not_in_catalog"] }), null, "Rule 6: [\"all\"] covers it, with a signal"],
  ["match", "all-scope-excluded-line", match(req(global, { territory: "FR", product: { asin: "B0EXAMPLE3" } }), { status: "unlisted", reason: "product_excluded", product: { in_catalog: true, id: "EB-RUN-V3", product_line: "Running", name: "Runner V3" }, signals: [] }), null, "[\"all\"] with one excluded line"],
  ["match", "brand-exclusion-beats-named-product", match(req(amazonUK, { product: { gtin: "12345678901231" } }), { status: "unlisted", reason: "product_excluded", product: { in_catalog: true, id: "EB-DTC-1", product_line: "Limited", name: "Founders Edition" }, signals: [] }), null, "Brand-level exclusion overrides an authorization naming the product"],
  ["match", "marketplace-territory-default", match(req(amazonUK), { status: "authorized", authorization_id: "auth_04", signals: [] }), null, "Territory defaults to amazon.co.uk's GB"],
  ["match", "marketplace-territory-mismatch", match(req(amazonUK, { territory: "US" }), { status: "unlisted", reason: "territory_mismatch", signals: [] }), null, "Section 6.2: amazon.co.uk is GB"],
  ["match", "worldwide-web", match(req(global, { territory: "JP" }), { status: "authorized", authorization_id: "auth_02", signals: [] }), null, "Worldwide web store"],
  ["match", "product-line-request", match(req(global, { territory: "US", product_line: "Running" }), { status: "unlisted", signals: [] }), null, "Excluded line asked by product_line"],
  ["match", "expired-end-date", match(req({ type: "web", domain: "ukrunners.co.uk" }, { product: { asin: "B0EXAMPLE3" } }), { status: "expired", authorization_id: "auth_03", product: { in_catalog: true, id: "EB-RUN-V3", product_line: "Running", name: "Runner V3" }, signals: [] }), null, "Section 10: past the brand's end date"],
  ["match", "as-of-before-end-date", match(req({ type: "web", domain: "ukrunners.co.uk" }, { product: { asin: "B0EXAMPLE3" }, as_of: "2026-08-15" }), { status: "authorized", authorization_id: "auth_03", product: { in_catalog: true, id: "EB-RUN-V3", product_line: "Running", name: "Runner V3" }, signals: [] }), null, "Section 9: as_of before the end date"],
  ["match", "match-by-channel-key", match(req({ type: "amazon", domain: "amazon.com", seller_id: " a1b2c3d4e5f6g7 " }), { status: "authorized", authorization_id: "auth_01J9X2", signals: [] }), null, "Section 6.1: Amazon seller IDs compare uppercased"],

  // ---- resolution (section 9.5)
  ["resolve", "by-upc-a", resolveCase({ gtin: "012345678905" }, { status: "resolved", brand: exampleBrand, resolved_by: "gtin" }), null, "UPC-A"],
  ["resolve", "by-ean-13", resolveCase({ gtin: "0012345678905" }, { status: "resolved", brand: exampleBrand, resolved_by: "gtin" }), null, "The same number as EAN-13"],
  ["resolve", "by-gtin-14", resolveCase({ gtin: "00012345678905" }, { status: "resolved", brand: exampleBrand, resolved_by: "gtin" }), null, "And as GTIN-14"],
  ["resolve", "by-asin", resolveCase({ asin: "B0EXAMPLE1" }, { status: "resolved", brand: exampleBrand, resolved_by: "asin" }), null, ""],
  ["resolve", "gtin-and-asin-agree", resolveCase({ gtin: "012345678905", asin: "B0EXAMPLE1" }, { status: "resolved", brand: exampleBrand, resolved_by: "gtin" }), null, "Both identifiers, one brand"],
  ["resolve", "shared-gtin", resolveCase({ gtin: "4006381333931" }, { status: "brand_ambiguous", candidates: [exampleBrand, otherBrand] }), null, "Two brands claim one GTIN: never pick one"],
  ["resolve", "gtin-and-asin-disagree", resolveCase({ gtin: "012345678905", asin: "B0OTHER001" }, { status: "brand_ambiguous", candidates: [exampleBrand, otherBrand] }), null, "GTIN and ASIN point to different brands"],
  ["resolve", "unknown-gtin", resolveCase({ gtin: "5012345678900" }, { status: "product_not_found" }), null, "No catalog has it"],

  // ---- product status, regions and details (sections 3.1, 9.2)
  ["match", "recalled-authorized", match(req(amazonUS, { product: { gtin: "012345678929" } }), { status: "authorized", authorization_id: "auth_01J9X2", product: { in_catalog: true, id: "EB-TEE-OLD", product_line: "Classic Tee", name: "Classic Tee, 2019 dye", status: "recalled", status_since: "2026-09-01", recall_url: "https://www.cpsc.gov/Recalls/2026/example" }, signals: [] }), null, "A recall doesn't change the seller's status; the answer says the product is recalled"],
  ["match", "region-us-product-on-us-marketplace", match(req(amazonUS, { product: { gtin: "012345678912" } }), { status: "authorized", authorization_id: "auth_01J9X2", product: { in_catalog: true, id: "EB-TEE-US", product_line: "Classic Tee", name: "Classic Tee, US formula dye", regions: ["US"] }, signals: [] }), null, "Made for the US, sold on amazon.com"],
  ["match", "product-not-for-region", match(req(amazonUK, { product: { gtin: "012345678912" } }), { status: "unlisted", reason: "product_not_for_region", product: { in_catalog: true, id: "EB-TEE-US", product_line: "Classic Tee", name: "Classic Tee, US formula dye", regions: ["US"] }, signals: [] }), null, "Section 3.1: a US product on amazon.co.uk isn't authorized, even for a seller authorized for everything"],
  ["match", "eu-group-covers-france", match(req(global, { territory: "FR", product: { gtin: "4012345678901" } }), { status: "authorized", authorization_id: "auth_02", product: { in_catalog: true, id: "EB-TEE-EU", product_line: "Classic Tee", name: "Classic Tee, EU formula dye", regions: ["EU"] }, signals: [] }), null, "The EU group includes France"],
  ["match", "eu-group-excludes-gb", match(req(global, { territory: "GB", product: { gtin: "4012345678901" } }), { status: "unlisted", reason: "product_not_for_region", product: { in_catalog: true, id: "EB-TEE-EU", product_line: "Classic Tee", name: "Classic Tee, EU formula dye", regions: ["EU"] }, signals: [] }), null, "The United Kingdom is not in the EU group"],
  ["match", "mpn-confirmed", match(req(amazonUS, { product: { asin: "B0EXAMPLE1", mpn: "eb-100-blk", style_code: "EB-TEE" } }), { status: "authorized", authorization_id: "auth_01J9X2", product: { in_catalog: true, id: "EB-TEE-BLK-M", product_line: "Classic Tee", name: "Classic Tee, Black, M", mpns: ["EB-100-BLK"], style_code: "EB-TEE", confirmed: ["mpn", "style_code"] }, signals: [] }), null, "The listing's model number and style code match (case doesn't matter)"],
  ["match", "mpn-mismatched", match(req(amazonUS, { product: { asin: "B0EXAMPLE1", mpn: "OTHER-9" } }), { status: "authorized", authorization_id: "auth_01J9X2", product: { in_catalog: true, id: "EB-TEE-BLK-M", product_line: "Classic Tee", name: "Classic Tee, Black, M", mpns: ["EB-100-BLK"], style_code: "EB-TEE", mismatched: ["mpn"] }, signals: ["product_details_mismatch"] }), null, "A different model number on the listing: a warning, the status is unchanged"],
  ["match", "channel-type-inferred", match({ brand_domain: "brand.example", channel: { domain: "amazon.com", seller_id: "A1B2C3D4E5F6G7" } }, { status: "authorized", authorization_id: "auth_01J9X2", signals: [] }), null, "Section 9: type is optional; amazon.com implies amazon"],
];

rmSync(root, { recursive: true, force: true });
const manifest = [];
for (const [kind, name, doc, expect, note, extra = {}] of cases) {
  const valid = expect === null;
  const rel = kind === "match" || kind === "resolve" ? `${kind}/${name}.json` : `${kind}/${valid ? "valid" : "invalid"}/${name}.json`;
  mkdirSync(join(root, dirname(rel)), { recursive: true });
  writeFileSync(join(root, rel), JSON.stringify(doc, null, 2) + "\n");
  manifest.push({ path: rel, kind, ...(kind === "match" || kind === "resolve" ? {} : { valid }), ...(expect ? { expect } : {}), ...extra, ...(note ? { note } : {}) });
}
writeFileSync(join(root, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${manifest.length} fixtures`);
