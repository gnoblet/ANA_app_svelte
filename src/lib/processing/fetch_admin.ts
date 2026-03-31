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

export { ADM1_MAPSERVER, ADM2_MAPSERVER, ADM1_FEATURESERVER, ADM2_FEATURESERVER };
