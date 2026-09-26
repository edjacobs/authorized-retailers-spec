# Changelog

This file covers the package. Changes to the specification text are also listed in section 14 of [the spec](spec/spec-v0.1.md).

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
