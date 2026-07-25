/** Redis channel prefix; full channel = websocket_user:{workspaceMemberId} */
export const WEBSOCKET_USER_CHANNEL_PREFIX = 'websocket_user:';

export type WebSocketUserRedisPayload = {
  event: string;
  data: Record<string, unknown>;
};
