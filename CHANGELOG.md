# Changelog

This file covers the package. Changes to the specification text are also listed in section 14 of [the spec](spec/spec-v0.2.md).

## Unreleased

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
