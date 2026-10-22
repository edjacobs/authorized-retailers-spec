# Changelog

This file covers the package. Changes to the specification text are also listed in section 14 of [the spec](spec/spec-v0.6.md).

## 0.7.0 (unreleased, draft)

Spec v0.7. Documents name `authorized-retailers/0.7`; pointers may name 0.2 to 0.7. One request field is new; lists, feeds and answers keep their shape.

- Spec v0.7 (`spec/spec-v0.7.md`, the `./spec.md` export). Registry review replaces the independent brand link: the registry MUST review each brand before its list counts, MAY decline or end a registration, and SHOULD publish how it reviews; `domain_unlinked` keeps its value and means the registry has not approved the brand yet (sections 4, 7, 9.5, 12). A verify request MAY carry `price` (`amount`, `currency`), the price the agent sees, which never changes the answer and never reveals a brand's minimum advertised price; the registry MAY keep it with the query log and show the brand, in aggregate, how often agents named a seller and product below its MAP (sections 9, 12). A declaration MAY carry a product `scope` with the same shape as an authorization's; a scoped declaration answers `unauthorized` only for what it names (sections 3.2, 9.1). An authorization dispute the brand doesn't answer within 14 days closes with its current decision standing (section 11). Pointers may name 0.2 to 0.7 and the examples show the document's version (sections 5.1, 5.2, 10.3).
- Schemas: `schemas/0.7/` (new); `verify-request.json` gains the optional `price` object; `common.json`'s `pointerSpecVersion` lists 0.2 to 0.7 (0.6 had left 0.5 out). 0.6 and earlier kept.
- `SPEC_VERSION` is `authorized-retailers/0.7`; `POINTER_SPEC_VERSIONS` adds 0.6. `VerifyRequest` gains `price?: Price`.
- `normalizeVerifyRequest` no longer adds an undefined `channel` key to a request that has none; `validateVerifyRequest` on such a request now returns `{ valid: false }` instead of throwing (reason: the registry answered 500 to any verify body without a channel).
- The registry's agent API paths carry no version: spec section 9 names `POST /verify` and `POST /resolve`, sections 5.1, 5.2 and 10.3 name `/brands/<domain>/list` and `/revocations`, and a registry MUST keep serving the `/v0/` forms. `REGISTRY_REVOCATIONS_URL` is now `https://authorizedretailers.ai/revocations`; the README, the conformance runner and the valid pointer fixture use the unversioned paths (`pointer-v0.2.json` keeps `/v0/`, which stays valid). The pointer schema is unchanged (any `https://authorizedretailers.ai/` URL).
- Spec section 9.8 (new): an agent MUST NOT complete a purchase from a seller the brand has declared `unauthorized` on its own; only after the person has confirmed that purchase, told what the declaration means, or under a standing instruction such as for enforcement test purchases. For `unlisted` it SHOULD prefer an authorized seller and say when it picks another. Agent conduct only: answers, schemas and the conformance decision are unchanged.
- Held: drafted 2026-10-21, not tagged or published.

## 0.6.1 (2026-10-20)

Text only: no schema or version-string change, so nothing the registry serves changes shape. Documents still name `authorized-retailers/0.6`.

- Spec section 8: agents SHOULD cache the key set no longer than the response's `Cache-Control` allows (the registry serves it with a 5-minute lifetime), and refetch on an unknown `kid`, so an emergency rotation reaches every agent within minutes. An agent that passes an answer on without checking its signature SHOULD say it is unverified.
- Spec section 10.1: `valid_until` is presented as when an answer needs re-checking, never as when an authorization ends; the authorization's own end is `expires`.
- README: the key set example caches for the response's lifetime, not "once".
- Reason: an MCP client summarised a signed list as "Valid until 18:08", which read as the retailer's authorization lapsing, and said it had not checked the signature. The registry's MCP instructions and agent guide now say this; the spec says the same so the two agree.

## 0.6.0 (2026-10-19)

Spec v0.6. No schema changes apart from the version string, so the registry's lists, feeds and answers change shape in no way: documents now name `authorized-retailers/0.6`, and pointers may name 0.2 to 0.6. One reference-verifier behavior is stricter (the feed rule below). Collected over several changes and released once.

