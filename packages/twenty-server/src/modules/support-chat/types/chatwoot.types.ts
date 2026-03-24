export type ChatwootMessageType =
  | 'incoming'
  | 'outgoing'
  | 'template'
  | number
  | null;

export type ChatwootWebhookPayload = {
  event: string;
  id?: number | string;
  content?: string | null;
  message_type?: ChatwootMessageType;
  private?: boolean;
  created_at?: number | string;
  content_type?: string | null;
  content_attributes?: Record<string, unknown>;
  source_id?: string | null;
  changed_attributes?: Array<Record<string, unknown>>;
  sender?: {
    id?: number | string;
    name?: string | null;
    email?: string | null;
    type?: string | null;
  };
  user?: {
    id?: number | string;
    name?: string | null;
    email?: string | null;
    type?: string | null;
  };
  contact?: {
    id?: number | string;
    name?: string | null;
    email?: string | null;
    phone_number?: string | null;
    identifier?: string | null;
    custom_attributes?: Record<string, unknown>;
  };
  inbox?: {
    id?: number | string;
    name?: string | null;
  };
  account?: {
    id?: number | string;
    name?: string | null;
  };
  conversation?: {
    id?: number | string;
    display_id?: number | string;
    inbox_id?: number | string;
    status?: string | null;
    labels?: string[];
    messages?: Array<Record<string, unknown>>;
    meta?: {
      sender?: {
        email?: string | null;
        name?: string | null;
      };
      assignee?: {
        id?: number | string;
        name?: string | null;
      };
    };
    contact_inbox?: {
      source_id?: string | null;
      hmac_verified?: boolean;
    };
    additional_attributes?: {
      referer?: string | null;
      browser?: Record<string, unknown>;
    };
    custom_attributes?: Record<string, unknown>;
  };
  current_conversation?: ChatwootWebhookPayload['conversation'];
  event_info?: {
    referer?: string | null;
    widget_language?: string | null;
    browser_language?: string | null;
    initiated_at?: {
      timestamp?: string | null;
    };
    browser?: Record<string, unknown>;
  };
};

export type NormalizedSupportChatEvent = {
  event: string;
  deliveryId: string;
  conversationId: string;
  displayId?: string;
  content: string;
  messageType: 'incoming' | 'outgoing' | 'template' | 'unknown';
  isPrivate: boolean;
  conversationStatus?: string;
  createdAt?: string;
  labels: string[];
  contact: {
    id?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
    identifier?: string;
    companyDomain?: string;
  };
  sender: {
    id?: string;
    name?: string;
    email?: string;
    type?: string;
  };
  accountId?: string;
  inboxId?: string;
  referer?: string;
  sourceId?: string;
  transcript: string[];
  rawPayload: ChatwootWebhookPayload;
};

export type SupportAiDecision = {
  decision: 'reply' | 'handoff' | 'ignore';
  reply?: string;
  summary: string;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
};
