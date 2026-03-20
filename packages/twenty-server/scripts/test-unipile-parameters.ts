/**
 * Test Unipile LinkedIn search parameters API locally.
 * Verifies that SKILL/LOCATION (uppercase) work and skills/locations (lowercase) fail.
 *
 * Usage:
 *   cd packages/twenty-server && npx ts-node scripts/test-unipile-parameters.ts
 *   # Or with account override:
 *   UNIPILE_ACCOUNT_ID=0scX22z-SkuwEQweVlO3Yw npx ts-node scripts/test-unipile-parameters.ts
 */

import * as path from 'path';

try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch {
  // dotenv optional
}

const baseUrl = (process.env.UNIPILE_API_URL || 'https://api.unipile.com').replace(/\/$/, '');
const apiKey = process.env.UNIPILE_ACCESS_TOKEN;
const accountId = process.env.UNIPILE_ACCOUNT_ID || process.env.UNIPILE_LINKEDIN_ACCOUNT_ID || '0scX22z-SkuwEQweVlO3Yw';

async function fetchParameters(
  type: string,
  keywords?: string,
  limit = 5
): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  const params = new URLSearchParams({
    type,
    account_id: accountId,
    ...(limit && { limit: limit.toString() }),
    ...(keywords && { keywords }),
  });
  const url = `${baseUrl}/api/v1/linkedin/search/parameters?${params}`;
  console.log(`  GET ${baseUrl}/api/v1/linkedin/search/parameters?type=${type}&account_id=...`);
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-API-KEY': apiKey || '' },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    return { ok: false, status: res.status, data, error: text.slice(0, 500) };
  }
  return { ok: true, status: res.status, data };
}

async function main() {
  console.log('Unipile LinkedIn Search Parameters Test');
  console.log('=======================================');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Account ID: ${accountId}`);
  console.log(`API Key: ${apiKey ? '***' + apiKey.slice(-4) : 'NOT SET'}`);
  console.log('');

  if (!apiKey) {
    console.error('ERROR: UNIPILE_ACCESS_TOKEN not set in .env');
    process.exit(1);
  }

  const tests: Array<{ name: string; type: string; keywords?: string }> = [
    { name: 'Invalid: type=skills (lowercase)', type: 'skills', keywords: 'Pulmonologist' },
    { name: 'Invalid: type=locations (lowercase)', type: 'locations', keywords: 'Mumbai' },
    { name: 'Valid: type=SKILL (uppercase)', type: 'SKILL', keywords: 'Pulmonologist' },
    { name: 'Valid: type=LOCATION (uppercase)', type: 'LOCATION', keywords: 'Mumbai' },
  ];

  for (const t of tests) {
    console.log(`\n${t.name}`);
    const result = await fetchParameters(t.type, t.keywords);
    if (result.ok) {
      const items = (result.data as { items?: unknown[] })?.items ?? [];
      console.log(`  ✅ OK (${result.status}) - ${items.length} items`);
      if (items.length > 0) {
        console.log(`  Sample: ${JSON.stringify(items[0]).slice(0, 120)}...`);
      }
    } else {
      console.log(`  ❌ FAIL (${result.status})`);
      console.log(`  ${(result.error || JSON.stringify(result.data)).slice(0, 300)}`);
    }
    await new Promise((r) => setTimeout(r, 1100)); // rate limit
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
