// Webhook payload interfaces for Unipile integration

export interface UnipileWebhookAttendee {
  attendee_id: string;
  attendee_name: string;
  attendee_provider_id: string;
  attendee_profile_url: string;
  // Additional fields returned by Unipile but not originally modeled
  attendee_specifics?: {
    provider?: string;
    phone_number?: string;
    lid?: string;
    [key: string]: unknown;
  };
  attendee_public_identifier?: string;
}

export interface UnipileWebhookAttachment {
  id?: string;
  attachment_id?: string;
  attachment_type?: string;
  attachment_url?: string | null;
  attachment_size?: number | null;
  size?: {
    height: string;
    width: string;
  };
  sticker?: string;
  unavailable?: string;
  mimetype?: string;
  type?: string;
  url?: string;
}

export interface UnipileAccountStatusWebhook {
  AccountStatus: {
    account_id: string;
    account_type: 'LINKEDIN' | 'WHATSAPP' | 'INSTAGRAM' | 'MESSENGER' | 'TELEGRAM' | 'X_TWITTER';
    message: 'OK' | 'ERROR' | 'STOPPED' | 'CREDENTIALS' | 'CONNECTING' | 'DELETED' | 'CREATION_SUCCESS' | 'RECONNECTED' | 'SYNC_SUCCESS';
    /** Optional: workspace_member_id or "workspaceMemberId|workspaceId" (from Hosted Auth name) */
    name?: string;
  };
}

export interface UnipileMessageWebhook {
  account_id: string;
  account_type: 'LINKEDIN' | 'WHATSAPP' | 'INSTAGRAM' | 'MESSENGER' | 'TELEGRAM' | 'X_TWITTER';
  account_info?: {
    type: string;
    feature?: string;
    user_id: string;
  };
  event: 'message_received' | 'message_reaction' | 'message_read' | 'message_edited' | 'message_deleted' | 'message_delivered';
  chat_id: string;
  timestamp: string;
  webhook_name: string;
  message_id: string;
  message: string | null;
  sender: UnipileWebhookAttendee;
  attendees: UnipileWebhookAttendee[];
  attachments?: UnipileWebhookAttachment | UnipileWebhookAttachment[];
  reaction?: string; // only for event "message_reaction"
  reaction_sender?: UnipileWebhookAttendee; // only for event "message_reaction"
  // Additional fields from actual webhook payloads
  subject?: string;
  is_sender?: boolean;
  provider_chat_id?: string;
  provider_message_id?: string;
  is_event?: number;
  quoted?: any;
  chat_content_type?: string | null;
  message_type?: string | null;
  is_group?: boolean;
  folder?: string[];
}

export interface UnipileEmailWebhook {
  account_id: string;
  account_type: 'GOOGLE' | 'MICROSOFT' | 'IMAP';
  event: 'email_received' | 'email_sent' | 'email_read';
  email_id: string;
  timestamp: string;
  webhook_name: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  body: string;
  attachments?: UnipileWebhookAttachment[];
}

export interface UnipileTrackingEmailWebhook {
  account_id: string;
  event: 'email_opened' | 'email_clicked';
  email_id: string;
  timestamp: string;
  webhook_name: string;
  tracking_data: {
    ip_address?: string;
    user_agent?: string;
    location?: string;
  };
}

/**
 * New relation webhook - supports both formats:
 *
 * 1. Flat format from Unipile USERS webhook (source: "users", event: "new_relation").
 *    Fired when someone accepts your LinkedIn invitation.
 *    @see https://developer.unipile.com/docs/detecting-accepted-invitations
 *
 * 2. Nested format with relation object (legacy)
 */
export interface UnipileNewRelationWebhook {
  event: 'new_relation';
  account_id: string;
  account_type: 'LINKEDIN';
  timestamp?: string;
  webhook_name?: string;
  /** Flat format - user who accepted the invitation */
  user_full_name?: string;
  user_provider_id?: string;
  user_public_identifier?: string;
  user_profile_url?: string;
  user_picture_url?: string;
  /** Nested format (legacy) */
  relation?: {
    relation_id: string;
    name: string;
    profile_url: string;
    connection_type: 'first' | 'second' | 'third';
    status: 'pending' | 'accepted' | 'ignored';
  };
}

// Union type for all webhook payloads
export type UnipileWebhookPayload = 
  | UnipileAccountStatusWebhook 
  | UnipileMessageWebhook 
  | UnipileEmailWebhook 
  | UnipileTrackingEmailWebhook 
  | UnipileNewRelationWebhook;

// Webhook management types
export interface CreateWebhookDto {
  source: 'messaging' | 'email' | 'tracking' | 'relations';
  request_url?: string;
  headers?: Array<{ key: string; value: string }>;
}

export interface WebhookResponse {
  id: string;
  url: string;
  source: string;
  created_at: string;
  status: string;
}
