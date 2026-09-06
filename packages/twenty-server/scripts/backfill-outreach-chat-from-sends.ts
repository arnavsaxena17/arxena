/**
 * Backfill chatMessage.messageObj from successful LinkedIn send steps
 * (connection requests + DMs) for an outreach project.
 *
 * Env: PG_DATABASE_URL, PROJECT_ID, WORKSPACE_ID (optional)
 */

import { execFileSync } from 'node:child_process';

const PROJECT_ID =
  process.env.PROJECT_ID || 'fbf1c30b-93b4-46e2-bc72-c2b879cbcac8';
const WORKSPACE_ID =
  process.env.WORKSPACE_ID || 'be371071-5c98-477e-8de0-687fcd42e7c3';
const PG_DATABASE_URL = process.env.PG_DATABASE_URL;

if (!PG_DATABASE_URL) {
  throw new Error('PG_DATABASE_URL is required');
}

const schema = execFileSync(
  'psql',
  [
    PG_DATABASE_URL,
    '-t',
    '-A',
    '-c',
    `SELECT "databaseSchema" FROM core.workspace WHERE id='${WORKSPACE_ID}'`,
  ],
  { encoding: 'utf8' },
).trim();

if (!schema) {
  throw new Error(`No databaseSchema for workspace ${WORKSPACE_ID}`);
}

console.log(`schema=${schema} project=${PROJECT_ID}`);

const sql = `
BEGIN;

CREATE TEMP TABLE tmp_outreach_chat_backfill ON COMMIT DROP AS
WITH sends AS (
  SELECT
    wr."candidateId" AS candidate_id,
    step->>'id' AS step_id,
    COALESCE(
      NULLIF(wr.state->'stepInfos'->(step->>'id')->'result'->>'message', ''),
      NULLIF(step->'settings'->'input'->>'message', ''),
      NULLIF(step->'settings'->'input'->>'body', ''),
      CASE
        WHEN step->>'type' = 'SEND_LINKEDIN_CONNECTION_REQUEST'
          THEN '[Connection request sent]'
        ELSE NULL
      END
    ) AS body,
    COALESCE(wr."endedAt", wr."updatedAt") AS sent_at
  FROM ${schema}."workflowRun" wr
  CROSS JOIN LATERAL jsonb_array_elements(wr.state->'flow'->'steps') step
  JOIN ${schema}."_candidate" c ON c.id = wr."candidateId"
  WHERE c."projectsId" = '${PROJECT_ID}'
    AND c."deletedAt" IS NULL
    AND step->>'type' IN (
      'SEND_LINKEDIN_CONNECTION_REQUEST',
      'SEND_LINKEDIN_MESSAGE',
      'SEND_LINKEDIN_INMAIL'
    )
    AND (wr.state->'stepInfos'->(step->>'id')->>'status') = 'SUCCESS'
),
outbound_turns AS (
  SELECT
    candidate_id,
    jsonb_agg(
      jsonb_build_object(
        'role', 'assistant',
        'content', body,
        'id', 'backfill-' || step_id,
        'timestamp', to_char(
          sent_at AT TIME ZONE 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        )
      )
      ORDER BY sent_at, step_id
    ) AS turns
  FROM sends
  WHERE body IS NOT NULL AND btrim(body) <> ''
  GROUP BY candidate_id
),
inbound_existing AS (
  SELECT DISTINCT ON (cm."candidateId")
    cm."candidateId" AS candidate_id,
    cm.id AS chat_message_id,
    COALESCE(cm."messageObj", '[]'::jsonb) AS existing_turns
  FROM ${schema}."_chatMessage" cm
  JOIN ${schema}."_candidate" c ON c.id = cm."candidateId"
  WHERE c."projectsId" = '${PROJECT_ID}'
    AND cm."deletedAt" IS NULL
    AND (
      cm."typeOfMessage" = 'linkedin'
      OR cm.channel::text = 'LINKEDIN'
      OR cm.channel IS NULL
    )
  ORDER BY cm."candidateId", cm."updatedAt" DESC
)
SELECT
  COALESCE(o.candidate_id, i.candidate_id) AS candidate_id,
  i.chat_message_id,
  (
    SELECT COALESCE(jsonb_agg(turn ORDER BY ordinality), '[]'::jsonb)
    FROM (
      SELECT turn, ordinality
      FROM jsonb_array_elements(COALESCE(o.turns, '[]'::jsonb))
        WITH ORDINALITY AS t(turn, ordinality)
      WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(i.existing_turns, '[]'::jsonb)) existing
        WHERE COALESCE(existing->>'id', '') = COALESCE(turn->>'id', '')
           OR (
             existing->>'role' = turn->>'role'
             AND existing->>'content' = turn->>'content'
           )
      )
      UNION ALL
      SELECT turn, 100000 + ordinality
      FROM jsonb_array_elements(COALESCE(i.existing_turns, '[]'::jsonb))
        WITH ORDINALITY AS t(turn, ordinality)
    ) combined
  ) AS message_obj
FROM outbound_turns o
FULL OUTER JOIN inbound_existing i ON i.candidate_id = o.candidate_id;

UPDATE ${schema}."_chatMessage" cm
SET
  message = COALESCE(b.message_obj->-1->>'content', cm.message),
  "messageObj" = b.message_obj,
  "messageObjWithTimeStamp" = b.message_obj,
  "typeOfMessage" = 'linkedin',
  channel = 'LINKEDIN',
  "updatedAt" = now()
FROM tmp_outreach_chat_backfill b
WHERE cm.id = b.chat_message_id
  AND b.message_obj IS NOT NULL
  AND jsonb_array_length(b.message_obj) > 0;

INSERT INTO ${schema}."_chatMessage" (
  id, name, message, "messageObj", "messageObjWithTimeStamp",
  "typeOfMessage", channel, "candidateId", "personId", "projectsId",
  "createdAt", "updatedAt", position,
  "createdBySource", "createdByName",
  "updatedBySource", "updatedByName"
)
SELECT
  gen_random_uuid(),
  'LINKEDIN ' || left(b.candidate_id::text, 8),
  b.message_obj->-1->>'content',
  b.message_obj,
  b.message_obj,
  'linkedin',
  'LINKEDIN',
  b.candidate_id,
  c."peopleId",
  c."projectsId",
  now(),
  now(),
  0,
  'SYSTEM',
  'System',
  'SYSTEM',
  'System'
FROM tmp_outreach_chat_backfill b
JOIN ${schema}."_candidate" c ON c.id = b.candidate_id
WHERE b.chat_message_id IS NULL
  AND b.message_obj IS NOT NULL
  AND jsonb_array_length(b.message_obj) > 0;

COMMIT;
`;

const output = execFileSync(
  'psql',
  [PG_DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-c', sql],
  {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  },
);

console.log(output);
console.log('Backfill complete. Refresh Outreach Chat.');
