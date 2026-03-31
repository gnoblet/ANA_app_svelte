import { parsePcode } from '$lib/utils/pcode';
import { ADM1_FEATURESERVER, ADM2_FEATURESERVER, ADM1_MAPSERVER, ADM2_MAPSERVER } from '$lib/utils/url';

type Analysis = {
  action: 'none' | 'error' | 'adm1' | 'adm2';
  message?: string;
  pcode?: string | null;
  level?: 'ADM1' | 'ADM2' | '';
  parsed?: any[];
};

// Analyze an array of UOAs and decide what to fetch next.
export function analyzeUoas(uoas: string[]): Analysis {
  const parsed = uoas.map((u) => ({ raw: u, parsed: parsePcode(u) }));
  const pcodeParsed = parsed.filter((p) => p.parsed?.isPcode);

  if (pcodeParsed.length === 0) {
    return { action: 'none', message: 'no pcode-like UOAs found', parsed };
  }

  const pcodes = Array.from(new Set(pcodeParsed.map((p) => p.parsed.country).filter(Boolean)));
  if (pcodes.length > 1) return { action: 'error', message: 'multiple countries detected', parsed };
  const pcode = pcodes[0];

  const levels = Array.from(new Set(pcodeParsed.map((p) => p.parsed.level).filter(Boolean)));
  if (levels.length > 1) return { action: 'error', message: 'mixed admin levels detected', parsed };
  const level = (levels[0] || 'ADM1') as 'ADM1' | 'ADM2';

  return { action: level === 'ADM1' ? 'adm1' : 'adm2', pcode, level, parsed };
}

