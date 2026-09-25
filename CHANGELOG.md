# Changelog

This file covers the package. Changes to the specification text are also listed in section 14 of [the spec](spec/spec-v0.1.md).

## Unreleased

- Spec: distributors propose only if designated; held requests; retailer-side channel proof; seller identity; mailbox address warnings; corrected the note on observation (spec section 14, 2026-09-25).
- Examples and fixtures use reserved `.example` domains.
- Build: compiled with `tsc` to ESM and `.d.ts` in `dist/`. Schemas are embedded in `src/schemas.ts`, so the package needs no JSON imports.
- The specification license file is now `LICENSE-SPEC`.

## 0.1.0

- First draft of the specification, schemas, fixtures, validator, canonicalization and signing (not yet published to npm).
