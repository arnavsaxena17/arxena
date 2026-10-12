import {
  type OutreachListEntity,
  type OutreachListRow,
} from 'src/engine/core-modules/outreach-list/outreach-list.types';

export const normalizeDomain = (value: string): string => {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(
      /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`,
    );

    return url.hostname.replace(/^www\./, '');
  } catch {
    return trimmed
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
  }
};

// Public profile and company URLs only. Sales Navigator lead URLs carry a
// search token that changes between searches, so they never act as a key.
export const normalizeLinkedinUrl = (value: string): string => {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed || trimmed.includes('/sales/')) {
    return '';
  }

  return trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
};

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const buildOutreachListRowKey = (
  entity: OutreachListEntity,
  row: Pick<
    OutreachListRow,
    'domain' | 'website' | 'linkedinUrl' | 'name' | 'companyName'
  >,
): string => {
  const linkedin = normalizeLinkedinUrl(row.linkedinUrl);

  if (entity === 'company') {
    const domain = normalizeDomain(row.domain || row.website);

    if (domain) {
      return `d:${domain}`;
    }

    if (linkedin) {
      return `l:${linkedin}`;
    }

    return `n:${normalizeText(row.name)}`;
  }

  if (linkedin) {
    return `l:${linkedin}`;
  }

  return `n:${normalizeText(row.name)}|${normalizeText(row.companyName)}`;
};
