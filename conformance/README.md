# Conformance suite

Two questions this answers:

- **Does my agent reach the right decision?** (`--agent`) Nineteen signed situations from sections 7 to 12 of the spec, each with the decisions that conform. They are minted with a throwaway key that each vector names in its own key set, so an agent can run them offline.
- **Does the registry answer correctly?** (`--registry`) The eleven demo-brand questions the authorizedretailers.ai home page shows, sent to a live registry: each answer must be schema-valid, correctly signed, fresh (section 10.1) and carry `observed`, and the revocation feed must be signed and current.

The guiding rule behind every vector: an agent MUST NOT describe a seller as authorized unless a current, correctly signed answer says so.

## Run it

```bash
npm run build                                    # in a checkout; nothing needed from npm
node conformance/run.mjs --list                  # the vectors and the spec section each one tests
node conformance/run.mjs --reference             # the reference decision against the vectors
node conformance/run.mjs --registry              # authorizedretailers.ai, the demo brand
node conformance/run.mjs --registry https://mirror.example   # any registry
node conformance/run.mjs --agent "python my_agent.py"        # your agent
```

Exit code is 0 when everything passes, so it can sit in CI.

## Testing your agent

Your command is run once per vector. It reads one JSON object on stdin and writes one on stdout.

```jsonc
// stdin
{
  "now": "2026-10-20T12:01:00Z",
  "question": { "brand_domain": "brand.example", "channel": { ... }, "territory": "US" },
  "verify_api": "reachable",          // or "unreachable"
  "answer": { ... },                  // the signed answer the agent holds, or null
  "jwks": { "keys": [ ... ] },        // the key set to trust for this vector
  "feed": { ... }                     // the newest revocation feed it holds, or null
}

// stdout
{ "decision": "authorized" }          // or "not_authorized" or "unconfirmed"
{ "decision": "authorized", "stale": true }
```

- `authorized`: the agent may describe the seller as authorized.
- `not_authorized`: a valid answer says it is not (`unlisted`, `unauthorized`, `expired`, a status the agent doesn't know).
- `unconfirmed`: the agent couldn't establish either, so it MUST NOT call the seller authorized (an unverifiable signature, an answer past `valid_until`, no usable revocation feed).

`stale: true` means the agent used an answer past its `valid_until` under section 10.2, and must say so. Use `now` for the time, not your clock: the vectors are fixed in time.

`conformance/reference.mjs` is a complete, small implementation on top of this package's `verifyDocument`. Read it before you write your own.

## Vectors that are new in v0.6

Labelled `[v0.6]` in the output. They test rules the v0.6 draft adds or fixes: `observed: null` is never a negative signal (section 7), an answer is unusable after its `expires` even before its `valid_until` (10.1), and a stale answer needs a revocation feed issued at or after the answer (10.2, 10.3). An agent written to v0.5 may fail these; that is the point of listing them.

## What isn't covered

Anything that needs the network or the registry's state: rate limits, mirrors, and how an agent finds a brand from a product (section 9.5). `--registry` covers the registry's answers for one brand only; it is a smoke test, not a certification.
