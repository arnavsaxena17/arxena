/**
 * Trigger an outbound voice call for a candidate (screening / interview_scheduling / video_interview_followup).
 * Requires: API_TOKEN (JWT), and optionally SERVER_URL. Pass candidateId and jobId as args or env.
 *
 * Usage:
 *   API_TOKEN=<jwt> npx tsx -r tsconfig-paths/register scripts/voice-call-initiate.ts <candidateId> <jobId> [callPurpose]
 *   API_TOKEN=<jwt> CANDIDATE_ID=... JOB_ID=... npx tsx -r tsconfig-paths/register scripts/voice-call-initiate.ts
 *
 * callPurpose: screening | interview_scheduling | video_interview_followup (default: screening)
 */

const BASE_URL = process.env.SERVER_URL ?? process.env.SERVER_BASE_URL ?? 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN;

async function runInitiate() {
  const candidateId = process.argv[2] ?? process.env.CANDIDATE_ID;
  const jobId = process.argv[3] ?? process.env.JOB_ID;
  const callPurpose = (process.argv[4] ?? process.env.CALL_PURPOSE ?? 'screening') as string;

  if (!API_TOKEN) {
    console.error('Set API_TOKEN (JWT) in env');
    process.exit(1);
  }
  if (!candidateId || !jobId) {
    console.error('Usage: voice-call-initiate.ts <candidateId> <jobId> [callPurpose]');
    console.error('   or set CANDIDATE_ID, JOB_ID (and optionally CALL_PURPOSE) in env');
    process.exit(1);
  }

  const url = `${BASE_URL}/voice-calls/initiate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({ candidateId, jobId, callPurpose }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('Error', res.status, data);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

runInitiate();

export { };

