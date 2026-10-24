// The four tools. Each returns plain JSON-able objects; index.js wraps them as MCP tool results.
import { dataFile, soda, NotPublished } from './data.js';

const CSLB_URL = (lic) => `https://www2.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=${lic}`;
const SAFER_URL = (dot) => `https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=${dot}`;
const SOURCE_CSLB = 'CSLB License Master file (public record), refreshed about twice a week. Rasengan is not the CSLB.';
const SOURCE_FMCSA = 'FMCSA Company Census File and Motus authority datasets on data.transportation.gov (public record). Not affiliated with FMCSA.';

const isoToday = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 86400e3).toISOString().slice(0, 10);
const daysUntil = (iso) => (iso ? Math.round((Date.parse(iso) - Date.parse(isoToday())) / 86400e3) : null);
const normCounty = (s) => (s || '').toUpperCase().replace(/\s+COUNTY$/, '').trim();
const normClass = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const clamp = (v, lo, hi, d) => Math.min(Math.max(Number.isFinite(+v) ? Math.trunc(+v) : d, lo), hi);
const ymd = (d) => (d && /^\d{8}$/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : null);
const phone10 = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : null; };
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function eventRow(e) {
  const d = e.detail || {};
  return {
    eventType: e.type, licenseNo: e.licence, businessName: e.business || null, classifications: (e.classes || []).join(', ') || null,
    city: e.city || null, county: e.county || null, phone: e.phone || null, licenseStatus: e.status || null,
    eventDate: e.event_date || null, effectiveDate: e.effective_date || null, pending: Boolean(e.pending),
    reinstateBy: e.reinstate_by || null, daysLeft: daysUntil(e.reinstate_by),
    reason: d.reason || d.basis || null, suretyOrInsurer: d.surety || d.insurer || null, bulkMove: Boolean(d.bulk),
    url: CSLB_URL(e.licence),
  };
}

// ---------------------------------------------------------------- ca_license_lookup
export async function caLicenseLookup({ licence }) {
  const lic = String(licence || '').replace(/\D/g, '');
  if (!lic) return { error: 'Give a California contractor licence number (digits), e.g. 1162758.' };
  const shard = lic.slice(-2).padStart(2, '0');
  let record = null, fileDate = null, note = null;
  try {
    const doc = await dataFile(`cslb/${shard}.json.gz`);
    record = doc.licences?.[lic] || null;
    fileDate = doc.file_date || null;
    if (!record) note = 'Not in the current CSLB master file: the licence number is wrong, or the licence is expired, revoked or inactive (the master file lists active and suspended licences only).';
  } catch (e) {
    if (!(e instanceof NotPublished)) throw e;
    note = 'The licence lookup file is not published yet; check the CSLB page in the meantime.';
  }
  let events = [];
  try {
    const feed = await dataFile('lapse_events.json.gz');
    events = (feed.events || []).filter((e) => e.licence === lic).map(eventRow);
  } catch (e) { if (!(e instanceof NotPublished)) throw e; }
  return {
    licence: lic, found: Boolean(record), fileDate, record,
    daysToLicenseExpiry: daysUntil(record?.expiration_date), daysToWcExpiry: daysUntil(record?.wc?.expiration),
    recentEvents: events, note, url: CSLB_URL(lic), source: SOURCE_CSLB,
  };
}

// ---------------------------------------------------------------- ca_lapse_events
export const LAPSE_TYPES = ['bond_cancelled', 'wc_cancelled', 'wc_expired', 'suspended', 'expired', 'revoked', 'reinstated', 'bond_changed', 'wc_exempt_to_insured'];
export async function caLapseEvents({ days = 14, county, types, pendingOnly = false, limit = 50 }) {
  days = clamp(days, 1, 90, 14);
  limit = clamp(limit, 1, 500, 50);
  const counties = new Set([].concat(county || []).map(normCounty).filter(Boolean));
  const want = new Set((types?.length ? types : ['bond_cancelled', 'wc_cancelled', 'wc_expired', 'suspended', 'expired']));
  const feed = await dataFile('lapse_events.json.gz');
  const cutoff = addDays(isoToday(), -days);
  const rows = [];
  let matched = 0;
  for (const e of feed.events || []) {
    if ((e.event_date || '') < cutoff || !want.has(e.type)) continue;
    if (counties.size && !counties.has(normCounty(e.county))) continue;
    if (pendingOnly && !e.pending) continue;
    matched++;
    if (rows.length < limit) rows.push(eventRow(e));
  }
  return { generated: feed.generated, days, matched, returned: rows.length, events: rows, source: SOURCE_CSLB };
}

