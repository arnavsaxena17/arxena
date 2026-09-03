import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

export type ChatMessageForTable = {
  createdAt?: string | null;
  name?: string | null;
  message?: string | null;
  typeOfMessage?: string | null;
  messageObj?: unknown;
};

export type ChatMessagesForTable = {
  edges?: Array<{
    node?: ChatMessageForTable | null;
  } | null> | null;
} | null;

type ChatTurn = {
  role: string;
  content: string;
  timestamp?: string;
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
        timestamp:
          typeof row.timestamp === 'string' ? row.timestamp : undefined,
      },
    ];
  });
};

const resolveSenderLabel = (name?: string | null): string => {
  if (name === 'candidateMessage') {
    return 'Candidate';
  }

  if (name === 'botMessage' || name === 'recruiterMessage') {
    return 'Recruiter';
  }

  return isNonEmptyString(name) ? name : 'Message';
};

const shouldExpandLinkedinTranscript = (node: ChatMessageForTable): boolean =>
  `${node.name ?? ''}`.toUpperCase().startsWith('LINKEDIN');

const flattenChatMessageNodes = (
  nodes: ChatMessageForTable[],
): ChatMessageForTable[] =>
  nodes.flatMap((node) => {
    const turns = asTurns(node.messageObj);

    if (!shouldExpandLinkedinTranscript(node) || turns.length === 0) {
      return [node];
    }

    return turns.map((turn) => ({
      ...node,
      message: turn.content,
      name: turn.role === 'assistant' ? 'botMessage' : 'candidateMessage',
      createdAt: turn.timestamp || node.createdAt,
    }));
  });

const formatTimestamp = (createdAt?: string | null): string => {
  if (!isNonEmptyString(createdAt)) {
    return '';
  }

  const parsed = new Date(createdAt);

  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatMessagesExchanged = (
  chatMessages?: ChatMessagesForTable,
): string => {
  const nodes = (chatMessages?.edges ?? [])
    .map((edge) => edge?.node)
    .filter(isDefined);

  const flattened = flattenChatMessageNodes(nodes).filter((node) =>
    isNonEmptyString(node.message),
  );

  const sorted = [...flattened].sort(
    (left, right) =>
      new Date(left.createdAt || 0).getTime() -
      new Date(right.createdAt || 0).getTime(),
  );

  return sorted
    .map((node) => {
      const timestamp = formatTimestamp(node.createdAt);
      const sender = resolveSenderLabel(node.name);

      return timestamp
        ? `[${timestamp}] ${sender}: ${node.message}`
        : `${sender}: ${node.message}`;
    })
    .join('\n');
};

export const formatLastInboundMessage = (
  chatMessages?: ChatMessagesForTable,
): string => {
  const inbound = resolveLastInboundChat(chatMessages);

  return inbound?.message ?? '';
};

export const resolveLastInboundChat = (
  chatMessages?: ChatMessagesForTable,
): { message: string; createdAt: string | null } | null => {
  const nodes = (chatMessages?.edges ?? [])
    .map((edge) => edge?.node)
    .filter(isDefined);

  const flattened = flattenChatMessageNodes(nodes).filter(
    (node) =>
      isNonEmptyString(node.message) && node.name === 'candidateMessage',
  );

  if (flattened.length === 0) {
    return null;
  }

  const latest = [...flattened].sort(
    (left, right) =>
      new Date(right.createdAt || 0).getTime() -
      new Date(left.createdAt || 0).getTime(),
  )[0];

  return {
    message: latest.message?.trim() ?? '',
    createdAt: latest.createdAt ?? null,
  };
};
