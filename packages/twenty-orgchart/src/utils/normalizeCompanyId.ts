/**
 * Normalizes a company ID that may be over-encoded (e.g. h%2526m from H&M).
 * Decodes repeatedly until stable, then returns the canonical form for URL encoding.
 */
export function normalizeCompanyIdForUrl(companyId: string): string {
  if (!companyId?.trim()) return companyId;
  let decoded = companyId.trim();
  let prev = '';
  while (prev !== decoded) {
    prev = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break;
    }
  }
  return decoded;
}
