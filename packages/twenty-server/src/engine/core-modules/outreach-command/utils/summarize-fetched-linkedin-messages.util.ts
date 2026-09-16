// Workflow IF_ELSE cannot scan message arrays; expose a boolean for gating.

export const summarizeFetchedLinkedinMessages = (
  messages: Array<{ isSender?: boolean }>,
): { hasInboundReply: boolean; inboundCount: number } => {
  const inboundCount = messages.filter(
    (message) => message.isSender === false,
  ).length;

  return {
    hasInboundReply: inboundCount > 0,
    inboundCount,
  };
};
