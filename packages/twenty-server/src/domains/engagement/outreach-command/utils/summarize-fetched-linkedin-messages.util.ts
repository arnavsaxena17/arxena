// Workflow IF_ELSE cannot scan message arrays; expose booleans for gating.

export type FetchLinkedinMessageLike = {
  isSender?: boolean;
  origin?: string;
};

export type FetchedLinkedinMessagesSummary = {
  hasInboundReply: boolean;
  inboundCount: number;
  hasManualOutbound: boolean;
  manualOutboundCount: number;
  // A workspace member has the floor: the newest turn came from them, not from
  // the sequencer and not from the prospect. Sending now would talk over a human.
  memberSentLast: boolean;
};

export const summarizeFetchedLinkedinMessages = (
  messages: FetchLinkedinMessageLike[] = [],
): FetchedLinkedinMessagesSummary => {
  // Agent-only notes ("member emailed the deck") are not conversation turns and
  // must never read as an inbound reply.
  const directional = messages.filter((message) => message.origin !== 'system');
  const inboundCount = directional.filter(
    (message) => message.isSender === false,
  ).length;
  const manualOutboundCount = directional.filter(
    (message) => message.isSender === true && message.origin === 'member',
  ).length;
  const last = directional[directional.length - 1];

  return {
    hasInboundReply: inboundCount > 0,
    inboundCount,
    hasManualOutbound: manualOutboundCount > 0,
    manualOutboundCount,
    memberSentLast: last?.isSender === true && last?.origin === 'member',
  };
};
