# Contributing

Thanks for your interest in the standard. Brands, retailers, marketplaces and agent builders all have cases this draft may not handle yet, and hearing about them is the most useful help.

## Send a proposal or feedback

Email [spec@authorizedretailers.ai](mailto:spec@authorizedretailers.ai) or use the feedback form at [authorizedretailers.ai/spec](https://authorizedretailers.ai/spec#feedback). Proposals for changes are as welcome as reports of cases the spec gets wrong. Useful messages say:

- who you are (brand, retailer, marketplace or agent builder)
- the real situation the spec gets wrong or leaves out
- the section it concerns, if you know it

Security issues go to the address in [SECURITY.md](SECURITY.md), not the feedback form.

## Pull requests and issues

This repository has no issues and doesn't accept pull requests. Contributions come by email or the feedback form, and the maintainer discusses them with you and makes every change here in public (see [GOVERNANCE.md](GOVERNANCE.md)). Every change is listed in the changelog, with a note where a contribution shaped it.

## Development

```bash
npm install
npm test          # schemas, fixtures, validator, canonicalization, signing
npm run typecheck
npm run test:dist # build, then exercise the published entry points in plain Node
```

After changing a schema, run `node scripts/embed-schemas.mjs` and `node scripts/build-fixtures.mjs`. Fixtures are generated: edit the script, not the JSON files.