- Spec v0.6 (`spec/spec-v0.6.md`, the `./spec.md` export). Observation is defined for every channel type and `observed: null` is never a negative signal (section 7); finding sellers a brand hasn't listed is declared outside the spec (section 7); each domain verifies with its own DNS record and nothing carries over between domains or companies (section 4.1); agents SHOULD send a descriptive `User-Agent` (section 9.6); a stale answer is usable when the verify API is unreachable, with a revocation feed issued at or after it (sections 10.2, 10.3, replacing a condition that could never be met); an answer is unusable as `authorized` after its `expires` (section 10.1). Mirrors are openly readable and the first runs on Google Cloud (10.2); sellers that share a platform domain stay out of scope and are assessed case by case (1, 13); an informative section places the check in agentic checkout flows such as UCP and ACP (9.7). Open questions on multi-brand owners, observation beyond Amazon and a UCP/ACP extension field are closed.
- `verifyDocument`: with `allowStale`, the revocation feed must have been issued at or after the answer's `checked` (or the list's `issued`); otherwise `{ valid: false, reason: "revocation_feed_too_old" }`, a new `VerifyFailure`. The `allowStale` comment now says "the verify API is unreachable", not "the registry and every mirror".
- `conformance/`: an agent conformance suite (`run.mjs --agent`), a registry check against the demo brand (`--registry`), and a reference decision. In the repository, not in the npm package.
- `SPEC_VERSION` is `authorized-retailers/0.6`; `POINTER_SPEC_VERSIONS` adds 0.5. Schemas: `schemas/0.6/` (new); 0.5, 0.4, 0.3, 0.2 and 0.1 kept. The `./spec.md` export is v0.6.
- Spec section 12 (new "Query logging" bullet): the query log MUST NOT hold a caller's IP address; it MAY hold a keyed hash of it, the name of the organization that owns the caller's network and the User-Agent; the registry MUST NOT tell a brand which caller asked about it; and SHOULD state in its privacy policy what the log holds, who can see it and for how long. This describes what the reference registry does and now tells callers it does.

## 0.5.0 (2026-10-15)

Breaking: removes distributors and the `proposed_by` field.

- Spec v0.5: distributors are no longer a party. The registry has two parties: the brand that decides and the seller that sells to consumers. The terminology row, the proposal flow and the designation rules are gone, and the section 3 diagram shows a retailer requesting authorization from the brand (spec sections 2, 3).
- Schemas: `proposed_by` is removed from the authorization object (`Authorization` type and `schemas/0.5/common.json`). A v0.5 list MUST NOT include it; readers MUST ignore it in a list published under an earlier version (spec section 5.2). The `list-proposed-by` fixture is now an invalid case.
- Terms: a seller is anyone who sells a brand's products on a channel, authorized or not; a retailer is a seller the brand has authorized. Spec section 2 defines both, and sections 6, 7 and 12 and the section 3 diagram use them that way.
- `package.json` links to the spec repository again (`repository`). npm checks it against the build's provenance, and rejected the 0.5.0 upload without it.
- Pointers may also name `authorized-retailers/0.5`. `SPEC_VERSION` is `authorized-retailers/0.5`.
- Schemas: `schemas/0.5/` (new); 0.4, 0.3, 0.2 and 0.1 kept. The `./spec.md` export is v0.5.
- Reason: the registry has no distributor role. It removed the screens, accounts and proposal flow, and a spec that still described them misled agent builders and brands.

## 0.4.0 (2026-10-07)

The first release since 0.2.0: it includes every 0.3.0 change below, which was never published on its own.


- Spec v0.4: brand-declared unauthorized sellers. A brand that knows a seller is not authorized can say so, instead of leaving it `unlisted` (spec sections 3.2, 9, 11).
- Verify answers: new status `unauthorized` with `declaration_id` and `declared`. `disputed` now carries either `authorization_id` (a dispute on an authorization) or `declaration_id` and `declared` (a dispute on a declaration). `VerifyResponseUnauthorized`, `VerifyResponseDisputedAuthorization` and `VerifyResponseDisputedDeclaration` types.
- Verify requests carry no version. Agents MUST treat a status they don't recognise as not authorized (spec section 9).
- Pointers may also name `authorized-retailers/0.4`. `SPEC_VERSION` is `authorized-retailers/0.4`.
- Schemas: `schemas/0.4/` (new); 0.3, 0.2 and 0.1 kept. The `./spec.md` export is v0.4.

## 0.3.0 (never published; shipped in 0.4.0, breaking)

