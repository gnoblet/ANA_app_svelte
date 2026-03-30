export function looksLikePcode(s: string) {
  if (!s || typeof s !== 'string') return false;
  // Treat only compact forms as valid pcodes: letters immediately followed by digits.
  // Examples: AFG01, SD02114, SD01001. Do NOT accept separators like '_' or '-'.
  return /^[A-Z]{2,3}\d{2,}$/i.test(s);
}

export function parsePcode(s: string) {
  if (!s || typeof s !== 'string') return { isPcode: false, raw: s, country: null, code: null, level: null };
  const raw = s.trim();
  if (!looksLikePcode(raw)) return { isPcode: false, raw, country: null, code: null, level: null };
  // compact form like SD01001 -> letters then digits (no separators)
  const compactMatch = raw.match(/^([A-Z]{2,3})(\d+)$/i);
  if (compactMatch) {
    const country = compactMatch[1].toUpperCase();
    const digits = compactMatch[2];
    // heuristic: short numeric part (~2) -> ADM1, longer -> ADM2
    const level = digits.length <= 2 ? 'ADM1' : 'ADM2';
    return { isPcode: true, country, code: raw, level };
  }
  return { isPcode: false, raw, country: null, code: null, level: null };
}
