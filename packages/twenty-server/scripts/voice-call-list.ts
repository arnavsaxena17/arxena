/**
 * List voice calls. Optional filter by personId and limit.
 *
 * Usage:
 *   API_TOKEN=<jwt> npx tsx -r tsconfig-paths/register scripts/voice-call-list.ts [personId] [limit]
 *   API_TOKEN=<jwt> PERSON_ID=... LIMIT=10 npx tsx -r tsconfig-paths/register scripts/voice-call-list.ts
 */

const BASE_URL = process.env.SERVER_URL ?? process.env.SERVER_BASE_URL ?? 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN;

async function runList() {
  const personId = process.argv[2] ?? process.env.PERSON_ID;
  const limit = process.argv[3] ?? process.env.LIMIT ?? '20';

  if (!API_TOKEN) {
    console.error('Set API_TOKEN (JWT) in env');
    process.exit(1);
  }

  const params = new URLSearchParams();
  if (personId) params.set('personId', personId);
  params.set('limit', String(limit));
  const url = `${BASE_URL}/voice-calls?${params.toString()}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${API_TOKEN}` },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Error', res.status, data);
    process.exit(1);
  }
  const edges = (data as { edges?: Array<{ node: unknown }> }).edges ?? [];
  console.log(JSON.stringify({ count: edges.length, edges }, null, 2));
}

runList();

export { };

