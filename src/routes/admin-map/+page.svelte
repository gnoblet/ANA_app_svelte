<script lang="ts">
  import { looksLikePcode, parsePcode } from '$lib/utils/pcode';
  import { analyzeUoas, fetchAdminsForCountry } from '$lib/processing/fetch_admin';

  let uoaText = 'AFG01\nAFG02';
  let result: any = null;

  async function runSimpleFetch() {
    result = null;
    const uoas = uoaText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (uoas.length === 0) return console.warn('no uoa');
    // analyze UOAs and decide what to download
    const decision = analyzeUoas(uoas);
    if (decision.action === 'none') return console.log(decision.message || 'no pcodes');
    if (decision.action === 'error') return console.warn(decision.message || 'inconsistent pcodes', decision.parsed);
    // download according to decision
    try {
      const fetched = await fetchAdminsForCountry(decision.iso3 as string, decision.level as any);
      console.log('downloaded admin layers', fetched);
      result = fetched;
      return;
    } catch (e) {
      console.error('failed to fetch admin layers', e);
    }

    // helper: case-insensitive match against any property values and the parsed code
    function matchFeatures(features: any[], uoa: string, parsed: any) {
      if (!Array.isArray(features)) return [];
      const normalize = (x: any) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const digits = (x: any) => (String(x || '').match(/\d+/g) || []).join('');
      const luNorm = normalize(uoa);
      const parsedCodeNorm = normalize(parsed?.code || '');
      const parsedDigits = digits(parsed?.code || parsed?.raw || '');
      return features.filter((feat: any) => {
        const props = feat.properties || {};
        for (const v of Object.values(props)) {
          if (v == null) continue;
          const pNorm = normalize(v);
          if (!pNorm) continue;
          // exact normalized match: AFG01 == AFG_01
          if (pNorm === luNorm) return true;
          if (parsedCodeNorm && pNorm === parsedCodeNorm) return true;
          // numeric-only matching: compare digit sequences without leading zeros
          const pDigits = digits(v);
          if (pDigits && parsedDigits && pDigits.replace(/^0+/, '') === parsedDigits.replace(/^0+/, '')) return true;
          // sometimes properties store only the numeric part; match that too
          if (parsedDigits && pNorm.endsWith(parsedDigits)) return true;
        }
        return false;
      });
    }

    // for each UOA, collect matched ADM1 and ADM2 features (may be empty arrays)
    const perUOA: any[] = [];
    for (const u of uoas) {
      const parsedU = looksLikePcode(u) ? parsePcode(u) : { isPcode: false, raw: u };
      if (!parsedU.isPcode) {
        perUOA.push({ uoa: u, parsed: parsedU, adm1: [], adm2: [], note: 'not pcode-like' });
        continue;
      }
      const adm1Matches = matchFeatures(adm1All?.features || [], u, parsedU);
      const adm2Matches = matchFeatures(adm2All?.features || [], u, parsedU);
      perUOA.push({ uoa: u, parsed: parsedU, adm1: { type: 'FeatureCollection', features: adm1Matches }, adm2: { type: 'FeatureCollection', features: adm2Matches } });
    }

    console.log('Fetch summary', { iso3, adm1AllCount: adm1All?.features?.length || 0, adm2AllCount: adm2All?.features?.length || 0, perUOA });
  }
</script>

<div class="p-4">
  <h2 class="text-lg font-semibold mb-2">Admin map — minimal test</h2>
  <p class="mb-2">Enter one UOA PCODE and one MapServer URL, then click Fetch.</p>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl">
    <div>
      <label class="block text-sm font-medium mb-1">UOA PCODEs (one per line)</label>
      <textarea class="w-full border p-2" rows={4} bind:value={uoaText} />
    </div>
    <!-- ADM2 MapServer URL input removed (now using internal constants) -->
  </div>

  <div class="mt-2">
    <button class="btn btn-sm btn-primary" on:click={runSimpleFetch}>Fetch boundary</button>
  </div>

  <div class="mt-4">
    <p class="text-sm">Result logged to console. Open the browser devtools console to inspect.</p>
  </div>
</div>
