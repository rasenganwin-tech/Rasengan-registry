# Free public-data scripts

Part of [Rasengan-registry](../README.md). Free, dependency-light scripts for US public-record business data, by [Rasengan Data](https://rasengan.win). Each folder has a README, a script you can run in under a minute, and a link to the hosted version if you need it weekly, in bulk, or from an AI agent.

| folder | what it does | source | hosted / weekly |
|---|---|---|---|
| `npi-registry/` | look up healthcare providers by name, org, state or NPI; prints CSV | CMS NPPES API | [NPI Registry Lookup](https://apify.com/hamsmoothie/npi-registry-lookup) (pay per result) |
| `ca-new-contractor-licenses/` | cut the CSLB master list to licences issued in the last N days | CSLB data portal | [weekly file, $29/mo](https://rasengan.win/) |
| `newsletter-rate-cards/` | read a newsletter's own published sponsorship prices | publishers' sponsor pages | [Rate Card Extractor](https://apify.com/hamsmoothie/newsletter-rate-card-extractor) |

More free scripts land here as they're written: new USDOT carriers (FMCSA census), Texas new sales-tax permits, SEC-reported advertising spend. The weekly, cleaned versions of those are at [rasengan.win/products](https://rasengan.win/products/).

All data is public record. Respect each source's terms and rate limits. MIT licence (see [LICENSE](../LICENSE)). Questions: rasengan.win@gmail.com
