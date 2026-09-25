# authorized-retailers.json

An open standard for brands to publish which retailers they have authorized, and for software to check a seller against that list.

> **Status: draft v0.1.** Breaking changes are possible before v1.0. See [GOVERNANCE.md](GOVERNANCE.md) for how changes are made.

The standard answers one question: has this brand authorized this seller, on this channel, in this territory, for this product line, as of this date? The format is built for AI shopping agents to check before they recommend or buy, and is ready for them as they adopt it. It works just as well for marketplaces, brand protection teams and anyone else who needs the answer.

- **Read the spec:** [`spec/spec-v0.1.md`](spec/spec-v0.1.md), also at [authorizedretailers.ai/spec](https://authorizedretailers.ai/spec)
- **Reference registry:** [authorizedretailers.ai](https://authorizedretailers.ai)

## Core principles

- **Every authorization comes from the brand.** No one else can authorize a retailer: not a distributor, not a retailer and not the registry.
- **Distributors can propose, only the brand approves.** A proposal changes nothing until the brand says yes.
- **Authorization is scoped and expires.** Each one names its channels, territories and product lines, and lapses unless the brand reconfirms it.
- **Authorization is not authenticity.** An answer says what the brand has approved. It does not say whether any item is genuine.
- **The registry doesn't rule on pricing.** Pricing and commercial terms are between the brand and its retailers.
- **Listing is free.** Brands publish and retailers are listed at no cost.
- **Retailers can see and dispute their status.** A retailer can check how it is listed and dispute an entry it believes is wrong (spec section 11).

## Who it's for

| You are | You use it to |
| --- | --- |
| A brand | Publish which retailers you've authorized, where and for what |
| A retailer | Show that the brands you sell have authorized you, and see how you're listed |
| An agent builder | Check a seller before recommending or buying, with an answer you can verify |

## Publish a file (brands)

A brand verifies control of its domain with a registry, which signs its list. The brand then serves a file at:

```
https://<brand-domain>/.well-known/authorized-retailers.json
```

The file takes one of three forms:

| Form | What it holds | Use when |
| --- | --- | --- |
| `full` | The complete signed list | You want your list public |
| `pointer` | A URL to your signed list on a registry | You want the file to stay current without re-uploading |
| `private` | Your identity and a verify endpoint, no retailers | You don't want your distribution network public |

Only files signed by a registry count. An unsigned file is well formed but treated as no file (spec section 5). The simplest choice is the `pointer` form:

```json
{
  "spec": "authorized-retailers/0.1",
  "form": "pointer",
  "brand": { "name": "Example Brand", "domain": "brand.example" },
  "list": "https://authorizedretailers.ai/v0/brands/brand.example/list"
}
```

## Validate a file

```bash
npm install @authorizedretailers/spec
```

```ts
import { validateFile, validAuthorizations } from "@authorizedretailers/spec";

const result = validateFile(file);
if (!result.valid) console.log(result.errors);
else if (result.value.form === "full") {
  const current = validAuthorizations(result.value); // an expired file yields none
}
```

To accept a file you fetched, check its signature and that it vouches for the domain it came from:

```ts
import { checkPublishedFile } from "@authorizedretailers/spec";

const check = await checkPublishedFile("brand.example", file, jwks);
// { counts: true, kid } or { counts: false, reason }
```

The package works in Node 20+, Cloudflare Workers, Deno and browsers. It uses only Web Crypto, makes no network calls and sends no telemetry.

## Verify a signed registry answer (agent builders)

Ask a registry whether a seller is authorized, then verify the answer against the registry's published keys:

```ts
import { verifyDocument } from "@authorizedretailers/spec";

const answer = await fetch("https://authorizedretailers.ai/v0/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    brand_domain: "brand.example",
    channel: { type: "amazon", marketplace: "US", seller_id: "A1B2C3D4E5F6G7" },
    territory: "US",
  }),
}).then((r) => r.json());

const jwks = await fetch("https://authorizedretailers.ai/.well-known/jwks.json").then((r) => r.json());
const check = await verifyDocument(answer, jwks);
// { valid: true, kid } or { valid: false, reason }
```

The verifier rejects keys no longer in the key set and answers past their `valid_until`. On `unknown_kid`, fetch the key set again once. Match sellers on the identifier you see, never on a retailer name: `channelKey()` normalizes identifiers so every reader agrees.

## What's in this repository

| Path | What |
| --- | --- |
| `spec/` | The specification |
| `schemas/` | JSON Schemas (draft 2020-12) for the three file forms and the verify request and response |
| `fixtures/` | Valid and invalid examples, with `manifest.json` saying what each should produce. Usable as a conformance suite |
| `src/` | Types, validator, identifier matching, RFC 8785 canonicalization (JCS) and detached EdDSA JWS signing and verification |
| `test/` | Tests for all of the above |
| `docs/MUST-coverage.md` | Every MUST in the spec and where it is tested |

Anyone may run a registry that implements this standard. See [TRADEMARKS.md](TRADEMARKS.md) for how to describe it.

## Feedback

Send feedback on the spec at [authorizedretailers.ai/spec](https://authorizedretailers.ai/spec#feedback). This repository doesn't accept pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

- The specification and documents in `spec/` and `docs/`: [CC BY 4.0](LICENSE-SPEC)
- Schemas, code and fixtures: [Apache 2.0](LICENSE)

"authorizedretailers.ai" and "Authorized Retailers" are trademarks. See [TRADEMARKS.md](TRADEMARKS.md).