- Spec v0.3: product-first verification. An agent on a product page sees a product and a seller, not the brand's domain, so verify requests MAY omit `brand_domain` when they give a `product`, and the registry finds the brand from registered brands' catalogs (spec section 9.5).
- Verify requests: `brand_domain` or `product` is required (`brand_or_product_required`). `product` takes `gtin`, `asin`, `walmart_item_id` and `wpid`, one or more. An ASIN alone finds a brand only on an `amazon` channel (`asin_needs_amazon_channel`).
- Verify answers carry `brand` (`domain`, `name`) and `resolved_by` (`brand_domain`, `gtin`, `asin`, `walmart_item_id` or `wpid`), except `product_not_found` and `brand_ambiguous`. New statuses `product_not_found`, `brand_ambiguous` and `brand_mismatch`, the last two with `candidates`. Breaking: 0.2 validators reject these fields.
- Resolve: `validateResolveRequest`, `validateResolveResponse`, `normalizeResolveRequest`, and `schemas/0.3/resolve-request.json` and `resolve-response.json` for `POST /v0/resolve` and the MCP tool `resolve_brand`.
- `resolveClaims` decides resolution from the brands claiming a product's identifiers, and `resolveFromLists` runs it over public lists, so the registry and agents agree. `findProduct` takes any of the identifiers, in the order gtin, asin, walmart_item_id, wpid.
- Pointers: `spec` may be `authorized-retailers/0.2` or `/0.3` (`POINTER_SPEC_VERSIONS`), since the pointer format is unchanged. Brands don't need to replace a pointer published under v0.2.
- Lists MAY carry `brand.aliases`, for display and search only (spec section 4.2). `SPEC_VERSION` is `authorized-retailers/0.3`.
- Schemas are served per version: `schemas/0.3/` (new), `0.2` and `0.1` kept. The `./spec.md` export is v0.3.
- Fixtures: new `resolve-request`, `resolve-response` and `resolve` kinds; `resolve` fixtures pair registered brands' lists and a product with the resolution section 9.5 requires.
- Products: `status`, `status_since`, `recall_url` (required when recalled), `regions` (country codes or `REGION_GROUPS`, e.g. `EU`), `mpns` and `style_code`. Validator codes `recall_url_required`, `invalid_region`, `product_identifier_required`.
- `matchRequest` applies regions (`product_not_for_region`) and returns the product's status, regions and details; `productResult`, `privateProductResult`, `expandRegions` and `productInRegion` are exported. A sent `mpn` or `style_code` is `confirmed` or `mismatched`, with the signal `product_details_mismatch`.
- `normalizeVerifyRequest` fills in `channel.type` from the domain when it's missing.
- Walmart identifiers. Agents on walmart.com see a Walmart item ID, rarely a barcode, so brands selling there need one to be findable, as ASINs do for Amazon. Products MAY carry `walmart_item_ids` (5 to 15 digits, from the walmart.com product URL) and `wpids` (8 to 16 uppercase letters or digits, from Seller Center). Verify and resolve requests take `walmart_item_id` and `wpid`; alone they find a brand only on a `walmart` channel on walmart.com (`walmart_id_needs_walmart_channel`), and a resolve `domain` may be walmart.com. `resolved_by` may be `walmart_item_id` or `wpid`. New validator codes `invalid_walmart_item_id`, `invalid_wpid`; `isValidWalmartItemId`, `isValidWpid`, `PRODUCT_IDENTIFIERS` exported. `findProduct`, `resolveClaims` and `resolveFromLists` take every identifier, tried in the order gtin, asin, walmart_item_id, wpid.
- npm provenance is off until v1. The source repository is private until then, and npm can only attest builds from a public one.
- Release rule: only the major version is held 30 days apart; minor and patch releases can ship any time.
- Editor and maintainer are now given as authorizedretailers.ai, in the spec and in GOVERNANCE.md.
- Governance: one three-part version for the spec and the package. Before 1.0, breaking changes can come in a minor version. Changes are batched into releases, each listed here with its reason.
- Spec: brand domain verification is by DNS TXT record only. The pointer is optional, offered after DNS verification, and never verifies a domain. Its `verify_token` stays so the registry can tell whether a pointer is current. Distributors and retailer web stores publish nothing: the registry confirms them by a sign-in with an email address at their domain. No schema or API changes (spec sections 3, 4, 5.1, 6, 14).

## 0.2.0 (breaking)

