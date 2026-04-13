/**
 * Lightweight probes before running expensive integration tests.
 */

export async function probeGraphqlAlive(baseUrl: string): Promise<boolean> {
  const url = `${baseUrl.replace(/\/+$/, '')}/graphql`;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: ac.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export async function probeArxenaSiteLinkedinQuery(
  arxenaSiteUrl: string,
): Promise<boolean> {
  const url = `${arxenaSiteUrl.replace(/\/+$/, '')}/api/query-generator/linkedin`;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 15_000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_names: ['probe'] }),
      signal: ac.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** POST /api/title-taxonomy/search-keywords (BD-shaped probe body). */
export async function probeArxenaSiteTitleTaxonomySearchKeywords(
  arxenaSiteUrl: string,
): Promise<boolean> {
  const url = `${arxenaSiteUrl.replace(/\/+$/, '')}/api/title-taxonomy/search-keywords`;
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 30_000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'chemicals division',
        company_name: 'probe-co',
        max_primary_terms: 4,
        max_modifier_terms: 2,
      }),
      signal: ac.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}
