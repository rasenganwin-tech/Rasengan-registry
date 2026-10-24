# Newsletter sponsorship rates: free checker

A tiny, dependency-free script that looks for a newsletter's **published** sponsorship prices on its own public sponsor page.

## Use it


```bash
node check_rates.mjs tldr.tech morningbrew.com > rates.csv
```


Node 18+ required. For each domain it tries `/sponsor`, `/advertise`, `/media-kit` and similar paths, skips any path disallowed by `robots.txt`, and writes one CSV row per domain:

| column | meaning |
|---|---|
| domain | what you passed in |
| status | `prices_found`, `page_found_no_public_prices`, or `no_public_sponsor_page_found` |
| page_url | the sponsor page that was read |
| claimed_subscribers | the publisher's own claim, unverified |
| price_snippets | dollar amounts with surrounding text |
| checked_at | crawl date |

## Honest limits

- Text matching only. Snippets may include case studies, not just the rate card.
- Pages that need JavaScript, or hide prices behind a contact form, return no prices.
- Subscriber counts are claims, not verified numbers.
- Sequential and single-threaded. Fine for a few dozen domains.

## Need more than a few dozen?

- **Run it in bulk, hosted, with MCP/API access:** [Newsletter Ad Rate Card Extractor on Apify](https://apify.com/hamsmoothie/newsletter-rate-card-extractor), $0.01 per newsletter.
- **Other weekly data subscriptions** (new USDOT carriers, Texas sales-tax permits, SEC ad spend, California contractor licences): https://rasengan.win/products/

Data comes only from each publisher's own public pages. No emails, no marketplaces, no logins. MIT licence.
