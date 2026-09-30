// Types mirror schemas/0.3/*.json. The schemas are canonical; if the two disagree, the schema wins.

export const SPEC_VERSION = "authorized-retailers/0.3" as const;
export type SpecVersion = typeof SPEC_VERSION;

/** RFC 3339 UTC timestamp, e.g. "2026-09-28T00:00:00Z". */
export type Timestamp = string;

export type MarketplaceChannelType = "amazon" | "walmart" | "ebay";

/** Section 6: a marketplace seller, identified by the marketplace domain and seller ID. */
export interface MarketplaceChannel {
  type: MarketplaceChannelType;
  /** One of that type's marketplace domains, e.g. "amazon.com" (see MARKETPLACE_DOMAINS). */
  domain: string;
  seller_id: string;
}

export interface WebChannel {
  type: "web";
  domain: string;
}

/** Section 6: every channel is identified by a domain. */
export type Channel = MarketplaceChannel | WebChannel;
export type ChannelType = Channel["type"];

export interface Party {
  name: string;
  entity_id?: string;
}

/** Section 3.1: one product in a brand's catalog. Has a gtin, asins or both. */
export interface Product {
  id: string;
  name: string;
  product_line?: string;
  attributes?: Record<string, string>;
  gtin?: string;
  asins?: string[];
}

export interface Scope {
  /** ISO 3166-1 alpha-2 codes, or exactly ["*"]. Optional: most channels take territory from their domain (section 6.2). */
  territories?: string[];
  /** Named product lines, or exactly ["all"]. */
  product_lines?: string[];
  /** Catalog product IDs. */
  products?: string[];
  exclude_product_lines?: string[];
  exclude_products?: string[];
}

export interface Exclusions {
  product_lines?: string[];
  products?: string[];
}

export interface Authorization {
  id: string;
  /** Section 10.3: random, replaced whenever the authorization's coverage shrinks. */
  revocation_id: string;
  retailer: Party;
  channels: Channel[];
  scope: Scope;
  proposed_by?: Party | null;
  /** Optional end date set by the brand (section 10). */
  expires?: Timestamp;
}

export interface Signature {
  kid: string;
  /** Detached compact JWS: "<header>..<signature>". */
  jws: string;
}

/** Section 5.1: the pointer format is unchanged since v0.2, so a pointer may name either version. */
export const POINTER_SPEC_VERSIONS = ["authorized-retailers/0.2", SPEC_VERSION] as const;
export type PointerSpecVersion = (typeof POINTER_SPEC_VERSIONS)[number];

/** Section 5.1: the optional, unsigned file at /.well-known/authorized-retailers.json. */
export interface PointerFile {
  spec: PointerSpecVersion;
  form: "pointer";
  brand: { name: string; domain: string };
  verify_token: string;
  /** Always an https://authorizedretailers.ai/ URL. */
  list: string;
}

/** The only file form since v0.2. */
export type AuthorizedRetailersFile = PointerFile;
export type FileForm = PointerFile["form"];

interface ListBase {
  spec: SpecVersion;
  /** aliases: section 4.2, for display and search only. */
  brand: { name: string; domains: string[]; aliases?: string[] };
  issued: Timestamp;
  /** At most 15 minutes after issued (section 10.1). */
  valid_until: Timestamp;
  /** At most 24 hours after issued (section 10.2). */
  stale_until: Timestamp;
  signature: Signature;
}

/** Section 5.2: a brand's signed list, as published by the registry. */
export interface PublicList extends ListBase {
  public: true;
  catalog?: Product[];
  exclusions?: Exclusions;
  authorizations: Authorization[];
}

/** Section 5.2: the signed response for a brand whose list is not public. */
export interface NotPublicList extends ListBase {
  public: false;
}

export type SignedList = PublicList | NotPublicList;

/** A product by GTIN, ASIN or both (section 9). */
export type ProductRef = { gtin: string; asin?: string } | { gtin?: string; asin: string };

/** At least one of brand_domain or product (section 9). */
export interface VerifyRequest {
  brand_domain?: string;
  channel: Channel;
  /** Defaults to the channel domain's country. Required for web stores on generic domains. */
  territory?: string;
  product_line?: string;
  product?: ProductRef;
  /** ISO 8601 date or UTC date-time. Defaults to now. */
  as_of?: string;
}

export type VerifyStatus =
  | "authorized"
  | "unlisted"
  | "expired"
  | "brand_not_registered"
  | "disputed"
  | "product_not_found"
  | "brand_ambiguous"
  | "brand_mismatch";