// ---------------------------------------------------------------- ca_expiring
export async function caExpiring({ days = 30, what = 'license', county, classes, limit = 50 }) {
  days = clamp(days, 1, 120, 30);
  limit = clamp(limit, 1, 500, 50);
  const counties = new Set([].concat(county || []).map(normCounty).filter(Boolean));
  const cls = new Set([].concat(classes || []).map(normClass).filter(Boolean));
  const doc = await dataFile('ca_expiring.json.gz');
  const today = isoToday(), end = addDays(today, days);
  const inWin = (iso) => Boolean(iso) && iso >= today && iso <= end;
  const rows = [];
  let matched = 0;
  for (const r of doc.licences || []) {
    const lic = (r.expiring || []).includes('licence') && inWin(r.expiration_date);
    const wc = (r.expiring || []).includes('wc') && inWin(r.wc?.expiration);
    if (what === 'license' ? !lic : what === 'workersComp' ? !wc : !(lic || wc)) continue;
    if (counties.size && !counties.has(normCounty(r.county))) continue;
    if (cls.size && !(r.classes || []).some((c) => cls.has(normClass(c)))) continue;
    matched++;
    {
      rows.push({
        _k: [lic ? r.expiration_date : null, wc ? r.wc?.expiration : null].filter(Boolean).sort()[0],
        licenseNo: r.licence, businessName: r.business || null, classifications: (r.classes || []).join(', ') || null,
        city: r.city || null, county: r.county || null, phone: r.phone || null, licenseStatus: r.status || null,
        expiring: lic && wc ? 'license and workers comp' : lic ? 'license' : 'workers comp',
        licenseExpirationDate: r.expiration_date || null, daysToLicenseExpiry: daysUntil(r.expiration_date),
        wcExpirationDate: r.wc?.expiration || null, daysToWcExpiry: daysUntil(r.wc?.expiration),
        wcInsurer: r.wc?.insurer || null, wcCoverage: r.wc?.coverage || null,
        bondSurety: r.bond?.surety || null, bondAmount: r.bond?.amount || null, url: CSLB_URL(r.licence),
      });
    }
  }
  rows.sort((a, b) => a._k.localeCompare(b._k));
  const out = rows.slice(0, limit).map(({ _k, ...r }) => r);
  return { generated: doc.generated, window: { from: today, to: end }, what, matched, returned: out.length, licences: out, source: SOURCE_CSLB };
}

// ---------------------------------------------------------------- fmcsa_new_carriers
export async function fmcsaNewCarriers({ days = 7, state, limit = 50 }) {
  days = clamp(days, 1, 90, 7);
  limit = clamp(limit, 1, 500, 50);
  const st = String(state || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  const since = addDays(isoToday(), -days).replace(/-/g, '');
  let where = `add_date >= ${q(since)}`;
  if (st) where += ` AND phy_state = ${q(st)}`;
  const census = await soda('az4n-8mr2', {
    $select: 'dot_number,legal_name,dba_name,add_date,phone,cell_phone,email_address,company_officer_1,phy_street,phy_city,phy_state,phy_zip,power_units,total_drivers,classdef,carrier_operation,hm_ind',
    $where: where, $order: 'add_date DESC, dot_number DESC', $limit: String(limit),
  });
  const dots = [...new Set(census.map((c) => String(Number(c.dot_number))))];
  const auth = new Map();
  for (let i = 0; i < dots.length; i += 80) {
    const part = dots.slice(i, i + 80);
    const recs = await soda('inys-ebih', { $where: `usdot_number in(${part.map(q).join(',')})`, $limit: '5000',
      $select: 'usdot_number,docket_number,op_auth_type,op_auth_status,min_cov_amount,bipd_file,bond_req,bond_file' });
    for (const r of recs) (auth.get(r.usdot_number) || auth.set(r.usdot_number, []).get(r.usdot_number)).push(r);
  }
  const carriers = census.map((c) => {
    const dot = String(Number(c.dot_number));
    const a = auth.get(dot) || [];
    return {
      usdotNumber: dot, legalName: c.legal_name || null, dbaName: c.dba_name || null, usdotAddedDate: ymd(c.add_date),
      carrierType: c.classdef || null, phone: phone10(c.phone), cellPhone: phone10(c.cell_phone),
      email: (c.email_address || '').trim().toLowerCase() || null, companyOfficer: c.company_officer_1 || null,
      city: c.phy_city || null, state: c.phy_state || null, zip: (c.phy_zip || '').slice(0, 5) || null,
      powerUnits: c.power_units != null ? Number(c.power_units) : null, drivers: c.total_drivers != null ? Number(c.total_drivers) : null,
      hazmat: c.hm_ind ? c.hm_ind === 'Y' : null,
      authorities: a.map((r) => ({
        docketNumber: r.docket_number, type: r.op_auth_type, status: r.op_auth_status,
        insuranceRequiredUsd: Math.round(Number(r.min_cov_amount) || 0), insuranceOnFileUsd: Math.round(Number(r.bipd_file) || 0),
        bondRequired: r.bond_req === 'Y', bondOnFile: r.bond_file === 'Y',
      })),
      hasOperatingAuthority: a.length > 0,
      url: SAFER_URL(dot),
    };
  });
  return { since: ymd(since), state: st || 'all', returned: carriers.length, carriers, source: SOURCE_FMCSA };
}
