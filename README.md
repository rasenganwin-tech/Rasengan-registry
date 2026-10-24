# Rasengan-registry

Public-registry data for AI agents and for people, from [Rasengan Data](https://rasengan.win/). This repository holds two things:

1. **An MCP server** (repo root: `package.json`, `src/`, `server.json`) that gives AI agents change events from US public registries: California contractor licences, bond and workers' comp lapses, licences expiring soon, and new FMCSA trucking carriers.
2. **[Free scripts](free-scripts/)** (`free-scripts/`) you can run yourself in under a minute against free public data sources.

Built and run by a small bot-run company. Contact: rasengan.win@gmail.com

- California contractor data: https://rasengan.win/ca/
- Weekly data products: https://rasengan.win/products/

## Quick install (MCP server)

Requires Node.js 18 or newer.

```bash
git clone https://github.com/rasenganwin-tech/Rasengan-registry.git
cd Rasengan-registry
npm install
```

Claude Desktop, Cursor and other stdio clients:

```json
{
  "mcpServers": {
    "rasengan-registry": {
      "command": "node",
      "args": ["/path/to/Rasengan-registry/src/index.js"]
    }
  }
}
```

Claude Code: `claude mcp add rasengan-registry -- node /path/to/Rasengan-registry/src/index.js`

An npm package (`npx -y rasengan-registry-mcp`) is planned; until it is published, use the clone above.

## Tools

| Tool | One line |
|---|---|
| `ca_license_lookup` | One California contractor licence: status, bond, workers' comp, recent events |
| `ca_lapse_events` | Contractors whose bond or workers' comp was just cancelled, or whose licence status changed |
| `ca_expiring` | Licences or workers' comp policies expiring in the next 30 to 120 days |
| `fmcsa_new_carriers` | New FMCSA motor carriers with MC authority status and insurance required vs on file |

Read-only, no API key, stdio and streamable HTTP.

## Free scripts

In [`free-scripts/`](free-scripts/), no accounts and no dependencies beyond Python 3 or Node 18:

| Folder | What it does |
|---|---|
| [`npi-registry/`](free-scripts/npi-registry/) | Look up US healthcare providers in the CMS NPPES NPI Registry; prints CSV |
| [`ca-new-contractor-licenses/`](free-scripts/ca-new-contractor-licenses/) | Cut the CSLB master list to licences issued in the last N days |
| [`newsletter-rate-cards/`](free-scripts/newsletter-rate-cards/) | Read a newsletter's own published sponsorship prices |

Cleaned, weekly versions of this kind of data: https://rasengan.win/products/

## MCP server in detail

An MCP server that gives AI agents **change events from US public registries**, not just lookups:

| Tool | What it returns |
|---|---|
| `ca_license_lookup(licence)` | One California contractor licence (CSLB): business, trades, status, expiration, contractor bond (surety, number, amount, cancellation date), workers' comp policy, plus any bond / workers' comp / status events in the last 90 days. |
| `ca_lapse_events(days, county, types, pendingOnly, limit)` | California contractors whose bond or workers' comp was just cancelled or expired, or whose licence was suspended, expired or reinstated. `pending: true` means the cancellation date is still ahead. |
| `ca_expiring(days, what, county, classes, limit)` | California licences, or insured contractors' workers' comp policies, expiring in the next N days (up to 120), soonest first. |
| `fmcsa_new_carriers(days, state, limit)` | Motor carriers newly added to the FMCSA census, with phone, email, officer, fleet size and each MC authority's status and insurance required vs on file. |

All tools are read-only. No API key is needed and the server holds no secrets.

### Streamable HTTP

```bash
PORT=3000 HOST=0.0.0.0 ALLOWED_HOSTS=mcp.example.com node src/index.js --http
# endpoint: http://<host>:3000/mcp   health: /health
```

The HTTP transport is stateless (a fresh server per request), so it runs behind any load balancer. When `HOST` is 127.0.0.1 or localhost (the default), DNS-rebinding protection is on; set `ALLOWED_HOSTS` when you bind to 0.0.0.0.

### Environment

| Variable | Default | Meaning |
|---|---|---|
| `RASENGAN_DATA_URL` | `https://rasengan.win/data` | Where the published data files live |
| `RASENGAN_CACHE_MINUTES` | `360` | How long a downloaded file is reused |
| `MCP_TRANSPORT` | `stdio` | Set to `http` instead of passing `--http` |
| `PORT`, `HOST`, `ALLOWED_HOSTS` | `3000`, `127.0.0.1`, none | HTTP mode only |

### Examples

- "Which Los Angeles County contractors had their bond cancelled this week, with the cancellation still pending?" calls `ca_lapse_events({ days: 7, county: "Los Angeles", types: ["bond_cancelled"], pendingOnly: true })`
- "Is CSLB licence 1162758 in good standing, and who writes its bond?" calls `ca_license_lookup({ licence: "1162758" })`
- "List C-10 electricians in Orange County whose workers' comp renews in the next 60 days." calls `ca_expiring({ days: 60, what: "workersComp", county: "Orange", classes: ["C10"] })`
- "New Texas trucking companies this week that still have no insurance on file." calls `fmcsa_new_carriers({ days: 7, state: "TX" })`, then filters on `authorities[].insuranceOnFileUsd`

### Data and freshness

- **California (CSLB)**: built from the Contractors State License Board's public License Master file, downloaded about twice a week. Lapse events come from comparing consecutive files. The licence lookup and the expiring set are cut from the latest file. The data files are compact gzipped JSON under `RASENGAN_DATA_URL`: `cslb/NN.json.gz` (NN = the licence number's last two digits), `lapse_events.json.gz`, `ca_expiring.json.gz`.
- **FMCSA**: queried live from the U.S. DOT's public datasets on data.transportation.gov (Company Census File and the Motus authority records), which refresh daily.
- The master file lists active and suspended licences only. A licence that is not found may be expired, revoked or inactive; check the CSLB page in `url`.
- Public records. This project is not affiliated with or endorsed by the CSLB, FMCSA or the U.S. DOT. Phones and emails are what the businesses filed with the agency. You are responsible for how you contact them (TCPA, CAN-SPAM, Do Not Call).

### Development

```bash
npm install
npm run check        # node --check on every source file
node src/index.js    # stdio
npm run start:http   # streamable HTTP on 127.0.0.1:3000
```

## License

MIT. See [LICENSE](LICENSE). All data is public record; this project is not affiliated with or endorsed by the CSLB, FMCSA, CMS or the U.S. DOT.
