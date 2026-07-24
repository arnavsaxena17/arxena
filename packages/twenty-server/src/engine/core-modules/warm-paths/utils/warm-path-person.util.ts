import { extractLinkedinSlugFromUrl } from 'twenty-shared';

import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import type { WarmPathNetworkPerson } from '../warm-paths.types';

export const extractLinkedinIdentifierFromUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return '';
  }
  if (!trimmed.includes('linkedin.com')) {
    return trimmed.replace(/^\/+/, '');
  }
  return extractLinkedinSlugFromUrl(trimmed);
};

export const buildLinkedinProfileUrl = (publicIdentifier: string): string => {
  const slug = publicIdentifier.trim();
  if (!slug) {
    return '';
  }
  return `https://www.linkedin.com/in/${slug}`;
};

export const mapSearchResultToPerson = (
  item: LinkedInPeopleSearchResult,
): WarmPathNetworkPerson => {
  const publicIdentifier = item.public_identifier?.trim() ?? '';
  const fullName =
    item.name?.trim() ||
    `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() ||
    publicIdentifier;

  return {
    publicIdentifier,
    fullName,
    headline: item.headline ?? null,
    linkedinUrl:
      item.public_profile_url?.trim() ||
      item.profile_url?.trim() ||
      buildLinkedinProfileUrl(publicIdentifier),
    providerId: item.id?.trim() ?? publicIdentifier,
    sharedConnectionsWithViewer: item.shared_connections_count ?? null,
    networkDistanceToViewer: item.network_distance ?? null,
  };
};

export const mapProfileRecordToPerson = (
  profile: Record<string, unknown>,
  fallbackIdentifier: string,
): WarmPathNetworkPerson => {
  const publicIdentifier =
    (typeof profile.public_identifier === 'string'
      ? profile.public_identifier
      : fallbackIdentifier) || fallbackIdentifier;
  const firstName =
    typeof profile.first_name === 'string' ? profile.first_name : '';
  const lastName =
    typeof profile.last_name === 'string' ? profile.last_name : '';
  const fullName =
    (typeof profile.name === 'string' ? profile.name : '') ||
    `${firstName} ${lastName}`.trim() ||
    publicIdentifier;

  return {
    publicIdentifier,
    fullName,
    headline:
      (typeof profile.headline === 'string' ? profile.headline : null) ||
      (typeof profile.occupation === 'string' ? profile.occupation : null),
    linkedinUrl: buildLinkedinProfileUrl(publicIdentifier),
    providerId:
      (typeof profile.provider_id === 'string'
        ? profile.provider_id
        : publicIdentifier) || publicIdentifier,
    sharedConnectionsWithViewer:
      typeof profile.shared_connections_count === 'number'
        ? profile.shared_connections_count
        : null,
    networkDistanceToViewer:
      typeof profile.network_distance === 'string'
        ? profile.network_distance
        : null,
  };
};

export const normalizeNetworkDistanceLabel = (
  raw: string | null | undefined,
): string | null => {
  if (!raw) {
    return null;
  }
  const upper = raw.toUpperCase();
  if (upper.includes('1') || upper === 'SELF' || upper === 'FIRST_DEGREE') {
    return '1st degree';
  }
  if (upper.includes('2') || upper === 'SECOND_DEGREE') {
    return '2nd degree';
  }
  if (upper.includes('3') || upper === 'THIRD_DEGREE') {
    return '3rd degree';
  }
  if (upper.includes('OUT')) {
    return 'Out of network';
  }
  return raw;
};
