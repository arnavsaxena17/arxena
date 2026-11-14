/**
 * Pure normalization helpers for org chart cache keys and search parameters.
 * No external dependencies.
 */

export function normalizeCompanyName(companyName?: string): string {
  return (companyName ?? '').trim();
}

export function normalizeCompanyId(
  companyId?: string,
  fallbackName?: string,
): string {
  const normalizedCompanyId = (companyId ?? '').trim().toLowerCase();
  if (normalizedCompanyId) {
    return normalizedCompanyId;
  }

  const normalizedFallbackName = (fallbackName ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalizedFallbackName || 'unknown_company';
}

export function normalizeFunctionRoot(functionRoot?: string): string {
  return (functionRoot ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/^_+|_+$/g, '');
}

export function normalizeCountry(country?: string): string {
  const normalized = (country ?? '').trim().toLowerCase();
  if (!normalized) {
    return 'global';
  }

  const canonical = normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]+/g, '');
  const compactAlpha = normalized.replace(/[^a-z]+/g, '');

  // Common country shorthands frequently produced by data providers.
  if (
    compactAlpha === 'us' ||
    compactAlpha === 'usa' ||
    compactAlpha.startsWith('unitedstates')
  ) {
    return 'united_states';
  }

  return canonical;
}
