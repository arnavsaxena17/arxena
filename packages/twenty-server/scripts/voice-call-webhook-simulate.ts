/**
 * Simulate an ElevenLabs post-call webhook to update a PhoneCall with transcript and duration.
 * Use after a call to test that the webhook handler updates the correct record.
 *
 * Usage:
 *   API_TOKEN=<jwt> npx tsx -r tsconfig-paths/register scripts/voice-call-webhook-simulate.ts <phoneCallId> [transcript] [durationSeconds]
 *   VOICE_WEBHOOK_API_TOKEN=<jwt> npx tsx -r tsconfig-paths/register scripts/voice-call-webhook-simulate.ts <phoneCallId>
 */

const BASE_URL = process.env.SERVER_URL ?? process.env.SERVER_BASE_URL ?? 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN ?? process.env.VOICE_WEBHOOK_API_TOKEN;

async function runWebhookSimulate() {
  const phoneCallId = process.argv[2] ?? process.env.PHONE_CALL_ID;
  const transcript = process.argv[3] ?? process.env.TRANSCRIPT ?? 'Sample transcript: Agent greeted candidate and completed screening.';
  const durationSeconds = process.argv[4] ?? process.env.DURATION_SECONDS ?? '120';

  if (!phoneCallId) {
    console.error('Usage: voice-call-webhook-simulate.ts <phoneCallId> [transcript] [durationSeconds]');
    console.error('   or set PHONE_CALL_ID, TRANSCRIPT, DURATION_SECONDS in env');
    process.exit(1);
  }
  if (!API_TOKEN) {
    console.error('Set API_TOKEN or VOICE_WEBHOOK_API_TOKEN in env');
    process.exit(1);
  }

  const url = `${BASE_URL}/voice-calls/webhook`;
  const body = {
    phone_call_id: phoneCallId,
    transcript,
    duration_seconds: parseInt(durationSeconds, 10),
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Error', res.status, data);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

runWebhookSimulate();

export { };

