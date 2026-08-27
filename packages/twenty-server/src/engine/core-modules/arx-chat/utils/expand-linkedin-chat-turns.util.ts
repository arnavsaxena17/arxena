import { isNonEmptyString } from '@sniptt/guards';

type ChatTurn = {
  role: string;
  content: string;
  id?: string;
  timestamp?: string;
};

export type ExpandableChatMessage = {
  id: string;
  message: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  position: number;
  whatsappDeliveryStatus: string;
  typeOfMessage?: string | null;
  messageObj?: unknown;
};

const asTurns = (value: unknown): ChatTurn[] => {
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
          : '';

    if (!isNonEmptyString(content)) {
      return [];
    }

    return [
      {
        role: typeof row.role === 'string' ? row.role : 'user',
        content,
        id: typeof row.id === 'string' ? row.id : undefined,
        timestamp:
          typeof row.timestamp === 'string' ? row.timestamp : undefined,
      },
    ];
  });
};

const turnTime = (turn: ChatTurn, index: number): number => {
  if (!isNonEmptyString(turn.timestamp)) {
    return index;
  }

  const parsed = Date.parse(turn.timestamp);

  return Number.isNaN(parsed) ? index : parsed;
};

const shouldExpandLinkedinTranscript = (
  row: ExpandableChatMessage,
  turns: ChatTurn[],
): boolean => {
  if (turns.length === 0) {
    return false;
  }

  return (
    row.typeOfMessage === 'linkedin' ||
    `${row.name ?? ''}`.toUpperCase().startsWith('LINKEDIN')
  );
};

export const expandLinkedinTranscriptRows = <T extends ExpandableChatMessage>(
  rows: T[],
): T[] => {
  let didExpand = false;
  const expanded = rows.flatMap((row) => {
    const turns = asTurns(row.messageObj);

    if (!shouldExpandLinkedinTranscript(row, turns)) {
      return [row];
    }

    didExpand = true;
    const ordered = turns
      .map((turn, index) => ({ turn, index, time: turnTime(turn, index) }))
      .sort((left, right) => left.time - right.time || left.index - right.index);

    return ordered.map(({ turn, index }) => {
      const isSent = turn.role === 'assistant';

      return {
        ...row,
        id: turn.id || `${row.id}:${index}`,
        message: turn.content,
        name: isSent ? 'botMessage' : 'candidateMessage',
        createdAt: turn.timestamp || row.createdAt,
        updatedAt: turn.timestamp || row.updatedAt,
        whatsappDeliveryStatus: isSent ? 'sent' : 'read',
      };
    });
  });

  if (!didExpand) {
    return rows;
  }

  return expanded
    .slice()
    .sort(
      (left, right) =>
        Date.parse(left.createdAt || '') - Date.parse(right.createdAt || ''),
    )
    .map((row, index) => ({
      ...row,
      position: index + 1,
    }));
};
