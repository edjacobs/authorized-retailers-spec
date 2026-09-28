import { Validator, type OutputUnit } from "@cfworker/json-schema";
import { common, list, pointer, revocationFeed, verifyRequest, verifyResponse } from "./schemas.js";
import { MAX_STALE_MS, MAX_VALIDITY_MS, MARKETPLACE_DOMAINS } from "./constants.js";
import { isCountryCode, isMarketplaceDomain, isRecord, normalizeDomain, territoryForDomain } from "./identity.js";
import { isValidAsin, isValidGtin, toGtin14 } from "./product.js";
import { parseTimestamp } from "./timestamp.js";
import type {
  Channel,
  PointerFile,
  PublicList,
  RevocationFeed,
  Scope,
  SignedList,
  VerifyRequest,
  VerifyResponse,
} from "./types.js";

export type ErrorCode =
  | "schema"
  | "form_not_supported"
  | "list_not_on_registry"
  | "brand_domain_mismatch"
  | "unknown_channel_type"
  | "marketplace_field_removed"
  | "marketplace_domain_mismatch"
  | "invalid_country"
  | "territory_mismatch"
  | "territories_required"
  | "territory_required"
  | "invalid_gtin"
  | "invalid_asin"
  | "product_without_identifier"
  | "duplicate_product_id"
  | "duplicate_identifier"
  | "unknown_product_line"
  | "unknown_product"
  | "invalid_timestamp"
  | "duplicate_authorization_id"
  | "valid_until_not_after_issued"
  | "valid_until_exceeds_max"
  | "stale_until_before_valid_until"
  | "stale_until_exceeds_max";

export type WarningCode = "territory_differs_from_domain";

export interface ValidationError {
  code: ErrorCode;
  /** JSON Pointer into the instance, e.g. "/authorizations/0/channels/1". */
  path: string;
  message: string;
}

