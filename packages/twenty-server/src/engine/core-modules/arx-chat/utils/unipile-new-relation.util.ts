import { type UnipileNewRelationWebhook } from '../types/unipile-webhook.types';

/**
 * Official Unipile USERS webhook `new_relation` payload keys.
 * @see https://developer.unipile.com/docs/detecting-accepted-invitations
 */
export const UNIPILE_NEW_RELATION_PAYLOAD_KEYS = [
  'event',
  'account_id',
  'account_type',
  'webhook_name',
  'user_full_name',
  'user_provider_id',
  'user_public_identifier',
  'user_profile_url',
  'user_picture_url',
] as const;

export type ResolvedAcceptedRelation = {
  name: string;
  providerId: string;
  profileUrl: string;
  publicIdentifier: string;
};

export const normalizeLinkedinProfileUrl = (
  value?: string | null,
): string => {
  const trimmed = value?.trim() ?? '';

  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed) || /linkedin\.com\//i.test(trimmed)) {
    return trimmed.replace(/www\.linkedin\.com/i, 'linkedin.com');
  }

  const slug = trimmed.replace(/^@/, '').replace(/^\/+|\/+$/g, '');

  if (!slug) {
    return '';
  }

  return `https://linkedin.com/in/${slug}`;
};

const slugFromLinkedinUrl = (url: string): string => {
  const match = /linkedin\.com\/(?:mwlite\/)?in\/([^/?#]+)/i.exec(url);

  return match?.[1]
    ? decodeURIComponent(match[1]).replace(/\/+$/, '')
    : '';
};

export const resolveAcceptedRelationIdentity = (
  payload: UnipileNewRelationWebhook,
): ResolvedAcceptedRelation | null => {
  const publicIdentifier = (
    payload.user_public_identifier?.trim() ||
    slugFromLinkedinUrl(payload.user_profile_url ?? '') ||
    slugFromLinkedinUrl(payload.relation?.profile_url ?? '')
  ).replace(/^@/, '');

  const profileUrl =
    normalizeLinkedinProfileUrl(
      payload.user_profile_url ?? payload.relation?.profile_url,
    ) ||
    (publicIdentifier ? `https://linkedin.com/in/${publicIdentifier}` : '');

  if (!profileUrl) {
    return null;
  }

  const name =
    payload.user_full_name?.trim() ||
    payload.relation?.name?.trim() ||
    publicIdentifier ||
    'Unknown';

  const providerId =
    payload.user_provider_id?.trim() || publicIdentifier || profileUrl;

  return {
    name,
    providerId,
    profileUrl,
    publicIdentifier,
  };
};
