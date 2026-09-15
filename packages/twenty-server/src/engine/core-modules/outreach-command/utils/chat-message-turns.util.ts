import { isNonEmptyString } from '@sniptt/guards';

export type ChatTurn = {
  role: string;
  content: string;
  id?: string;
  timestamp?: string;
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
      },
    ];
  });
};

const rememberTurnKeys = (seen: Set<string>, turn: ChatTurn): void => {
  seen.add(`${turn.role}:${turn.content}`);

  if (isNonEmptyString(turn.id)) {
    seen.add(turn.id);
  }
};

export const mergeChatTurns = (
  existing: ChatTurn[],
  incoming: ChatTurn[],
): ChatTurn[] => {
  const merged = [...existing];
  const seen = new Set<string>();

  for (const turn of existing) {
    rememberTurnKeys(seen, turn);
  }

  for (const turn of incoming) {
    const alreadySeen =
      seen.has(`${turn.role}:${turn.content}`) ||
      (isNonEmptyString(turn.id) && seen.has(turn.id));

    if (alreadySeen) {
      continue;
    }

    rememberTurnKeys(seen, turn);
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