async function queryFeatureServerLayer(base: string, value: string, outFields = '*', field = 'pcode') {
  if (!base || !value) return null;
  const endpoint = String(base).replace(/\/+$/, '') + '/0/query';
  const esc = (s: string) => String(s).replace(/'/g, "''");
  const where = `${field} = '${esc(value)}'`;
  const params = new URLSearchParams({ where, outFields, f: 'geojson', outSR: '4326' });
  const res = await fetch(endpoint, { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`feature query failed ${res.status}`);
  return res.json();
}

async function queryByFields(base: string, value: string, fields: string[] = ['adm2_source_code','adm2_pcode','adm1_source_code','adm1_pcode','pcode','progres_id','focus_id','source']) {
  if (!base || !value) return null;
  const endpoint = String(base).replace(/\/+$/, '') + '/0/query';
  const esc = (s: string) => String(s).replace(/'/g, "''");
  const parts = fields.map((f) => `${f} = '${esc(value)}'`);
  const where = parts.join(' OR ');
  const params = new URLSearchParams({ where, outFields: '*', f: 'geojson', outSR: '4326' });
  const res = await fetch(endpoint, { method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!res.ok) throw new Error(`feature query by fields failed ${res.status}`);
  return res.json();
}

// Fetch ADM1 and/or ADM2 features according to analyzed decision.
export async function fetchAdminsForCountry(pcode: string, level: 'ADM1' | 'ADM2') {
  let adm1: any = null;
  let adm2: any = null;
  // If the provided identifier looks like a pcode (letters+digits), try field-based queries.
  const looksLikeP = /^[A-Z]{2,3}\d+/i.test(String(pcode));
  if (looksLikeP) {
    // Minimal flow: find iso3 from exact source-code match, then fetch all by iso3.
    // Try ADM2 exact match on adm2_source_code
    let match: any = null;
    try {
      match = await queryFeatureServerLayer(ADM2_FEATURESERVER, pcode, '*', 'adm2_source_code');
    } catch (e) {
      match = null;
    }
    // If not found, try ADM1 exact match on adm1_source_code
    if (!match || !match.features || match.features.length === 0) {
      try {
        match = await queryFeatureServerLayer(ADM1_FEATURESERVER, pcode, '*', 'adm1_source_code');
      } catch (e) {
        match = null;
      }
    }

    if (!match || !match.features || match.features.length === 0) {
      throw new Error(`no exact-match found for pcode ${pcode}`);
    }

    // derive iso3 from the first matched feature
    const iso3 = match.features[0].properties?.iso3 || match.features[0].properties?.ISO3 || match.features[0].properties?.country || match.features[0].properties?.iso;
    if (!iso3) {
      throw new Error(`iso3 not found from matched feature for pcode ${pcode}`);
    }

    // fetch all ADM1 by iso3 and ADM2 if requested
    try {
      adm1 = await queryFeatureServerLayer(ADM1_FEATURESERVER, iso3, '*', 'iso3');
    } catch (e:any) {
      adm1 = { error: String(e) };
    }
    if (level === 'ADM2') {
      try {
        adm2 = await queryFeatureServerLayer(ADM2_FEATURESERVER, iso3, '*', 'iso3');
      } catch (e:any) {
        adm2 = { error: String(e) };
      }
    } else {
      adm2 = { type: 'FeatureCollection', features: [] };
    }
    return { adm1, adm2 };
  }

  // Otherwise treat the input as an iso3 and fetch by iso3
  try {
    adm1 = await queryFeatureServerLayer(ADM1_FEATURESERVER, pcode, '*');
  } catch (e: any) {
    adm1 = { error: String(e) };
  }
  if (level === 'ADM2') {
    try {
      adm2 = await queryFeatureServerLayer(ADM2_FEATURESERVER, pcode, '*');
    } catch (e: any) {
      adm2 = { error: String(e) };
    }
  } else {
    adm2 = { type: 'FeatureCollection', features: [] };
  }
  return { adm1, adm2 };
}

// Simple helper: given a list of UOAs, find the first pcode-like value,
// resolve its iso3 via exact source-code match, then fetch all ADM1/ADM2 by iso3.
export async function fetchAdminsFromUoas(uoas: string[], level: 'ADM1' | 'ADM2') {
  const out: any = { uoas, level, iso3: null, adm1: null, adm2: null, matched: null };
  if (!Array.isArray(uoas) || uoas.length === 0) return { error: 'no uoas provided' };
  // find first pcode-like
  const first = uoas.map((u) => ({ raw: u, parsed: parsePcode(u) })).find((p) => p.parsed?.isPcode);
  if (!first) return { error: 'no pcode-like UOA found', out };
  const code = first.parsed.code || first.parsed.raw || first.raw;

  // try exact-match on adm2_source_code then adm1_source_code
  let match: any = null;
  try {
    match = await queryByFields(ADM2_FEATURESERVER, code, ['adm2_source_code']);
  } catch (e) {
    match = null;
  }
  if (!match || !match.features || match.features.length === 0) {
    try {
      match = await queryByFields(ADM1_FEATURESERVER, code, ['adm1_source_code']);
    } catch (e) {
      match = null;
    }
  }

  out.matched = match;
  let iso3: string | undefined;
  if (match && Array.isArray(match.features) && match.features.length > 0) {
    iso3 = match.features[0].properties?.iso3 || match.features[0].properties?.ISO3 || match.features[0].properties?.country || match.features[0].properties?.iso;
  }
  if (!iso3) return { error: 'iso3 not found from matched feature', out };
  out.iso3 = iso3;

  // fetch all ADM1 by iso3
  try {
    out.adm1 = await queryFeatureServerLayer(ADM1_FEATURESERVER, iso3, '*', 'iso3');
  } catch (e: any) {
    out.adm1 = { error: String(e) };
  }
  // fetch all ADM2 by iso3 if requested
  if (level === 'ADM2') {
    try {
      out.adm2 = await queryFeatureServerLayer(ADM2_FEATURESERVER, iso3, '*', 'iso3');
    } catch (e: any) {
      out.adm2 = { error: String(e) };
    }
  } else {
    out.adm2 = { type: 'FeatureCollection', features: [] };
  }
  return out;
}

export { ADM1_MAPSERVER, ADM2_MAPSERVER, ADM1_FEATURESERVER, ADM2_FEATURESERVER };
