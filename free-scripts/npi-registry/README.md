# NPI Registry lookup (free script)

Small, dependency-free Node script that queries the free CMS NPPES NPI Registry API and prints CSV.


```bash
node lookup.mjs --last Smith --state FL --limit 20
node lookup.mjs --org "General Hospital" --state NY
node lookup.mjs --npi 1234567890
```


Requires Node 18+. Data is public CMS data; respect the NPPES API terms and rate limits.

## Limits of the free script

The API returns at most 200 rows per call and 1,200 per search, with no batching, no scheduling and no flattened address/taxonomy columns.

## Need more?

The hosted version runs bulk and scheduled lookups with flat columns and exports to JSON, CSV or Excel, pay per result, no setup:

https://apify.com/hamsmoothie/npi-registry-lookup

Related tools (same publisher): https://apify.com/hamsmoothie/exclusion-debarment-screener , https://apify.com/hamsmoothie/healthcare-license-verifier

This is a lookup of public registry data, not medical, legal or credentialing advice.
