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
  id: string;
  size?: {
    height: string;
    width: string;
  };
  sticker: string;
  unavailable: string;
  mimetype: string;
  type: string;
  url: string;
}

export interface UnipileAccountStatusWebhook {
  AccountStatus: {
    account_id: string;
    account_type: 'LINKEDIN' | 'WHATSAPP' | 'INSTAGRAM' | 'MESSENGER' | 'TELEGRAM' | 'X_TWITTER';
    message: 'OK' | 'ERROR' | 'STOPPED' | 'CREDENTIALS' | 'CONNECTING' | 'DELETED' | 'CREATION_SUCCESS' | 'RECONNECTED' | 'SYNC_SUCCESS';
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
  message: string;
  sender: UnipileWebhookAttendee;
  attendees: UnipileWebhookAttendee[];
  attachments?: UnipileWebhookAttachment;
  reaction?: string; // only for event "message_reaction"
  reaction_sender?: UnipileWebhookAttendee; // only for event "message_reaction"
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

export interface UnipileNewRelationWebhook {
  account_id: string;
  account_type: 'LINKEDIN';
  event: 'new_relation';
  timestamp: string;
  webhook_name: string;
  relation: {
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
