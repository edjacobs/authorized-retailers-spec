# authorized-retailers.json

An open format with a single registry, for brands to record which retailers they have authorized and for software to check a seller against that record.

> **Status: draft v0.5.** Breaking changes are possible before v1.0. See [GOVERNANCE.md](GOVERNANCE.md) for how changes are made.

The standard answers one question: has this brand authorized this seller, on this channel, in this territory, for this product, as of this date? Built for AI shopping agents to check before they recommend or buy. It works just as well for marketplaces, brand protection teams and anyone else who needs the answer.

- **Read the spec:** [`spec/spec-v0.5.md`](spec/spec-v0.5.md), also at [authorizedretailers.ai/spec](https://authorizedretailers.ai/spec)
- **The registry:** [authorizedretailers.ai](https://authorizedretailers.ai). The registry currently lists US channels. Other countries are coming.

## Core principles

- **Every authorization comes from the brand.** No one else can authorize a seller: not another seller and not the registry. The registry confirms the brand controls its domain, publishes the brand's list and signs it. It never changes a list on its own. The signature says who published the list, not who is authorized.
- **Sellers can request, only the brand approves.** A request changes nothing until the brand says yes.
- **Authorization is scoped.** Each authorization names its channels and territories and the product lines or products it covers. It lasts until the brand revokes it, or until an end date if the brand sets one.
- **One source of truth.** authorizedretailers.ai is the only registry. An answer counts only if it verifies against the registry's published keys. Anyone may cache or relay signed answers, but no one else can issue them.
- **Authorization is not authenticity.** An answer says what the brand has approved. It does not say whether any item is genuine.
- **The registry doesn't rule on pricing.** Pricing and commercial terms are between the brand and its retailers.
- **Listing is free.** Brands publish and retailers are listed at no cost.
- **Retailers can see and dispute their status.** A retailer can check how it is listed and dispute an entry it believes is wrong (spec section 11).

## Who it's for

| You are | You use it to |
| --- | --- |
| A brand | Record which retailers you've authorized, where and for which products |
| An agent builder | Check a seller before recommending or buying, with an answer you can verify |

## Register a brand

A brand keeps its catalog and authorizations on the registry, which signs its list. The list lives on the registry, so it is always current. The brand proves it controls its domain with a DNS TXT record, which works on every site platform:

```
authorizedretailers-verify=<token from the registry>
```

Once the domain is verified, a brand that can serve files under `/.well-known/` may also serve a pointer. The pointer helps software that finds brands by domain. It never verifies the domain:

```
https://<brand-domain>/.well-known/authorized-retailers.json
```

```json
{
  "spec": "authorized-retailers/0.4",
  "form": "pointer",
  "brand": { "name": "Example Brand", "domain": "brand.example" },
  "verify_token": "<token from the registry>",
  "list": "https://authorizedretailers.ai/v0/brands/brand.example/list"
}
```

The pointer holds no authorization data, so it never goes out of date. The token is public: it proves control only of the domain it was issued for. The registry rechecks the DNS record daily. If it is removed, the brand's list stops counting until it is restored. The pointer itself is not signed. The list it names is, and so is every answer from the verify endpoint.

### Add your products

Agents on a product page see a product identifier and a seller, not your domain. Your catalog is how they find you. A UPC or EAN column is enough to start. If you sell on Amazon, add ASINs too: Amazon listings show ASINs more reliably than barcodes. If you sell on Walmart, add Walmart item IDs (the number in a walmart.com product URL) and, if you like, WPIDs (spec section 3.1).

## Validate a pointer and a list

```bash
npm install @authorizedretailers/spec
```

```js
import { validateFile, checkPublishedList, validAuthorizations } from "@authorizedretailers/spec";

// The registry's public keys. Fetch once and cache.
const jwks = await fetch("https://authorizedretailers.ai/.well-known/jwks.json").then((r) => r.json());

const pointer = await fetch("https://brand.example/.well-known/authorized-retailers.json").then((r) => r.json());
const file = validateFile(pointer, "brand.example");
if (!file.valid) console.log(file.errors);

// Fetch the signed list the pointer names, then check it.
const list = await fetch(file.value.list).then((r) => r.json());
const check = await checkPublishedList("brand.example", list, jwks);
// { counts: true, kid } or { counts: false, reason }

if (check.counts && list.public) {
  const current = validAuthorizations(list); // leaves out authorizations past their end date
}
```

A brand with only a DNS record has no pointer. Its list is at the same registry URL: `https://authorizedretailers.ai/v0/brands/<domain>/list`.

The package works in Node 20+, Cloudflare Workers, Deno and browsers. It uses only Web Crypto, makes no network calls and sends no telemetry.

## Verify a signed registry answer (agent builders)

Ask the registry whether a seller is authorized, then verify the answer against the registry's published keys (`jwks`, fetched above):

```js
import { verifyDocument } from "@authorizedretailers/spec";

const answer = await fetch("https://authorizedretailers.ai/v0/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    channel: { domain: "amazon.com", seller_id: "A1B2C3D4E5F6G7" }, // type is implied by the domain
    product: { asin: "B0EXAMPLE1" },  // or { gtin: "012345678905" } for a UPC or EAN, or { walmart_item_id: "123456789" } on Walmart; add mpn to confirm the model
    // Optional:
    brand_domain: "brand.example",    // if you know it; otherwise the registry finds it from the product
    territory: "US",                  // defaults to the domain's country
    as_of: "2026-09-28",              // defaults to now
  }),
}).then((r) => r.json());

const verified = await verifyDocument(answer, jwks);
// { valid: true, kid } or { valid: false, reason }
// answer.brand and answer.resolved_by say which brand the answer is about and how it was found.
```

Without a `brand_domain`, the registry finds the brand from the product through registered brands' catalogs (spec section 9.5). If no registered brand has the product the answer is `product_not_found`. If more than one claims it, the answer is `brand_ambiguous` with the `candidates`, never `authorized`. If you give a `brand_domain` and the product belongs to other brands, the answer is `brand_mismatch`. An ASIN alone finds a brand only on an Amazon channel, and a Walmart item ID or WPID alone only on walmart.com. Check `answer.product.status`: if it is `recalled`, tell your user and don't complete the purchase, whatever the seller's status. To find the brand without asking about a seller, `POST /v0/resolve` with `{ "product": { "gtin": "012345678905" } }`.

`unauthorized` means the brand has declared the seller not authorized, unlike `unlisted`, which only means the brand hasn't authorized it. A seller disputing a declaration is `disputed` until the brand reconfirms or withdraws it, or 30 days pass. Treat any status you don't recognise as not authorized (spec sections 3.2, 9, 11).

Marketplace channels are identified by their domain and seller ID, and web stores by their domain. A marketplace domain sets the territory (amazon.com is US, amazon.ca is CA), and a request for a different territory is answered `unlisted`. Ask with a GTIN or, on Amazon, an ASIN, or on Walmart, a Walmart item ID or WPID. Authorization is decided per seller first, then checked against the product lines or products the brand has authorized. Every answer that includes a product says whether it is in the brand's catalog. A product that isn't may be a duplicate listing.

The verifier rejects keys no longer in the key set and answers past their `valid_until` (15 minutes). On `unknown_kid`, fetch the key set again once. Match sellers on the identifier you see, never on a retailer name: `channelKey()` normalizes identifiers so every reader agrees.

If the registry is unreachable, never treat a seller as authorized without a current answer. Between `valid_until` and `stale_until` (24 hours) you may use an answer you already hold, marked as stale, after checking it against the revocation feed: `verifyDocument(answer, jwks, { allowStale: true, revocationFeed })`. Otherwise the seller is unconfirmed (spec section 10.2).

## Upgrading from 0.1

- `full` and `private` files are gone. Replace any `/.well-known/authorized-retailers.json` with a pointer, or remove it and rely on the DNS record.
- The hosted `authorized-retailers-verify.txt` file is gone. Use the DNS record or the pointer's `verify_token`.
- Marketplace channels use `domain` (`amazon.com`) instead of `marketplace` (`US`). The old field is rejected.
- `brand_unverified` is now `brand_not_registered`.
- Authorizations have no default expiry. `valid_until` is 15 minutes, with `stale_until` for outages.
- `validateFullFile` is replaced by `validateList`, and `checkPublishedFile` by `checkPublishedList`. `validateFile` validates pointers only and takes the domain it was fetched from.

## What's in this repository

| Path | What |
| --- | --- |
| `spec/` | The specification, every version |
| `schemas/` | JSON Schemas (draft 2020-12) for the pointer file, the signed list, the revocation feed and the verify request and response, one folder per version |
| `fixtures/` | Valid and invalid examples and matching cases, with `manifest.json` saying what each should produce. Usable as a conformance suite |
| `src/` | Types, validator, identifier, territory and product matching, RFC 8785 canonicalization (JCS) and detached EdDSA JWS signing and verification |
| `test/` | Tests for all of the above |
| `docs/MUST-coverage.md` | Every MUST in the spec and where it is tested |

authorizedretailers.ai is the only registry. Anyone may build on the standard and cache or relay signed answers, but only answers signed with the registry's published keys count. See [TRADEMARKS.md](TRADEMARKS.md).

## Feedback

Send feedback on the spec at [authorizedretailers.ai/spec](https://authorizedretailers.ai/spec#feedback). This repository doesn't accept pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md).

Use of the registry is subject to the terms at authorizedretailers.ai/terms.

## License

- The specification and documents in `spec/` and `docs/`: [CC BY 4.0](LICENSE-SPEC)
- Schemas, code and fixtures: [Apache 2.0](LICENSE)

"authorizedretailers.ai" and "Authorized Retailers" are trademarks. See [TRADEMARKS.md](TRADEMARKS.md).
