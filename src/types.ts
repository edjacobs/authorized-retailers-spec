// Types mirror schemas/*.json. The schemas are canonical; if the two disagree, the schema wins.

export const SPEC_VERSION = "authorized-retailers/0.1" as const;
export type SpecVersion = typeof SPEC_VERSION;

/** RFC 3339 UTC timestamp, e.g. "2026-09-23T00:00:00Z". */
export type Timestamp = string;

export interface Brand {
  name: string;
  domain: string;
}

export type MarketplaceChannelType = "amazon" | "walmart" | "ebay";

export interface MarketplaceChannel {
  type: MarketplaceChannelType;
  marketplace: string;
  seller_id: string;
}

export interface WebChannel {
  type: "web";
  domain: string;
}

export interface PhysicalChannel {
  type: "physical";
  address: string;
  country: string;
}

/** A channel an agent can see and match on (section 6). */
export type VerifiableChannel = MarketplaceChannel | WebChannel;
export type Channel = VerifiableChannel | PhysicalChannel;
export type ChannelType = Channel["type"];

export interface Party {
  name: string;
  entity_id?: string;
}

export interface Scope {
  /** ISO 3166-1 alpha-2 codes, or exactly ["*"]. */
  territories: string[];
  /** Named product lines, or exactly ["all"]. */
  product_lines: string[];
}

export interface Authorization {
  id: string;
  retailer: Party;
  channels: Channel[];
  scope: Scope;
  proposed_by?: Party | null;
  expires: Timestamp;
}

export interface Signature {
  kid: string;
  /** Detached compact JWS: "<header>..<signature>". */
  jws: string;
}

export interface FullFile {
  spec: SpecVersion;
  form: "full";
  brand: Brand;
  issued: Timestamp;
  expires: Timestamp;
  authorizations: Authorization[];
  signature?: Signature;
}

export interface PointerFile {
  spec: SpecVersion;
  form: "pointer";
  brand: Brand;
  list: string;
}

export interface PrivateFile {
  spec: SpecVersion;
  form: "private";
  brand: Brand;
  verify: string;
}

export type AuthorizedRetailersFile = FullFile | PointerFile | PrivateFile;
export type FileForm = AuthorizedRetailersFile["form"];

export interface VerifyRequest {
  brand_domain: string;
  channel: VerifiableChannel;
  territory: string;
  /** Defaults to "all". */
  product_line?: string;
}

export type VerifyStatus = "authorized" | "unlisted" | "expired" | "brand_unverified" | "disputed";
export type UnverifiedReason = "not_registered" | "domain_unlinked" | "verification_lapsed";

export interface Signal {
  type: string;
  observed: Timestamp;
  detail?: string;
}

/** Section 7: the registry saw this seller selling on the channel within the last 30 days. */
export interface Observation {
  last_seen: Timestamp;
}

interface VerifyResponseBase {
  checked: Timestamp;
  /** At most 24 hours after `checked` (section 9). */
  valid_until: Timestamp;
  /** Non-null only on `authorized` answers (section 7). */
  observed: Observation | null;
  signals: Signal[];
  signature: Signature;
}

export interface VerifyResponseWithAuthorization extends VerifyResponseBase {
  status: "authorized" | "expired" | "disputed";
  authorization_id: string;
  expires: Timestamp;
}

export interface VerifyResponseUnlisted extends VerifyResponseBase {
  status: "unlisted";
}

export interface VerifyResponseBrandUnverified extends VerifyResponseBase {
  status: "brand_unverified";
  reason?: UnverifiedReason;
}

export type VerifyResponse =
  | VerifyResponseWithAuthorization
  | VerifyResponseUnlisted
  | VerifyResponseBrandUnverified;

/** A verify response before the registry attaches its signature. */
export type UnsignedVerifyResponse = VerifyResponse extends infer R
  ? R extends VerifyResponseBase
    ? Omit<R, "signature">
    : never
  : never;
