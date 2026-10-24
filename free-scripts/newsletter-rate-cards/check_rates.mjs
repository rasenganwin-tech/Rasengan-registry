#!/usr/bin/env node
// Free newsletter sponsor-rate checker. No dependencies. Node 18+.
// Usage: node check_rates.mjs tldr.tech morningbrew.com > rates.csv
// Reads only public pages on the domains you pass. Respects robots.txt Disallow for the paths tried.

const PATHS = ['/sponsor', '/sponsors', '/advertise', '/advertising', '/media-kit', '/mediakit', '/sponsorship'];
const UA = 'RatecardFreeChecker/0.1 (+https://apify.com/hamsmoothie/newsletter-rate-card-extractor)';

async function get(url) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

function disallowed(robots, path) {
  if (!robots) return false;
  let applies = false;
  for (const raw of robots.split('\n')) {
    const line = raw.split('#')[0].trim();
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') applies = v === '*';
    else if (applies && k === 'disallow' && v && path.startsWith(v)) return true;
  }
  return false;
}

const csv = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';

const domains = process.argv.slice(2).map((d) => d.replace(/^https?:\/\//, '').replace(/\/.*$/, ''));
if (!domains.length) {
  console.error('Usage: node check_rates.mjs domain1.com domain2.com ...');
  process.exit(1);
}

console.log('domain,status,page_url,claimed_subscribers,price_snippets,checked_at');
for (const d of domains) {
  const robots = await get(`https://${d}/robots.txt`);
  let row = null;
  for (const p of PATHS) {
    if (disallowed(robots, p)) continue;
    const url = `https://${d}${p}`;
    const html = await get(url);
    if (!html) continue;
    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const prices = [...text.matchAll(/\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|CPM))?/g)].slice(0, 8)
      .map((m) => text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).trim());
    const subs = text.match(/(\d[\d,.]*\s?[kKmM]?\+?)\s+(?:subscribers|readers)/);
    row = { status: prices.length ? 'prices_found' : 'page_found_no_public_prices', url, subs: subs ? subs[1] : '', prices };
    break;
  }
  if (!row) row = { status: 'no_public_sponsor_page_found', url: '', subs: '', prices: [] };
  console.log([d, row.status, row.url, row.subs, row.prices.join(' | '), new Date().toISOString().slice(0, 10)].map(csv).join(','));
}
