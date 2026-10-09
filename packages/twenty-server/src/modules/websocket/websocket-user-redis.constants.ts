/** Redis channel prefix; full channel = websocket_user:{workspaceMemberId} */
export const WEBSOCKET_USER_CHANNEL_PREFIX = 'websocket_user:';

export type WebSocketUserRedisPayload = {
  event: string;
  data: Record<string, unknown>;
};

/** Redis channel prefix for room events; full channel = websocket_room:{room} */
export const WEBSOCKET_ROOM_CHANNEL_PREFIX = 'websocket_room:';

export type WebSocketRoomRedisPayload = {
  room: string;
  event: string;
  data: Record<string, unknown>;
};