- Spec v0.2: an open format with a single registry. authorizedretailers.ai is the only registry and its key set is the trust anchor. See spec section 14, 2026-09-28, for every change.
- Domain verification is a DNS TXT record or the `verify_token` in an optional pointer. The hosted verify file is gone.
- `full` and `private` file forms removed. `validateFile(input, fetchedFrom)` validates pointers only: it rejects other forms (`form_not_supported`), a `list` off the registry (`list_not_on_registry`) and a `brand.domain` that isn't the fetched domain (`brand_domain_mismatch`).
- Signed lists live on the registry: `validateList` (replaces `validateFullFile`) and `checkPublishedList(brandDomain, list, jwks, opts)` (replaces `checkPublishedFile`). Lists carry `brand.domains`, `issued`, `valid_until` and `stale_until` in place of `expires`, an optional `catalog` and `exclusions`, and a signed `"public": false` form.
- Channels: `domain` replaces `marketplace` on `amazon`, `walmart` and `ebay`, and must be one of that type's marketplace domains (`MARKETPLACE_DOMAINS`). `physical` is removed. The old field and type are rejected (`marketplace_field_removed`, `unknown_channel_type`). `channelKey()` keys marketplaces by domain.
- Territory: `territoryForDomain()`, `effectiveTerritories()` and `coversTerritory()`. `scope.territories` is optional, required only for web stores on generic domains (`territories_required`), and must not contradict a marketplace's country (`territory_mismatch`). Country codes are checked against ISO 3166-1 (`invalid_country`; `UK` is rejected, `normalizeVerifyRequest` maps it to `GB`). ccTLD stores listing another territory get a `territory_differs_from_domain` warning. Validation results now carry `warnings`.
- Catalog and products: `isValidGtin`, `toGtin14`, `isValidAsin`, `findProduct`, `productCoverage`, `productCovered`, `validateProduct`, and catalog checks (`invalid_gtin`, `invalid_asin`, `product_without_identifier`, `duplicate_identifier`, `duplicate_product_id`, `unknown_product_line`, `unknown_product`).
- `matchRequest(list, request, now)` answers a verify request from a public list, seller first and then product (spec section 9), so the registry and agents caching a list agree.
- Verify: requests take optional `territory`, `product` (`gtin` or `asin`) and `as_of`. Answers carry `stale_until`, `product`, `revocation_id` (authorized only) and optional `unlisted` reasons. `brand_unverified` is renamed `brand_not_registered`. `valid_until` is at most 15 minutes.
- Freshness: `verifyDocument(doc, jwks, { allowStale, revocationFeed })` accepts a list or answer between `valid_until` and `stale_until` as `{ valid: true, stale: true }`, only with a valid revocation feed that doesn't list its `revocation_id`. New `checkRevocationFeed`, `isRevoked`, `validateRevocationFeed`. `validAuthorizations(list, now, feed)` drops revoked authorizations.
- Constants: `MAX_EXPIRY_MS`, `DEFAULT_EXPIRY_MS` and `MAX_ANSWER_VALIDITY_MS` are removed; `MAX_VALIDITY_MS` (15 minutes) and `MAX_STALE_MS` (24 hours) replace them.
- Schemas are served per version: `schemas/0.2/` (new) and `schemas/0.1/` (unchanged, kept for history). The `./spec.md` export is v0.2; `./spec/*` exports every version.
- Fixtures: new `pointer`, `list`, `revocation-feed` and `match` kinds; `match` fixtures pair a list and request with the answer section 9 requires.
- Release: a tag now publishes to npm and deploys the matching spec pages on authorizedretailers.ai in one workflow.


## 0.1.1

- Spec: scope is consumer-facing online channels; every authorization MUST name at least one online channel identifier, so `physical` alone no longer authorizes; two new open questions (spec sections 1, 6, 13, 14, 2026-09-26).
- Schema: `authorization.channels` must contain an `amazon`, `walmart`, `ebay` or `web` identifier. The validator reports a physical-only authorization as `no_online_channel`.
- Governance: removed the 30-day public comment promise. Every change is listed in the changelog, with a note where feedback shaped it.

## 0.1.0

- First draft of the specification, schemas, fixtures, validator, canonicalization and signing.
- Spec: distributors propose only if designated; held requests; retailer-side channel proof; seller identity; mailbox address warnings; corrected the note on observation (spec section 14, 2026-09-25).
- Examples and fixtures use reserved `.example` domains.
- Build: compiled with `tsc` to ESM and `.d.ts` in `dist/`. Schemas are embedded in `src/schemas.ts`, so the package needs no JSON imports.
- The specification license file is now `LICENSE-SPEC`.
