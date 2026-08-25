import { isNonEmptyString } from '@sniptt/guards';
import { isAxiosError } from 'axios';

import { LinkedinUnipileMessagingService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile/linkedin-unipile-messaging.service';
import { WhatsappUnipileMessagingService } from 'src/engine/core-modules/arx-chat/services/whatsapp-unipile/whatsapp-unipile-messaging.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

// Low-level Unipile send methods only need env credentials; CRM deps are unused.
const unusedWorkspaceQueryService =
  null as unknown as WorkspaceQueryService;
const unusedStaticGraphQLService = null as unknown as StaticGraphQLService;

export const createLinkedinUnipileMessagingServiceForTools = () =>
  new LinkedinUnipileMessagingService(
    unusedWorkspaceQueryService,
    unusedStaticGraphQLService,
  );

export const createWhatsappUnipileMessagingServiceForTools = () =>
  new WhatsappUnipileMessagingService(
    unusedWorkspaceQueryService,
    unusedStaticGraphQLService,
  );

export const LINKEDIN_CONNECTION_REQUEST_MAX_MESSAGE_LENGTH = 300;

export const truncateLinkedinConnectionRequestMessage = (
  message: string,
): string => {
  if (message.length <= LINKEDIN_CONNECTION_REQUEST_MAX_MESSAGE_LENGTH) {
    return message;
  }

  return message.slice(0, LINKEDIN_CONNECTION_REQUEST_MAX_MESSAGE_LENGTH);
};

export const buildWhatsappAttendeeIdFromPhone = (phone: string): string => {
  const normalizedPhoneNumber = phone.trim().replace(/[^\d+]/g, '');

  return `${normalizedPhoneNumber}@s.whatsapp.net`;
};

const formatUnipileApiErrorBody = (data: unknown): string | undefined => {
  if (isNonEmptyString(data)) {
    return data.trim();
  }

  if (typeof data !== 'object' || data === null) {
    return undefined;
  }

  const body = data as Record<string, unknown>;
  const title = isNonEmptyString(body.title) ? body.title.trim() : undefined;
  const detail = isNonEmptyString(body.detail) ? body.detail.trim() : undefined;
  const message = isNonEmptyString(body.message)
    ? body.message.trim()
    : undefined;
  const type = isNonEmptyString(body.type) ? body.type.trim() : undefined;

  const parts: string[] = [];

  if (title) {
    parts.push(title);
  }

  if (detail && detail !== title) {
    parts.push(detail);
  }

  if (message && message !== title && message !== detail) {
    parts.push(message);
  }

  const summary = parts.join('. ');

  if (summary && type) {
    return `${summary} (${type})`;
  }

  return summary || type;
};

export const getUnipileToolErrorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const fromBody = formatUnipileApiErrorBody(error.response?.data);

    if (fromBody) {
      return fromBody;
    }
  }

  if (error instanceof Error && isNonEmptyString(error.message)) {
    return error.message;
  }

  return 'Unipile messaging request failed';
};
