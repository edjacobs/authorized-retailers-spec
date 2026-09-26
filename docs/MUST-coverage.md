# MUST rules and where they are tested

Every MUST in [spec/spec-v0.1.md](../spec/spec-v0.1.md). Rules this package enforces are tested here. The rest are obligations on registries, indexes or agents, and each implementation has to test them itself. The `fixtures/` suite and the reference verifier are meant to help with that.

| § | Rule | Tested here |
| --- | --- | --- |
| 3 | Every authorization MUST come from the brand | Registry obligation |
| 3 | Each authorization MUST carry a scope (territories, channels, product lines, expiry) | `test/must.test.ts` |
| 4 | A registry MUST verify domain control before accepting authorizations | Registry obligation |
| 4 | A registry MUST link the domain via an independent source; until then, listings MUST be `domain_unlinked` | Registry obligation |
| 4 | On lapse, a registry MUST flag `verification_lapsed`, notify the brand, and MUST NOT keep returning `authorized` | Registry obligation |
| 5 | An authorization's `expires` MUST NOT be later than the file's `expires` | `test/must.test.ts`, fixture `full-authorization-expires-after-file` |
| 5 | Readers MUST treat an expired file as containing no valid authorizations | `test/must.test.ts` (`validAuthorizations`), `test/jws.test.ts` (`list_expired`) |
| 5 | Readers MUST treat an unsigned file, or one whose signature doesn't verify, as no file | `test/jws.test.ts` (`checkPublishedFile`) |
| 5 | Readers MUST check the file's `brand.domain` is the domain it was fetched from | `test/jws.test.ts` (`checkPublishedFile`, `domain_mismatch`) |
| 6 | Every authorization MUST name at least one online channel identifier (`physical` alone fails) | `test/must.test.ts` |
| 6 | Registry-proposed identifier links MUST be confirmed by the brand | Registry obligation |
| 6 | Confirming a marketplace seller ID exists MUST NOT be presented as proof of control | Registry obligation |
| 6 | Agents MUST match on the channel identifier, never the name | `test/must.test.ts` (`channelKey`, `authorizationsForChannel`) |
| 7 | Every answer MUST carry `observed`, and it MUST be `null` unless the status is `authorized` | `test/must.test.ts` (verify-response schema) |
| 8 | Agents MUST reject signatures from keys no longer in the key set | `test/jws.test.ts` (`unknown_kid`) |
| 9 | Every signed answer MUST carry `valid_until`, at most 24 hours after `checked`; agents MUST NOT rely on it afterwards | `test/must.test.ts` (schema and rule), `test/jws.test.ts` (`answer_expired`) |
| 9 | `reason` MUST NOT appear on statuses other than `brand_unverified` | `test/must.test.ts` |
| 9 | Private mode MUST NOT return the brand's other retailers | Schema side (private files carry no retailers; `unlisted` answers name no authorization): `test/must.test.ts`. Otherwise a registry obligation |
| 9 | List endpoints MUST answer private brands exactly as unknown brands | Registry obligation |
| 10 | The verify API MUST reflect a revocation within 15 minutes | Registry obligation |
| 11 | Unclaimed entries MUST be labeled unverified, MUST NOT verify as `authorized`, and MUST link to their source | Registry obligation |
| 12 | Brand accounts MUST use multi-factor authentication | Registry obligation |
| 12 | Agents MUST reject answers past their `valid_until` | `test/jws.test.ts` |
| 12 | Registries MUST NOT publish personal addresses of sole-trader retailers | Registry obligation |
| 12 | A mailbox-address warning MUST NOT change verify answers | Registry obligation |

Also tested, though not MUST-keyword rules: RFC 8785 canonicalization against the RFC's own test vectors (`test/jcs.test.ts`), and the 180-day maximum expiry (fixtures `full-expiry-over-180-days`, `full-max-expiry`).
