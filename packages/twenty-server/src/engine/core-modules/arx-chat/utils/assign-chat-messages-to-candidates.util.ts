import { isNonEmptyString } from '@sniptt/guards';
import { type MessageNode } from 'twenty-shared';

import { expandLinkedinTranscriptRows } from 'src/engine/core-modules/arx-chat/utils/expand-linkedin-chat-turns.util';

export type CandidateChatHydrationTarget = {
  id: string;
  peopleId?: string | null;
  chatMessages?: {
    edges: Array<{ node: MessageNode }>;
  };
};

export const chunkStrings = (
  values: string[],
  chunkSize: number,
): string[][] => {
  if (chunkSize <= 0 || values.length === 0) {
    return values.length === 0 ? [] : [values];
  }

  const chunks: string[][] = [];

  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }

  return chunks;
};

const dedupeMessagesById = (messages: MessageNode[]): MessageNode[] => {
  const seen = new Set<string>();
  const deduped: MessageNode[] = [];

  for (const message of messages) {
    const key =
      message.id ||
      `${message.candidateId}:${message.position}:${message.message}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(message);
  }

  return deduped;
};

export const assignChatMessagesToCandidates = (
  candidates: CandidateChatHydrationTarget[],
  messages: MessageNode[],
): void => {
  const expanded = expandLinkedinTranscriptRows(messages);
  const byCandidateId = new Map<string, MessageNode[]>();
  const byPersonId = new Map<string, MessageNode[]>();

  for (const message of expanded) {
    if (isNonEmptyString(message.candidateId)) {
      const candidateMessages = byCandidateId.get(message.candidateId) ?? [];

      candidateMessages.push(message);
      byCandidateId.set(message.candidateId, candidateMessages);
    }

    if (isNonEmptyString(message.personId)) {
      const personMessages = byPersonId.get(message.personId) ?? [];

      personMessages.push(message);
      byPersonId.set(message.personId, personMessages);
    }
  }

  for (const candidate of candidates) {
    const fromCandidate = byCandidateId.get(candidate.id) ?? [];
    const fromPerson = isNonEmptyString(candidate.peopleId)
      ? (byPersonId.get(candidate.peopleId) ?? [])
      : [];
    const merged = dedupeMessagesById([...fromCandidate, ...fromPerson]);

    merged.sort(
      (left, right) =>
        new Date(left.createdAt).getTime() -
        new Date(right.createdAt).getTime(),
    );

    candidate.chatMessages = {
      edges: merged.map((node) => ({ node })),
    };
  }
};
