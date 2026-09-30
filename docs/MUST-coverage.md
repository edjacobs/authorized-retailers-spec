# MUST rules and where they are tested

Every MUST in [spec/spec-v0.3.md](../spec/spec-v0.3.md). Rules this package enforces are tested here. The rest are obligations on the registry or on agents, and each implementation has to test them itself. The `fixtures/` suite (including the `match` and `resolve` cases) and the reference verifier are meant to help with that.

| § | Rule | Tested here |
| --- | --- | --- |
| 3 | Every authorization MUST come from the brand | Registry obligation |
| 3 | The registry MUST NOT add, remove or change an authorization except on the brand's instruction or approval | Registry obligation |
| 3 | The registry MUST keep a change log for each brand and MUST show it to the brand | Registry obligation |
| 3 | Each authorization MUST carry channels and a product scope (product lines, products or both) | `test/must.test.ts`, fixtures `list-missing-scope`, `list-scope-no-products` |
| 3.1 | Each product MUST have a `gtin` or at least one ASIN | `test/must.test.ts`, fixture `list-product-no-identifier` |
| 3.1 | A GTIN or ASIN MUST NOT appear on two products | `test/must.test.ts`, fixtures `list-duplicate-asin`, `list-duplicate-gtin` |
| 3.1 | Named and excluded product lines and products MUST exist in the catalog | `test/must.test.ts`, fixtures `list-unknown-line`, `list-unknown-product`, `list-exclude-unknown-product`, `list-brand-exclusion-no-catalog` |
| 3.1 | A recalled product MUST name its `recall_url` | `test/must.test.ts`, fixtures `list-recalled-no-url`, `recalled-without-url` |
| 3.1 | Model numbers and style codes MUST NOT find a brand or product alone | `test/must.test.ts`, fixture `mpn-only` |
| 3.1 | A product is covered only in its `regions` | `test/must.test.ts`, match fixtures `product-not-for-region`, `eu-group-excludes-gb` |
| 9 | A sent `channel.type` MUST agree with the domain | `test/must.test.ts` (`marketplace_domain_mismatch`) |
| 9 | Agents MUST tell the user about a recalled product | Agent obligation. The answer carries `product.status` and `recall_url` (match fixture `recalled-authorized`) |
| 9.3 | Status shows on lists that aren't public; nothing else about the catalog does | `test/must.test.ts` (`privateProductResult`) |
| 4 | The registry MUST verify control of a domain before accepting authorizations for it | Registry obligation |
| 4 | The registry MUST link the domain to the brand through an independent source | Registry obligation |
| 4 | On lapse, the registry MUST treat the domain as `verification_lapsed`, notify the brand, and MUST NOT keep returning `authorized` | Registry obligation |
| 5.1 | Readers MUST treat a file with any `form` other than `pointer` as no file | `test/must.test.ts`, fixtures `full-form`, `private-form`, `unknown-form` |
| 5.1 | `brand.domain` MUST be the domain the pointer was fetched from, also after redirects | `test/must.test.ts`, fixtures `pointer-domain-mismatch`, `pointer-fetched-via-www` |
| 5.1 | `list` MUST be an `https://authorizedretailers.ai/` URL | `test/must.test.ts`, fixture `pointer-other-host` |
| 5.1 | A pointer names `authorized-retailers/0.2` or `/0.3` | fixtures `pointer-v0.2`, `pointer-wrong-spec` |
| 5.2 | Readers MUST treat an unsigned list, or one whose signature doesn't verify, as no list; a list counts only for the domains it names | `test/jws.test.ts` (`checkPublishedList`) |
| 6 | Every authorization MUST name at least one channel identifier | `test/must.test.ts`, fixtures `list-no-channels`, `list-name-only-retailer` |
| 6 | A marketplace channel's `domain` MUST be one of that type's marketplace domains; a `web` channel MUST NOT use one | `test/must.test.ts`, fixtures `list-amazon-on-walmart-domain`, `list-web-on-marketplace-domain` |
| 6 | Readers MUST reject the removed `marketplace` field and `physical` type | `test/must.test.ts`, fixtures `list-marketplace-field`, `list-physical`, `marketplace-field`, `physical-channel` |
| 6.1 | Agents MUST match on the channel identifier, never the name | `test/must.test.ts` (`channelKey`, `authorizationsForChannel`), fixture `match-by-channel-key` |
| 6.1 | Registry-proposed identifier links MUST be confirmed by the brand | Registry obligation |
| 6.2 | A web store on a generic domain MUST list `scope.territories` | `test/must.test.ts`, fixture `list-generic-web-no-territories` |
| 6.3 | Confirming a marketplace seller ID exists MUST NOT be presented as proof of control | Registry obligation |
| 7 | Every answer MUST carry `observed`, and it MUST be `null` unless the status is `authorized` | `test/must.test.ts` (verify-response schema) |
| 8 | Agents MUST reject signatures from keys no longer in the key set | `test/jws.test.ts` (`unknown_kid`) |
| 8 | Agents MUST NOT trust a key they haven't fetched from authorizedretailers.ai | Agent obligation |
| 9 | Every signed answer MUST carry `valid_until` (at most 15 minutes after `checked`) and `stale_until` (at most 24 hours) | `test/must.test.ts`, fixtures `valid-until-over-15-minutes`, `stale-until-over-24-hours` |
| 9 | `reason` MUST NOT appear on `authorized`, `expired` or `disputed` | `test/must.test.ts`, fixture `authorized-with-reason` |
| 9.3 | For a list that is not public, the verify API MUST NOT return the brand's other retailers or catalog | Schema side (not-public lists carry neither; unlisted answers name no authorization; products outside the catalog carry no ID): `test/must.test.ts`. Otherwise a registry obligation |
| 10 | The verify API MUST reflect a revocation within 1 minute | Registry obligation |
| 4.2 | A name or alias MUST NOT resolve a brand | `test/must.test.ts`, fixtures `resolve-request/invalid/brand-name` |
| 9 | A verify request MUST name a `brand_domain`, a `product` or both | `test/must.test.ts`, fixture `no-brand-no-product` |
| 9 | Finding a brand by ASIN alone MUST use an `amazon` channel | `test/must.test.ts`, fixture `asin-only-on-walmart` |
| 9 | A GTIN with a bad check digit MUST be rejected | `test/must.test.ts`, fixtures `product-only-bad-gtin`, `resolve-request/invalid/bad-gtin` |
| 9.5 | A catalog on a domain that is not registered MUST NOT resolve | Registry obligation |
| 9.5 | More than one brand claiming a product MUST NOT answer `authorized` | `test/must.test.ts` (`resolveClaims`, verify-response schema), `resolve` fixtures `shared-gtin`, `gtin-and-asin-disagree` |
| 9.5 | A product outside `brand_domain`'s catalog and claimed by other brands MUST answer `brand_mismatch` | Registry obligation; schema requires `candidates` (`test/must.test.ts`) |
| 9.5 | Finding the brand MUST NOT reveal retailers, or catalog data of a list that isn't public | `test/must.test.ts` (resolve-response schema); rest is a registry obligation |
| 10.1 | Agents MUST NOT rely on a cached list or answer past its `valid_until`, except as 10.2 allows | `test/jws.test.ts` (`answer_expired`, `list_expired`) |
| 10.2 | Agents MUST NOT describe a seller as authorized without a current or allowed stale answer | Agent obligation. `verifyDocument` refuses stale documents unless `allowStale` is set and a feed is given |
| 10.2 | Agents MUST mark a stale result as stale | `verifyDocument` returns `stale: true`; showing it is an agent obligation |
| 10.3 | Agents MUST check a stale answer or list against a feed that is itself before its `stale_until`, and MUST drop revoked authorizations | `test/jws.test.ts` (`revocation_feed_required`, `revoked`, `feed_expired`, `validAuthorizations` with a feed) |
| 11 | Unclaimed entries MUST be labeled unverified, MUST NOT verify as `authorized`, and MUST link to their source | Registry obligation |
| 12 | Brand accounts MUST use multi-factor authentication | Registry obligation |
| 12 | A mailbox-address warning MUST NOT change verify answers | Registry obligation |
| 12 | The registry MUST NOT publish personal addresses of sole-trader retailers | Registry obligation |
| 12 | Agents MUST reject answers past their `valid_until`, except as 10.2 allows | `test/jws.test.ts` |

Also tested, though not MUST-keyword rules: RFC 8785 canonicalization against the RFC's own test vectors (`test/jcs.test.ts`); the section 9.2 product matching rules, territory mismatch, `as_of` and end dates (`fixtures/match/`); marketplace territory mismatch in a list (`list-marketplace-territory-mismatch`); and the `territory_differs_from_domain` warning.
