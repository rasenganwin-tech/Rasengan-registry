// Free NPI Registry lookup. No dependencies. Node 18+.
// Usage: node lookup.mjs --last Smith --state FL [--first John] [--limit 20]
// Source: CMS NPPES public API https://npiregistry.cms.hhs.gov/api/?version=2.1
const a = process.argv.slice(2);
const get = (k, d = '') => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const p = new URLSearchParams({ version: '2.1', limit: get('limit', '20') });
const map = { first: 'first_name', last: 'last_name', state: 'state', org: 'organization_name', npi: 'number' };
for (const [k, v] of Object.entries(map)) if (get(k)) p.set(v, get(k));
if (p.size <= 2) { console.error('Give at least one of --first --last --state --org --npi'); process.exit(1); }
const r = await fetch('https://npiregistry.cms.hhs.gov/api/?' + p);
if (!r.ok) { console.error('HTTP ' + r.status); process.exit(1); }
const j = await r.json();
console.log('npi,name,type,state,primary_taxonomy');
for (const x of j.results || []) {
  const b = x.basic || {};
  const name = (b.organization_name || [b.first_name, b.last_name].filter(Boolean).join(' ')).replace(/,/g, ' ');
  const addr = (x.addresses || [])[0] || {};
  const tax = (x.taxonomies || []).find(t => t.primary) || (x.taxonomies || [])[0] || {};
  console.log([x.number, name, x.enumeration_type, addr.state || '', (tax.desc || '').replace(/,/g, ' ')].join(','));
}
