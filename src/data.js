// Fetch + cache the public data files. No keys, no secrets: everything read here is public.
import { gunzipSync } from 'node:zlib';

export const DATA_URL = (process.env.RASENGAN_DATA_URL || 'https://rasengan.win/data').replace(/\/+$/, '');
export const SODA = 'https://data.transportation.gov/resource';
const TTL_MS = Number(process.env.RASENGAN_CACHE_MINUTES || 360) * 60e3;
const UA = 'rasengan-registry-mcp/0.1 (+public registry data)';
const cache = new Map();   // url -> { at, value } (or a pending promise)

export class NotPublished extends Error {}

async function fetchWithRetry(url, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.ok || res.status === 404) return res;
      last = new Error(`HTTP ${res.status} from ${url}`);
    } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 800 * i));
  }
  throw last;
}

/** A gzipped JSON file from the Rasengan data folder, cached for TTL. Throws NotPublished if it is not there. */
export async function dataFile(name) {
  const url = `${DATA_URL}/${name}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const p = (async () => {
    const res = await fetchWithRetry(url);
    if (res.status === 404) throw new NotPublished(`${name} is not published yet`);
    const buf = Buffer.from(await res.arrayBuffer());
    const gz = buf[0] === 0x1f && buf[1] === 0x8b;
    const text = (gz ? gunzipSync(buf) : buf).toString('utf8');
    if (!gz && !/^\s*[[{]/.test(text)) throw new NotPublished(`${name} is not published yet`);   // site fallback page
    return JSON.parse(text);
  })();
  cache.set(url, { at: Date.now(), value: p });
  try {
    return await p;
  } catch (e) {
    cache.delete(url);
    throw e;
  }
}

/** A Socrata (data.transportation.gov) query, uncached. */
export async function soda(dataset, params) {
  const url = `${SODA}/${dataset}.json?${new URLSearchParams(params)}`;
  const res = await fetchWithRetry(url, 4);
  if (!res.ok) throw new Error(`data.transportation.gov ${dataset}: HTTP ${res.status}`);
  return res.json();
}
