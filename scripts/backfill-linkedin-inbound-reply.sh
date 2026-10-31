#!/bin/bash
# Backfill the inbound LinkedIn reply that the webhook dropped on 2026-10-31.
# Mirrors OutreachMessagePersistService.mergeTurns / persistInboundFlush for a
# single LINKEDIN inbound turn. Runs in one transaction with explicit checks.
set -euo pipefail

PSQL='postgres://postgres:postgres@localhost:5432/default'
SCHEMA='workspace_3hf24vrzah6wgy539grubayv2'
CANDIDATE_ID='d4c902ef-4d95-4793-ab24-6587ae0914a5'
PERSON_ID='a043961d-4ef4-4d45-92bf-870d762fa37c'
PROJECT_ID='dbdbdb6f-0b74-45fb-a63d-7a9b7633f2ea'
CHAT_ROW_ID='98014def-a807-4a7f-80c2-fb909462458d'
EXTERNAL_MESSAGE_ID='fslZmjNAXIOVu41mgBPGKg'
CHAT_ID='eRGUQWRAW4WighgX_SwkXQ'
MESSAGE_TEXT='Let us connect next week on Monday'
RECEIVED_AT='2026-10-31T09:30:34.401Z'

psql "$PSQL" -v ON_ERROR_STOP=1 <<SQL
BEGIN;

-- Guard: this message must not already be stored.
DO \$\$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ${SCHEMA}."_chatMessage"
    WHERE "externalMessageId" = '${EXTERNAL_MESSAGE_ID}'
       OR "messageObj"::text LIKE '%${EXTERNAL_MESSAGE_ID}%'
  ) THEN
    RAISE EXCEPTION 'backfill aborted: message already present';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ${SCHEMA}."_chatMessage"
    WHERE id = '${CHAT_ROW_ID}'
      AND "candidateId" = '${CANDIDATE_ID}'
  ) THEN
    RAISE EXCEPTION 'backfill aborted: target chat row not found';
  END IF;
END
\$\$;

-- Append the inbound turn exactly as mergeTurns would: messageObj carries the
-- full transcript, message holds the trailing user burst.
UPDATE ${SCHEMA}."_chatMessage"
SET
  "messageObj" = "messageObj" || jsonb_build_array(
    jsonb_build_object(
      'id', '${EXTERNAL_MESSAGE_ID}',
      'role', 'user',
      'content', '${MESSAGE_TEXT}',
      'timestamp', '${RECEIVED_AT}'
    )
  ),
  message = '${MESSAGE_TEXT}',
  "externalMessageId" = '${EXTERNAL_MESSAGE_ID}',
  "externalChatId" = '${CHAT_ID}',
  "typeOfMessage" = 'linkedin',
  channel = 'LINKEDIN',
  "candidateId" = '${CANDIDATE_ID}',
  "personId" = '${PERSON_ID}',
  "projectId" = '${PROJECT_ID}',
  "updatedAt" = now()
WHERE id = '${CHAT_ROW_ID}';

-- Register the provider id so later reply lookups resolve this conversation.
UPDATE ${SCHEMA}."_chatMessage"
SET "updatedAt" = now()
WHERE id = '${CHAT_ROW_ID}'
  AND "personId" = '${PERSON_ID}';

COMMIT;
SQL

echo "--- verify turn count and tail ---"
psql "$PSQL" -tAc "
SELECT jsonb_array_length(\"messageObj\"),
       \"messageObj\"->-1->>'role',
       \"messageObj\"->-1->>'id',
       \"messageObj\"->-1->>'content',
       \"externalMessageId\",
       \"externalChatId\"
FROM ${SCHEMA}.\"_chatMessage\"
WHERE id = '${CHAT_ROW_ID}'
"
