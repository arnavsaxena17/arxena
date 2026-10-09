import { isNonEmptyString } from '@sniptt/guards';

export type ChatTurn = {
  role: string;
  content: string;
  id?: string;
  timestamp?: string;
  // Set when the thread spans several channels (see the transcript formatter).
  channel?: string;
};

export const asChatTurns = (value: unknown): ChatTurn[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const row = item as Record<string, unknown>;
    const content =
      typeof row.content === 'string'
        ? row.content
        : typeof row.message === 'string'
          ? row.message
          : typeof row.text === 'string'
            ? row.text
            : '';

    if (!isNonEmptyString(content)) {
      return [];
    }

    const roleFromIsSender =
      typeof row.isSender === 'boolean'
        ? row.isSender
          ? 'assistant'
          : 'user'
        : undefined;

    return [
      {
        role:
          typeof row.role === 'string'
            ? row.role
            : (roleFromIsSender ?? 'user'),
        content,
        ...(typeof row.id === 'string' ? { id: row.id } : {}),
        ...(typeof row.timestamp === 'string'
          ? { timestamp: row.timestamp }
          : {}),
        ...(typeof row.channel === 'string' ? { channel: row.channel } : {}),
      },
    ];
  });
};

// The same message can reach us twice (our own persist, then a provider fetch
// or webhook). Two turns are the same message when their ids match, or when
// role and text match and nothing says they are different sends. A prospect
// who writes "ok" twice, or an identical follow-up sent weeks later, must
// stay in the history, so equal text alone is not enough.
const SAME_MESSAGE_WINDOW_MS = 2 * 60 * 1000;

const isSameMessage = (existing: ChatTurn, incoming: ChatTurn): boolean => {
  // Provider ids are unique per message, so equal ids always mean a duplicate.
  if (isNonEmptyString(existing.id) && isNonEmptyString(incoming.id)) {
    if (existing.id === incoming.id) {
      return true;
    }
  }

  if (
    existing.role !== incoming.role ||
    existing.content !== incoming.content
  ) {
    return false;
  }

  // Different ids on identical text are two real sends ("ok", then "ok").
  if (isNonEmptyString(existing.id) && isNonEmptyString(incoming.id)) {
    return false;
  }

  const existingTime = Date.parse(existing.timestamp ?? '');
  const incomingTime = Date.parse(incoming.timestamp ?? '');

  if (Number.isNaN(existingTime) || Number.isNaN(incomingTime)) {
    return true;
  }

  return Math.abs(existingTime - incomingTime) <= SAME_MESSAGE_WINDOW_MS;
};

export const mergeChatTurns = (
  existing: ChatTurn[],
  incoming: ChatTurn[],
): ChatTurn[] => {
  const merged = [...existing];
  // Each stored turn can absorb one incoming duplicate, so repeats survive.
  const unmatched = [...existing];

  for (const turn of incoming) {
    const matchIndex = unmatched.findIndex((candidate) =>
      isSameMessage(candidate, turn),
    );

    if (matchIndex >= 0) {
      unmatched.splice(matchIndex, 1);
      continue;
    }

    merged.push(turn);
  }

  return merged;
};

// Prefer timestamped turns, then append any messageObj-only turns.
export const foldTimestampedIntoMessageObj = (
  messageObj: unknown,
  messageObjWithTimeStamp: unknown,
): ChatTurn[] =>
  mergeChatTurns(asChatTurns(messageObjWithTimeStamp), asChatTurns(messageObj));
