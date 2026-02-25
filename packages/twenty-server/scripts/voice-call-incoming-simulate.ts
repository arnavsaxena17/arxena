/**
 * Simulate an incoming call (e.g. for testing handleIncomingCall without Twilio/Baileys).
 * Creates an INCOMING PhoneCall and returns agent config (systemPrompt, firstMessage).
 *
 * Usage:
 *   API_TOKEN=<jwt> npx tsx -r tsconfig-paths/register scripts/voice-call-incoming-simulate.ts <fromNumber>
 *   API_TOKEN=<jwt> FROM=+919876543210 npx tsx -r tsconfig-paths/register scripts/voice-call-incoming-simulate.ts
 */

const BASE_URL = process.env.SERVER_URL ?? process.env.SERVER_BASE_URL ?? 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN;

async function runIncomingSimulate() {
  const fromNumber = process.argv[2] ?? process.env.FROM;
  if (!fromNumber) {
    console.error('Usage: voice-call-incoming-simulate.ts <fromNumber>');
    console.error('   or set FROM in env (e.g. +919876543210)');
    process.exit(1);
  }
  if (!API_TOKEN) {
    console.error('Set API_TOKEN (JWT) in env');
    process.exit(1);
  }

  const url = `${BASE_URL}/voice-calls/incoming`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ from: fromNumber, apiToken: API_TOKEN }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Error', res.status, data);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

runIncomingSimulate();

export { };

