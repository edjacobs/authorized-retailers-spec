# Contributing

Thanks for your interest in the standard. Brands, retailers, marketplaces and agent builders all have cases this draft may not handle yet, and hearing about them is the most useful help.

## Send feedback

Use the feedback form at [authorizedretailers.ai/spec](https://authorizedretailers.ai/spec#feedback). Useful feedback says:

- who you are (brand, retailer, distributor, marketplace or agent builder)
- the real situation the spec gets wrong or leaves out
- the section it concerns, if you know it

Security issues go to the address in [SECURITY.md](SECURITY.md), not the feedback form.

## Pull requests

This repository doesn't accept pull requests. The maintainer makes every change (see [GOVERNANCE.md](GOVERNANCE.md)). Every change is listed in the changelog, with a note where feedback shaped it.

## Development

```bash
npm install
npm test          # schemas, fixtures, validator, canonicalization, signing
npm run typecheck
npm run test:dist # build, then exercise the published entry points in plain Node
```

After changing a schema, run `node scripts/embed-schemas.mjs` and `node scripts/build-fixtures.mjs`. Fixtures are generated: edit the script, not the JSON files.
