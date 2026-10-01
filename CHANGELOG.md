# Changelog

This file covers the package. Changes to the specification text are also listed in section 14 of [the spec](spec/spec-v0.3.md).

## Unreleased (0.3.0, breaking)

- Spec v0.3: product-first verification. An agent on a product page sees a product and a seller, not the brand's domain, so verify requests MAY omit `brand_domain` when they give a `product`, and the registry finds the brand from registered brands' catalogs (spec section 9.5).
- Verify requests: `brand_domain` or `product` is required (`brand_or_product_required`). `product` takes `gtin`, `asin` or both. An ASIN alone finds a brand only on an `amazon` channel (`asin_needs_amazon_channel`).
- Verify answers carry `brand` (`domain`, `name`) and `resolved_by` (`brand_domain`, `gtin` or `asin`), except `product_not_found` and `brand_ambiguous`. New statuses `product_not_found`, `brand_ambiguous` and `brand_mismatch`, the last two with `candidates`. Breaking: 0.2 validators reject these fields.
- Resolve: `validateResolveRequest`, `validateResolveResponse`, `normalizeResolveRequest`, and `schemas/0.3/resolve-request.json` and `resolve-response.json` for `POST /v0/resolve` and the MCP tool `resolve_brand`.
- `resolveClaims` decides resolution from the brands claiming a product's GTIN and ASIN, and `resolveFromLists` runs it over public lists, so the registry and agents agree. `findProduct` takes a GTIN, an ASIN or both, GTIN first.
- Pointers: `spec` may be `authorized-retailers/0.2` or `/0.3` (`POINTER_SPEC_VERSIONS`), since the pointer format is unchanged. Brands don't need to replace a pointer published under v0.2.
- Lists MAY carry `brand.aliases`, for display and search only (spec section 4.2). `SPEC_VERSION` is `authorized-retailers/0.3`.
- Schemas are served per version: `schemas/0.3/` (new), `0.2` and `0.1` kept. The `./spec.md` export is v0.3.
- Fixtures: new `resolve-request`, `resolve-response` and `resolve` kinds; `resolve` fixtures pair registered brands' lists and a product with the resolution section 9.5 requires.
- Products: `status`, `status_since`, `recall_url` (required when recalled), `regions` (country codes or `REGION_GROUPS`, e.g. `EU`), `mpns` and `style_code`. Validator codes `recall_url_required`, `invalid_region`, `product_identifier_required`.
- `matchRequest` applies regions (`product_not_for_region`) and returns the product's status, regions and details; `productResult`, `privateProductResult`, `expandRegions` and `productInRegion` are exported. A sent `mpn` or `style_code` is `confirmed` or `mismatched`, with the signal `product_details_mismatch`.
- `normalizeVerifyRequest` fills in `channel.type` from the domain when it's missing.
- Walmart identifiers. Agents on walmart.com see a Walmart item ID, rarely a barcode, so brands selling there need one to be findable, as ASINs do for Amazon. Products MAY carry `walmart_item_ids` (5 to 15 digits, from the walmart.com product URL) and `wpids` (8 to 16 uppercase letters or digits, from Seller Center). Verify and resolve requests take `walmart_item_id` and `wpid`; alone they find a brand only on a `walmart` channel on walmart.com (`walmart_id_needs_walmart_channel`), and a resolve `domain` may be walmart.com. `resolved_by` may be `walmart_item_id` or `wpid`. New validator codes `invalid_walmart_item_id`, `invalid_wpid`; `isValidWalmartItemId`, `isValidWpid`, `PRODUCT_IDENTIFIERS` exported. `findProduct`, `resolveClaims` and `resolveFromLists` take every identifier, tried in the order gtin, asin, walmart_item_id, wpid.
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