export interface ValidationWarning {
  code: WarningCode;
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { valid: true; value: T; errors: []; warnings: ValidationWarning[] }
  | { valid: false; errors: ValidationError[]; warnings: ValidationWarning[] };

type Schema = Record<string, unknown>;
const V = "https://authorizedretailers.ai/schemas/0.2";
const ALL_SCHEMAS: Schema[] = [common, pointer, list, verifyRequest, verifyResponse, revocationFeed];
const scopeSchema: Schema = { $id: `${V}/scope.json`, $ref: "common.json#/$defs/scope" };
const channelSchema: Schema = { $id: `${V}/channel.json`, $ref: "common.json#/$defs/channel" };
const productSchema: Schema = { $id: `${V}/product.json`, $ref: "common.json#/$defs/product" };

function makeValidator(root: Schema): Validator {
  const v = new Validator(root as never, "2020-12", false);
  for (const s of ALL_SCHEMAS) if (s !== root) v.addSchema(s as never);
  return v;
}

// Built lazily: compiling at module load would slow Worker cold starts for callers that never validate.
const validators = new Map<Schema, Validator>();
function schemaErrors(root: Schema, instance: unknown): ValidationError[] {
  let v = validators.get(root);
  if (!v) {
    v = makeValidator(root);
    validators.set(root, v);
  }
  const result = v.validate(instance);
  if (result.valid) return [];
  return dedupe(result.errors.map(toError));
}

function toError(unit: OutputUnit): ValidationError {
  const path = unit.instanceLocation.replace(/^#/, "");
  return { code: "schema", path, message: `${unit.error} (${unit.keywordLocation})` };
}

function dedupe<E extends { path: string; message: string }>(errors: E[]): E[] {
  const seen = new Set<string>();
  return errors.filter((e) => {
    const k = `${e.path}|${e.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

class Report {
  errors: ValidationError[] = [];
  warnings: ValidationWarning[] = [];
  /** Paths a specific error already explains; schema errors under them only repeat it. */
  claimed: string[] = [];
  error(code: ErrorCode, path: string, message: string) {
    this.errors.push({ code, path, message });
  }
  warn(code: WarningCode, path: string, message: string) {
    this.warnings.push({ code, path, message });
  }
  done<T>(value: unknown): ValidationResult<T> {
    return this.errors.length === 0
      ? { valid: true, value: value as T, errors: [], warnings: this.warnings }
      : { valid: false, errors: this.errors, warnings: this.warnings };
  }
}

function ts(r: Report, path: string, value: string): number | null {
  const ms = parseTimestamp(value);
  if (ms === null) r.error("invalid_timestamp", path, `not a valid UTC timestamp: ${value}`);
  return ms;
}

const CHANNEL_TYPES = new Set(["amazon", "walmart", "ebay", "web"]);

/**
 * Section 6 rules on one channel that the generic schema output would bury: removed fields and
 * types, and marketplace domains that don't match the type. Runs on unvalidated input.
 */
function channelRules(r: Report, path: string, input: unknown) {
  if (!isRecord(input)) return;
  const before = r.errors.length;
  channelChecks(r, path, input);
  if (r.errors.length > before) r.claimed.push(path);
}

function channelChecks(r: Report, path: string, input: Record<string, unknown>) {
  const type = input.type;
  if (typeof type === "string" && !CHANNEL_TYPES.has(type)) {
    r.error("unknown_channel_type", path, `unknown channel type "${type}"; v0.2 has amazon, walmart, ebay and web (section 6)`);
    return;
  }
  if ("marketplace" in input) {
    r.error("marketplace_field_removed", `${path}/marketplace`, 'the "marketplace" field was removed in v0.2: identify the marketplace by "domain", e.g. "amazon.com" (section 6)');
  }
  if (typeof input.domain !== "string") return;
  const domain = normalizeDomain(input.domain);
  if (type === "web") {
    if (isMarketplaceDomain(domain)) {
      r.error("marketplace_domain_mismatch", `${path}/domain`, `${domain} is a marketplace domain; list the seller as a ${MARKETPLACE_DOMAINS[domain]!.type} channel (section 6)`);
    }
  } else if (typeof type === "string") {
    const market = MARKETPLACE_DOMAINS[domain];
    if (!market || market.type !== type) {
      r.error("marketplace_domain_mismatch", `${path}/domain`, `${domain} is not one of the ${type} marketplace domains (section 6)`);
    }
  }
}

/** Territory codes must be ISO 3166-1 alpha-2 (UK is GB). The schema enforces this too; name it plainly. */
function countryRule(r: Report, path: string, value: unknown) {
  if (typeof value === "string" && value !== "*" && !isCountryCode(value)) {
    r.error("invalid_country", path, `${value} is not an ISO 3166-1 alpha-2 code${value.toUpperCase() === "UK" ? " (the United Kingdom is GB)" : ""}`);
  }
}

/** Section 6.2 territory rules for one authorization. Assumes the list passed the schema. */
function territoryRules(r: Report, base: string, channels: Channel[], scope: Scope) {
  const listed = scope.territories;
  const worldwide = listed?.[0] === "*";
  channels.forEach((c, j) => {
    const own = territoryForDomain(c.domain);
    const path = `${base}/channels/${j}`;
    if (c.type !== "web") {
      if (listed && !worldwide && own !== null && !listed.includes(own)) {
        r.error("territory_mismatch", `${base}/scope/territories`, `${c.domain} is in ${own}, which scope.territories leaves out (section 6.2)`);
      }
    } else if (own === null) {
      if (!listed) r.error("territories_required", path, `${c.domain} is a generic domain, so the authorization must list scope.territories (section 6.2)`);
    } else if (listed && !worldwide && !listed.includes(own)) {
      r.warn("territory_differs_from_domain", `${base}/scope/territories`, `${c.domain} is a ${own} domain but the territories listed leave out ${own}`);
    }
  });
}

/** Section 3.1 catalog rules. Assumes the list passed the schema. */
function catalogRules(r: Report, l: PublicList) {
  const catalog = l.catalog ?? [];
  const ids = new Set<string>();
  const lines = new Set<string>();
  const identifiers = new Map<string, string>();
  catalog.forEach((p, i) => {
    const base = `/catalog/${i}`;
    if (ids.has(p.id)) r.error("duplicate_product_id", `${base}/id`, `duplicate product id ${p.id}`);
    ids.add(p.id);
    if (p.product_line) lines.add(p.product_line);
    const claim = (key: string, path: string, shown: string) => {
      const other = identifiers.get(key);
      if (other !== undefined && other !== p.id) r.error("duplicate_identifier", path, `${shown} is on products ${other} and ${p.id}`);
      identifiers.set(key, p.id);
    };
    if (p.gtin !== undefined) {
      if (!isValidGtin(p.gtin)) r.error("invalid_gtin", `${base}/gtin`, `${p.gtin} is not a valid GTIN (bad length or check digit)`);
      else claim(`gtin:${toGtin14(p.gtin)}`, `${base}/gtin`, `GTIN ${p.gtin}`);
    }
    p.asins?.forEach((a, j) => claim(`asin:${a}`, `${base}/asins/${j}`, `ASIN ${a}`));
  });

  const hasCatalog = catalog.length > 0;
  const checkLines = (names: string[] | undefined, path: string) =>
    names?.forEach((n, k) => {
      if (n === "all") return;
      if (hasCatalog && !lines.has(n)) r.error("unknown_product_line", `${path}/${k}`, `product line "${n}" is not in the catalog (section 3.1)`);
    });
  const checkExclusionLines = (names: string[] | undefined, path: string) =>
    names?.forEach((n, k) => {
      if (!lines.has(n)) r.error("unknown_product_line", `${path}/${k}`, `excluded product line "${n}" is not in the catalog (section 3.1)`);
    });
  const checkProducts = (list: string[] | undefined, path: string) =>
    list?.forEach((id, k) => {
      if (!ids.has(id)) r.error("unknown_product", `${path}/${k}`, `product ${id} is not in the catalog (section 3.1)`);
    });

  checkExclusionLines(l.exclusions?.product_lines, "/exclusions/product_lines");
  checkProducts(l.exclusions?.products, "/exclusions/products");
  l.authorizations.forEach((a, i) => {
    const base = `/authorizations/${i}/scope`;
    checkLines(a.scope.product_lines, `${base}/product_lines`);
    checkExclusionLines(a.scope.exclude_product_lines, `${base}/exclude_product_lines`);
    checkProducts(a.scope.products, `${base}/products`);
    checkProducts(a.scope.exclude_products, `${base}/exclude_products`);
  });
}

/** Section 3.1: each product has a gtin or asins. Named plainly, since the schema's anyOf error is vague. */
function productIdentifierRules(r: Report, input: unknown) {
  const catalog = isRecord(input) ? input.catalog : undefined;
  if (!Array.isArray(catalog)) return;
  catalog.forEach((p, i) => {
    if (isRecord(p) && !("gtin" in p) && !("asins" in p)) {
      r.error("product_without_identifier", `/catalog/${i}`, "every product needs a gtin or at least one ASIN (section 3.1)");
    }
    if (isRecord(p) && Array.isArray(p.asins)) {
      p.asins.forEach((a, j) => {
        if (typeof a === "string" && !isValidAsin(a)) r.error("invalid_asin", `/catalog/${i}/asins/${j}`, `${a} is not an ASIN (10 uppercase letters or digits)`);
      });
    }
  });
}

/** Section 10: valid_until within 15 minutes of issue, stale_until within 24 hours and not before valid_until. */
function freshnessRules(r: Report, issuedAt: string, issuedPath: string, doc: { valid_until: string; stale_until: string }) {
  const issued = ts(r, issuedPath, issuedAt);
  const validUntil = ts(r, "/valid_until", doc.valid_until);
  const staleUntil = ts(r, "/stale_until", doc.stale_until);
  if (issued === null || validUntil === null || staleUntil === null) return;
  if (validUntil <= issued) r.error("valid_until_not_after_issued", "/valid_until", `valid_until must be after ${issuedPath.slice(1)}`);
  else if (validUntil - issued > MAX_VALIDITY_MS) r.error("valid_until_exceeds_max", "/valid_until", "valid_until MUST be no later than 15 minutes after issue (section 10.1)");
  if (staleUntil < validUntil) r.error("stale_until_before_valid_until", "/stale_until", "stale_until must not be before valid_until");
  else if (staleUntil - issued > MAX_STALE_MS) r.error("stale_until_exceeds_max", "/stale_until", "stale_until MUST be no later than 24 hours after issue (section 10.2)");
}

/** Walks the channels in an unvalidated list or request, applying channelRules and countryRule. */
function preSchemaChecks(r: Report, input: unknown) {
  if (!isRecord(input)) return;
  if (isRecord(input.channel)) channelRules(r, "/channel", input.channel);
  countryRule(r, "/territory", input.territory);
  if (Array.isArray(input.authorizations)) {
    input.authorizations.forEach((a, i) => {
      if (!isRecord(a)) return;
      if (Array.isArray(a.channels)) a.channels.forEach((c, j) => channelRules(r, `/authorizations/${i}/channels/${j}`, c));
      if (isRecord(a.scope) && Array.isArray(a.scope.territories)) {
        a.scope.territories.forEach((t, k) => countryRule(r, `/authorizations/${i}/scope/territories/${k}`, t));
      }
    });
  }
  productIdentifierRules(r, input);
}

/** Keeps the specific errors and drops schema errors at or under the same paths, which only repeat them. */
function merge(r: Report, schema: ValidationError[]) {
  const specific = [...r.errors.map((e) => e.path), ...r.claimed];
  for (const e of schema) {
    if (!specific.some((p) => e.path === p || e.path.startsWith(`${p}/`) || p.startsWith(`${e.path}/`))) r.errors.push(e);
  }
}

/**
 * Validates a pointer file (section 5.1). Pass the domain it was fetched from (the domain first
 * asked for, before any redirects) to check that the pointer vouches for it.
 */
export function validateFile(input: unknown, fetchedFrom?: string): ValidationResult<PointerFile> {
  const r = new Report();
  const form = isRecord(input) ? input.form : undefined;
  if (form !== "pointer") {
    r.error("form_not_supported", "/form", `form ${JSON.stringify(form)} is not supported; v0.2 has only "pointer" (section 5.1)`);
    return r.done(input);
  }
  const list = (input as { list?: unknown }).list;
  if (typeof list === "string" && /^https:\/\//.test(list) && !list.startsWith("https://authorizedretailers.ai/")) {
    r.error("list_not_on_registry", "/list", "the list MUST be an https://authorizedretailers.ai/ URL; a pointer to any other host is no file (section 5.1)");
  }
  const brand = (input as { brand?: { domain?: unknown } }).brand;
  if (fetchedFrom !== undefined && typeof brand?.domain === "string" && normalizeDomain(brand.domain) !== normalizeDomain(fetchedFrom)) {
    r.error("brand_domain_mismatch", "/brand/domain", `the pointer names ${brand.domain} but was fetched from ${fetchedFrom}; a pointer vouches only for its own domain (section 5.1)`);
  }
  merge(r, schemaErrors(pointer, input));
  return r.done(input);
}

/** Validates a signed list or not-public response (section 5.2). Does not check the signature: see checkPublishedList. */
export function validateList(input: unknown): ValidationResult<SignedList> {
  const r = new Report();
  preSchemaChecks(r, input);
  merge(r, schemaErrors(list, input));
  if (r.errors.length === 0) {
    const l = input as SignedList;
    freshnessRules(r, l.issued, "/issued", l);
    if (l.public) {
      const ids = new Set<string>();
      l.authorizations.forEach((a, i) => {
        const base = `/authorizations/${i}`;
        if (ids.has(a.id)) r.error("duplicate_authorization_id", `${base}/id`, `duplicate authorization id ${a.id}`);
        ids.add(a.id);
        if (a.expires !== undefined) ts(r, `${base}/expires`, a.expires);
        territoryRules(r, base, a.channels, a.scope);
      });
      catalogRules(r, l);
    }
  }
  return r.done(input);
}

/** Validates a canonical verify request. Call normalizeVerifyRequest on raw agent input first. */
export function validateVerifyRequest(input: unknown): ValidationResult<VerifyRequest> {
  const r = new Report();
  preSchemaChecks(r, input);
  const product = isRecord(input) && isRecord(input.product) ? input.product : undefined;
  if (typeof product?.gtin === "string" && /^(\d{8}|\d{12,14})$/.test(product.gtin) && !isValidGtin(product.gtin)) {
    r.error("invalid_gtin", "/product/gtin", `${product.gtin} has a bad check digit`);
  }
  if (typeof product?.asin === "string" && !isValidAsin(product.asin)) {
    r.error("invalid_asin", "/product/asin", `${product.asin} is not an ASIN (10 uppercase letters or digits)`);
  }
  merge(r, schemaErrors(verifyRequest, input));
  if (r.errors.length === 0) {
    const req = input as VerifyRequest;
    if (req.territory === undefined && territoryForDomain(req.channel.domain) === null) {
      r.error("territory_required", "/territory", `${req.channel.domain} is a generic domain, so the request must name a territory (section 6.2)`);
    }
    if (req.as_of !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(req.as_of)) ts(r, "/as_of", req.as_of);
  }
  return r.done(input);
}

export function validateVerifyResponse(input: unknown): ValidationResult<VerifyResponse> {
  const r = new Report();
  merge(r, schemaErrors(verifyResponse, input));
  if (r.errors.length === 0) {
    const res = input as VerifyResponse;
    freshnessRules(r, res.checked, "/checked", res);
    if ("expires" in res && res.expires !== undefined) ts(r, "/expires", res.expires);
    if (res.as_of !== undefined) ts(r, "/as_of", res.as_of);
    for (const [i, s] of res.signals.entries()) ts(r, `/signals/${i}/observed`, s.observed);
    if (res.observed) ts(r, "/observed/last_seen", res.observed.last_seen);
  }
  return r.done(input);
}

/** Validates a revocation feed (section 10.3). Does not check the signature: see checkRevocationFeed. */
export function validateRevocationFeed(input: unknown): ValidationResult<RevocationFeed> {
  const r = new Report();
  merge(r, schemaErrors(revocationFeed, input));
  if (r.errors.length === 0) {
    const f = input as RevocationFeed;
    freshnessRules(r, f.issued, "/issued", f);
    f.entries.forEach((e, i) => ts(r, `/entries/${i}/revoked`, e.revoked));
  }
  return r.done(input);
}

/** Validates one authorization scope (section 3), e.g. before the registry stores it. */
export function validateScope(input: unknown): ValidationResult<Scope> {
  const r = new Report();
  if (isRecord(input) && Array.isArray(input.territories)) input.territories.forEach((t, k) => countryRule(r, `/territories/${k}`, t));
  merge(r, schemaErrors(scopeSchema, input));
  return r.done(input);
}

/** Validates one channel identifier (section 6), e.g. before the registry stores it. */
export function validateChannel(input: unknown): ValidationResult<Channel> {
  const r = new Report();
  channelRules(r, "", input);
  merge(r, schemaErrors(channelSchema, input));
  return r.done(input);
}

/** Validates one catalog product (section 3.1), e.g. a row from a brand's CSV import. */
export function validateProduct(input: unknown): ValidationResult<import("./types.js").Product> {
  const r = new Report();
  productIdentifierRules(r, { catalog: [input] });
  r.errors.forEach((e) => (e.path = e.path.replace(/^\/catalog\/0/, "")));
  if (isRecord(input) && typeof input.gtin === "string" && /^(\d{8}|\d{12,14})$/.test(input.gtin) && !isValidGtin(input.gtin)) {
    r.error("invalid_gtin", "/gtin", `${input.gtin} has a bad check digit`);
  }
  merge(r, schemaErrors(productSchema, input));
  return r.done(input);
}
