import {
  canonicalizeLinkedinProfileUrl,
  extractLinkedinProfileId,
} from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';

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

export const normalizeLinkedinProfileUrl = (value?: string | null): string =>
  canonicalizeLinkedinProfileUrl(value);

export const resolveAcceptedRelationIdentity = (
  payload: UnipileNewRelationWebhook,
): ResolvedAcceptedRelation | null => {
  const publicIdentifier = (
    payload.user_public_identifier?.trim() ||
    extractLinkedinProfileId(payload.user_profile_url) ||
    extractLinkedinProfileId(payload.relation?.profile_url)
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
