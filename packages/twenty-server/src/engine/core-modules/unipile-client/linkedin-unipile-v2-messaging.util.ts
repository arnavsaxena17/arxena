import { inferLinkedInSearchTypeFromUnipileOwnerProfile } from 'twenty-shared';
import type { UnipileAccountOwnerProfile } from 'twenty-shared';

import type { UnipileV2Client } from './unipile-v2.client';

export type LinkedInMessagingProduct =
  | 'classic'
  | 'sales_navigator'
  | 'recruiter';

export const UNIPILE_LINKEDIN_INBOX_ID: Record<
  LinkedInMessagingProduct,
  string
> = {
  classic: 'CLASSIC_PRIMARY',
  sales_navigator: 'SALES_NAVIGATOR_PRIMARY',
  recruiter: 'RECRUITER_PRIMARY',
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

export const extractUnipileChatId = (payload: unknown): string | undefined => {
  const record = asRecord(payload);
  if (!record) {
    return undefined;
  }
  if (typeof record.id === 'string' && record.id.trim()) {
    return record.id.trim();
  }
  if (typeof record.chat_id === 'string' && record.chat_id.trim()) {
    return record.chat_id.trim();
  }
  const items = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.data)
      ? record.data
      : Array.isArray(record.chats)
        ? record.chats
        : [];
  const first = asRecord(items[0]);
  if (!first) {
    return undefined;
  }
  if (typeof first.id === 'string' && first.id.trim()) {
    return first.id.trim();
  }
  if (typeof first.chat_id === 'string' && first.chat_id.trim()) {
    return first.chat_id.trim();
  }
  return undefined;
};

export const recruiterSignatureFromOwnerProfile = (
  profile: unknown,
): string => {
  const record = asRecord(profile) ?? {};
  const first =
    typeof record.first_name === 'string' ? record.first_name.trim() : '';
  const last =
    typeof record.last_name === 'string' ? record.last_name.trim() : '';
  const combined = `${first} ${last}`.trim();
  if (combined) {
    return combined;
  }
  if (typeof record.display_name === 'string' && record.display_name.trim()) {
    return record.display_name.trim();
  }
  if (typeof record.name === 'string' && record.name.trim()) {
    return record.name.trim();
  }
  return 'Recruiter';
};

export const inferLinkedinMessagingProductFromOwnerProfile = (
  profile: unknown,
): LinkedInMessagingProduct => {
  const record = asRecord(profile);
  if (!record) {
    return 'classic';
  }
  return inferLinkedInSearchTypeFromUnipileOwnerProfile(
    record as UnipileAccountOwnerProfile,
  );
};

export const buildLinkedinStartChatInboxOptions = (args: {
  product: LinkedInMessagingProduct;
  isInMail?: boolean;
  subject?: string;
  signature?: string;
}): Record<string, unknown> | undefined => {
  if (args.product === 'classic') {
    if (!args.isInMail) {
      return undefined;
    }
    return {
      linkedin: {
        classic: { inmail: true },
      },
    };
  }
  if (args.product === 'sales_navigator') {
    return {
      linkedin: {
        sales_navigator: {
          subject: args.subject?.trim() || 'Message',
        },
      },
    };
  }
  return {
    linkedin: {
      recruiter: {
        subject: args.subject?.trim() || 'Message',
        signature: args.signature?.trim() || 'Recruiter',
      },
    },
  };
};

type LinkedinV2MessagingClient = Pick<
  UnipileV2Client,
  'getUserChat' | 'sendChatMessage' | 'startChatFromInbox' | 'getUser'
>;

export const sendLinkedinV2OutboundMessage = async (args: {
  client: LinkedinV2MessagingClient;
  accountId: string;
  usersIds: string[];
  text: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    data?: string;
    content?: string;
  }>;
  subject?: string;
  isInMail?: boolean;
  product?: LinkedInMessagingProduct;
}): Promise<unknown> => {
  const attendeeId = args.usersIds[0];
  let chatId: string | undefined;
  if (attendeeId) {
    try {
      chatId = extractUnipileChatId(
        await args.client.getUserChat(args.accountId, attendeeId),
      );
    } catch {
      chatId = undefined;
    }
  }

  if (chatId) {
    return args.client.sendChatMessage({
      accountId: args.accountId,
      chatId,
      text: args.text,
      attachments: args.attachments,
    });
  }

  let product = args.product;
  let ownerProfile: unknown;
  if (!product || product === 'recruiter') {
    try {
      ownerProfile = await args.client.getUser(args.accountId, 'me');
    } catch {
      ownerProfile = undefined;
    }
  }
  if (!product) {
    product = inferLinkedinMessagingProductFromOwnerProfile(ownerProfile);
  }

  const options = buildLinkedinStartChatInboxOptions({
    product,
    isInMail: args.isInMail,
    subject: args.subject,
    signature: recruiterSignatureFromOwnerProfile(ownerProfile),
  });

  return args.client.startChatFromInbox({
    accountId: args.accountId,
    inboxId: UNIPILE_LINKEDIN_INBOX_ID[product],
    usersIds: args.usersIds,
    text: args.text,
    attachments: args.attachments,
    name: args.subject,
    options,
  });
};