/** Section 9.5: the brand an answer is about. name is absent for a domain that is not registered. */
export interface AnswerBrand {
  domain: string;
  name?: string;
}

/** Section 9.5: how the registry found the brand. */
export type ResolvedBy = "brand_domain" | "gtin" | "asin";
export type NotRegisteredReason = "not_registered" | "domain_unlinked" | "verification_lapsed";
export type UnlistedReason = "territory_mismatch" | "product_excluded" | "product_not_in_scope" | "product_not_in_catalog";

export interface Signal {
  type: string;
  observed: Timestamp;
  detail?: string;
}

/** Section 7: the registry saw this seller selling on the channel within the last 30 days. */
export interface Observation {
  last_seen: Timestamp;
}

/** Section 9: present when the request named a product. id and product_line only for public lists. */
export interface ProductResult {
  in_catalog: boolean;
  id?: string;
  product_line?: string;
}

interface VerifyResponseBase {
  /** Absent only on product_not_found and brand_ambiguous. */
  brand?: AnswerBrand;
  resolved_by?: ResolvedBy;
  checked: Timestamp;
  as_of?: Timestamp;
  /** At most 15 minutes after `checked` (section 9). */
  valid_until: Timestamp;
  /** At most 24 hours after `checked` (section 10.2). */
  stale_until: Timestamp;
  product?: ProductResult;
  /** Non-null only on `authorized` answers (section 7). */
  observed: Observation | null;
  signals: Signal[];
  signature: Signature;
}

export interface VerifyResponseAuthorized extends VerifyResponseBase {
  status: "authorized";
  authorization_id: string;
  revocation_id: string;
  expires?: Timestamp;
}

export interface VerifyResponseExpired extends VerifyResponseBase {
  status: "expired";
  authorization_id: string;
  expires: Timestamp;
}

export interface VerifyResponseDisputed extends VerifyResponseBase {
  status: "disputed";
  authorization_id: string;
  expires?: Timestamp;
}

export interface VerifyResponseUnlisted extends VerifyResponseBase {
  status: "unlisted";
  reason?: UnlistedReason;
}

export interface VerifyResponseNotRegistered extends VerifyResponseBase {
  status: "brand_not_registered";
  reason?: NotRegisteredReason;
}

/** Section 9.5: no registered brand's catalog holds the product. */
export interface VerifyResponseProductNotFound extends VerifyResponseBase {
  status: "product_not_found";
}

/** Section 9.5: more than one registered brand claims the product. Never authorized. */
export interface VerifyResponseAmbiguous extends VerifyResponseBase {
  status: "brand_ambiguous";
  candidates: AnswerBrand[];
}

/** Section 9.5: the product belongs to other brands, not to brand_domain. Never authorized. */
export interface VerifyResponseMismatch extends VerifyResponseBase {
  status: "brand_mismatch";
  candidates: AnswerBrand[];
}

export type VerifyResponse =
  | VerifyResponseAuthorized
  | VerifyResponseExpired
  | VerifyResponseDisputed
  | VerifyResponseUnlisted
  | VerifyResponseNotRegistered
  | VerifyResponseProductNotFound
  | VerifyResponseAmbiguous
  | VerifyResponseMismatch;

/** A verify response before the registry attaches its signature. */
export type UnsignedVerifyResponse = VerifyResponse extends infer R
  ? R extends VerifyResponseBase
    ? Omit<R, "signature">
    : never
  : never;

/** Section 10.3: the signed feed of revocation IDs from the last 24 hours. */
export interface RevocationFeed {
  spec: SpecVersion;
  feed: "revocations";
  issued: Timestamp;
  valid_until: Timestamp;
  stale_until: Timestamp;
  entries: { revocation_id: string; revoked: Timestamp }[];
  signature: Signature;
}

/** Section 9.5: which registered brand a product belongs to. */
export interface ResolveRequest {
  product: ProductRef;
  /** The Amazon marketplace domain the ASIN was seen on. */
  domain?: string;
}

export type ResolveStatus = "resolved" | "product_not_found" | "brand_ambiguous";

export interface ResolveResponse {
  status: ResolveStatus;
  /** Only on resolved. */
  brand?: AnswerBrand;
  resolved_by?: "gtin" | "asin";
  /** Only on brand_ambiguous: two or more brands. */
  candidates?: AnswerBrand[];
  checked: Timestamp;
  valid_until: Timestamp;
  stale_until: Timestamp;
  signature: Signature;
}

export type UnsignedResolveResponse = Omit<ResolveResponse, "signature">;
