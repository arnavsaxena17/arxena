import { isNonEmptyString } from '@sniptt/guards';

// Who wrote a turn. Unipile's webhook only pushes inbound LinkedIn messages, so a
// member replying from LinkedIn never reaches us as an event: 'agent' is stamped
// when the sequencer persists its own send, 'member' is inferred at pull time for
// any outbound turn the sequencer never recorded, and 'prospect' is inbound.
export type ChatTurnOrigin = 'agent' | 'member' | 'prospect' | 'system';

const CHAT_TURN_ORIGINS: ChatTurnOrigin[] = [
  'agent',
  'member',
  'prospect',
  'system',
];

export const isChatTurnOrigin = (value: unknown): value is ChatTurnOrigin =>
  typeof value === 'string' &&
  CHAT_TURN_ORIGINS.includes(value as ChatTurnOrigin);

export type ChatTurn = {
  role: string;
  content: string;
  id?: string;
  timestamp?: string;
  // Set when the thread spans several channels (see the transcript formatter).
  channel?: string;
  origin?: ChatTurnOrigin;
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
        ...(isChatTurnOrigin(row.origin) ? { origin: row.origin } : {}),
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

// Attribution only ever strengthens. A pull cannot tell a sequencer send from a
// human one, so it proposes 'member'; a recorded sequencer send proves 'agent'
// and wins whichever order the two writes land in. Flipping 'agent' back to
// 'member' would pause a candidate the sequencer legitimately messaged.
const mergeTurnOrigin = (
  existing: ChatTurnOrigin | undefined,
  incoming: ChatTurnOrigin | undefined,
): ChatTurnOrigin | undefined => {
  if (existing === 'agent' || incoming === 'agent') {
    return 'agent';
  }

  return existing ?? incoming;
};

export const mergeChatTurns = (
  existing: ChatTurn[],
  incoming: ChatTurn[],
): ChatTurn[] => {
  const merged = [...existing];
  // Each stored turn can absorb one incoming duplicate, so repeats survive.
  const unmatchedIndexes = merged.map((_, index) => index);

  for (const turn of incoming) {
    const matchPosition = unmatchedIndexes.findIndex((index) =>
      isSameMessage(merged[index], turn),
    );

    if (matchPosition >= 0) {
      const mergedIndex = unmatchedIndexes[matchPosition];
      const origin = mergeTurnOrigin(merged[mergedIndex].origin, turn.origin);

      if (isChatTurnOrigin(origin) && origin !== merged[mergedIndex].origin) {
        merged[mergedIndex] = { ...merged[mergedIndex], origin };
      }

      unmatchedIndexes.splice(matchPosition, 1);
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
