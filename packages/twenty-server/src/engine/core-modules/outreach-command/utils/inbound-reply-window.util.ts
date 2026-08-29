export type InboundBufferedTurn = {
  role: string;
  content: string;
  externalMessageId?: string;
  receivedAt?: string;
};

export const DEFAULT_INBOUND_WINDOW_DELAY_MINUTES = 2;
export const MIN_INBOUND_WINDOW_DELAY_MINUTES = 1;
export const MAX_INBOUND_WINDOW_DELAY_MINUTES = 60;

export const clampInboundWindowDelayMinutes = (
  delayMinutes?: number | null,
): number =>
  Math.min(
    MAX_INBOUND_WINDOW_DELAY_MINUTES,
    Math.max(
      MIN_INBOUND_WINDOW_DELAY_MINUTES,
      delayMinutes ?? DEFAULT_INBOUND_WINDOW_DELAY_MINUTES,
    ),
  );

export const inboundWindowTtlMs = (delayMinutes: number): number =>
  delayMinutes * 60 * 1000 + 60_000;

export const inboundTurnDedupeKey = (turn: InboundBufferedTurn): string =>
  turn.externalMessageId ||
  `${turn.role}:${turn.content}:${turn.receivedAt ?? ''}`;

export const unionInboundTurns = (
  existing: InboundBufferedTurn[],
  incoming: InboundBufferedTurn[],
): InboundBufferedTurn[] => {
  const merged: InboundBufferedTurn[] = [];
  const seen = new Set<string>();

  for (const turn of [...existing, ...incoming]) {
    const content = turn.content?.trim();

    if (!content) {
      continue;
    }

    const key = inboundTurnDedupeKey({ ...turn, content });

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push({ ...turn, content });
  }

  return merged;
};

export const concatenatedUserBurst = (turns: InboundBufferedTurn[]): string => {
  const burst: string[] = [];

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];

    if (turn.role === 'user') {
      burst.unshift(turn.content);
      continue;
    }

    break;
  }

  return burst.join('\n');
};

export const isCurrentInboundGeneration = (
  jobGeneration: number,
  cachedGeneration: number | undefined,
): boolean =>
  cachedGeneration === undefined || cachedGeneration === jobGeneration;
