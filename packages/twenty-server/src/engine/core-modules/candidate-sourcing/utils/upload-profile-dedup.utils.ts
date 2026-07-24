import { UserProfile } from 'twenty-shared';

import { DataProcessingUtils } from 'src/engine/core-modules/candidate-sourcing/utils/data-processing.utils';
import { normalizeLinkedInUrl } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-url.utils';

export type CandidateUploadLookup = {
  byUniqueStringKey: Map<string, unknown>;
  byEmail: Map<string, unknown>;
  byPhone: Map<string, unknown>;
  byLinkedinUrl: Map<string, unknown>;
  byHiringNaukriUrl: Map<string, unknown>;
  byResdexNaukriUrl: Map<string, unknown>;
};

export const normalizeUrlForDedup = (raw: string): string => {
  if (!raw || typeof raw !== 'string') {
    return '';
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const withScheme = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/$/, '')}${u.search}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase().replace(/\/$/, '');
  }
};

type LooseProfile = UserProfile | Record<string, unknown>;

/**
 * Resolves phone input for dedup / lookup: GraphQL-style `phones` / `phone`
 * ({ primaryPhoneNumber, ... }), optional nested `person`, then flat legacy fields.
 */
export const extractPhoneRawForUploadDedup = (
  profile: LooseProfile,
): unknown => {
  const p = profile as Record<string, unknown>;

  const fromPhonesShape = (o: unknown): unknown => {
    if (!o || typeof o !== 'object') {
      return undefined;
    }
    const obj = o as Record<string, unknown>;
    if (typeof obj.primaryPhoneNumber === 'string' && obj.primaryPhoneNumber.trim() !== '') {
      return o;
    }
    return undefined;
  };

  const fromPerson = (person: unknown): unknown => {
    if (!person || typeof person !== 'object') {
      return undefined;
    }
    const per = person as Record<string, unknown>;
    return fromPhonesShape(per.phones) ?? fromPhonesShape(per.phone);
  };

  const fromSpreadsheetColumns =
    p['Phone number (phones)'] ??
    p['Phone number (phoneNumber)'] ??
    p['Phone Number'] ??
    p.phone_number;

  return (
    fromPhonesShape(p.phones) ??
    fromPhonesShape(p.phone) ??
    fromPerson(p.person) ??
    p.phoneNumbers ??
    p.phoneNumber ??
    (Array.isArray(p.phoneNumbers) ? (p.phoneNumbers as unknown[])[0] : undefined) ??
    fromSpreadsheetColumns
  );
};

/**
 * Resolves email input for dedup / lookup: GraphQL-style `emails` / `email`
 * ({ primaryEmail, ... }), optional nested `person`, then flat legacy fields.
 */
export const extractEmailRawForUploadDedup = (
  profile: LooseProfile,
): unknown => {
  const p = profile as Record<string, unknown>;

  const fromEmailsShape = (o: unknown): unknown => {
    if (!o || typeof o !== 'object') {
      return undefined;
    }
    const obj = o as Record<string, unknown>;
    if (typeof obj.primaryEmail === 'string' && obj.primaryEmail.trim() !== '') {
      return o;
    }
    return undefined;
  };

  const fromPerson = (person: unknown): unknown => {
    if (!person || typeof person !== 'object') {
      return undefined;
    }
    const per = person as Record<string, unknown>;
    return fromEmailsShape(per.emails) ?? fromEmailsShape(per.email);
  };

  const fromSpreadsheetColumns =
    p['Email (emails)'] ??
    p['Email (email)'] ??
    p['Email ID'] ??
    p.email_address;

  return (
    fromEmailsShape(p.emails) ??
    fromEmailsShape(p.email) ??
    fromPerson(p.person) ??
    p.emailAddress ??
    p.emailAddresses ??
    p.email ??
    fromSpreadsheetColumns
  );
};

const linkUrl = (v: unknown): string => {
  if (v && typeof v === 'object' && 'primaryLinkUrl' in (v as object)) {
    const u = (v as { primaryLinkUrl?: string }).primaryLinkUrl;
    return typeof u === 'string' ? u : '';
  }
  return '';
};

/**
 * Extracts resdex / hiring / linkedin URL identifiers in priority order for dedup + DB lookup.
 * Priority for a single "url tier" dedup key: resdex → hiring → linkedin.
 */
export const extractUploadUrlBucket = (
  profile: LooseProfile,
): {
  resdexNorm: string;
  hiringNorm: string;
  linkedinNorm: string;
  primaryUrlDedupKey: string;
} => {
  const p = profile as Record<string, unknown>;
  const profileUrl = typeof p.profileUrl === 'string' ? p.profileUrl : '';
  const linkedinField = typeof p.linkedinUrl === 'string' ? p.linkedinUrl : '';

  let resdexNorm = '';
  if (profileUrl.toLowerCase().includes('resdex')) {
    resdexNorm = normalizeUrlForDedup(profileUrl);
  }
  if (!resdexNorm) {
    const fromObj = linkUrl(p.resdexNaukriUrl);
    if (fromObj) {
      resdexNorm = normalizeUrlForDedup(fromObj);
    }
  }

  let hiringNorm = '';
  if (
    profileUrl &&
    profileUrl.toLowerCase().includes('hiring') &&
    profileUrl.toLowerCase().includes('naukri')
  ) {
    hiringNorm = normalizeUrlForDedup(profileUrl);
  }
  if (!hiringNorm) {
    const fromObj = linkUrl(p.hiringNaukriUrl);
    if (fromObj) {
      hiringNorm = normalizeUrlForDedup(fromObj);
    }
  }

  let linkedinNorm = '';
  if (profileUrl.toLowerCase().includes('linkedin')) {
    linkedinNorm = normalizeLinkedInUrl(profileUrl);
  }
  if (!linkedinNorm && linkedinField) {
    linkedinNorm = normalizeLinkedInUrl(linkedinField);
  }
  if (!linkedinNorm) {
    const fromObj = linkUrl(p.linkedinUrl);
    if (fromObj) {
      linkedinNorm = normalizeLinkedInUrl(fromObj);
    }
  }

  let primaryUrlDedupKey = '';
  if (resdexNorm) {
    primaryUrlDedupKey = `url:resdex:${resdexNorm}`;
  } else if (hiringNorm) {
    primaryUrlDedupKey = `url:hiring:${hiringNorm}`;
  } else if (linkedinNorm) {
    primaryUrlDedupKey = `url:linkedin:${linkedinNorm}`;
  }

  return { resdexNorm, hiringNorm, linkedinNorm, primaryUrlDedupKey };
};

export const getUploadProfileDedupMapKey = (
  profile: LooseProfile,
  dataProcessingUtils: DataProcessingUtils,
): string => {
  const p = profile as Record<string, unknown>;
  const { primaryUrlDedupKey } = extractUploadUrlBucket(profile);
  if (primaryUrlDedupKey) {
    return primaryUrlDedupKey;
  }

  const phoneRaw = extractPhoneRawForUploadDedup(profile);
  const phoneData = dataProcessingUtils.parsePhoneNumbers(phoneRaw);
  if (phoneData.primaryPhoneNumber && phoneData.primaryPhoneNumber.trim() !== '') {
    return `phone:${dataProcessingUtils.cleanPhoneNumber(phoneData.primaryPhoneNumber)}`;
  }

  const emailRaw = extractEmailRawForUploadDedup(profile);
  const emailData = dataProcessingUtils.parseEmails(emailRaw);
  if (emailData.primaryEmail && emailData.primaryEmail.trim() !== '') {
    return `email:${emailData.primaryEmail.toLowerCase().trim()}`;
  }

  const usk = typeof p.uniqueStringKey === 'string' ? p.uniqueStringKey.trim() : '';
  if (usk) {
    return `usk:${usk}`;
  }

  const id = typeof p.id === 'string' ? p.id.trim() : '';
  if (id) {
    return `id:${id}`;
  }

  return 'anon:empty';
};

/**
 * Pre-transform spreadsheet rows often only have `Phone Number` / `Email ID` columns.
 * If we returned `anon:empty` for every row, dedup would collapse the whole upload to one record.
 */
export const getUploadProfileDedupMapKeyOrRowFallback = (
  profile: LooseProfile,
  dataProcessingUtils: DataProcessingUtils,
  rowIndex: number,
): string => {
  const k = getUploadProfileDedupMapKey(profile, dataProcessingUtils);
  if (k === 'anon:empty') {
    return `raw_row:${rowIndex}`;
  }
  return k;
};

export const deduplicateProfilesForUpload = <T extends LooseProfile>(
  profiles: T[],
  dataProcessingUtils: DataProcessingUtils,
): T[] => {
  const map = new Map<string, T>();
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    const k = getUploadProfileDedupMapKeyOrRowFallback(
      profile,
      dataProcessingUtils,
      i,
    );
    map.set(k, profile);
  }
  return Array.from(map.values());
};

export const deduplicateLooseUploadRows = (
  rows: Record<string, unknown>[],
  dataProcessingUtils: DataProcessingUtils,
): Record<string, unknown>[] => {
  const map = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const k = getUploadProfileDedupMapKeyOrRowFallback(row, dataProcessingUtils, i);
    map.set(k, row);
  }
  return Array.from(map.values());
};

export const findExistingCandidateForUpload = (
  lookup: CandidateUploadLookup,
  profile: LooseProfile,
  dataProcessingUtils: DataProcessingUtils,
): unknown | undefined => {
  const p = profile as Record<string, unknown>;
  const { resdexNorm, hiringNorm, linkedinNorm } = extractUploadUrlBucket(profile);
  if (resdexNorm) {
    const c = lookup.byResdexNaukriUrl.get(resdexNorm);
    if (c) {
      return c;
    }
  }
  if (hiringNorm) {
    const c = lookup.byHiringNaukriUrl.get(hiringNorm);
    if (c) {
      return c;
    }
  }
  if (linkedinNorm) {
    const c = lookup.byLinkedinUrl.get(linkedinNorm);
    if (c) {
      return c;
    }
  }

  const phoneRaw = extractPhoneRawForUploadDedup(profile);
  const phoneData = dataProcessingUtils.parsePhoneNumbers(phoneRaw);
  if (phoneData.primaryPhoneNumber && phoneData.primaryPhoneNumber.trim() !== '') {
    const cleaned = dataProcessingUtils.cleanPhoneNumber(phoneData.primaryPhoneNumber);
    if (cleaned) {
      const byPh = lookup.byPhone.get(cleaned);
      if (byPh) {
        return byPh;
      }
    }
  }

  const emailRaw = extractEmailRawForUploadDedup(profile);
  const emailData = dataProcessingUtils.parseEmails(emailRaw);
  if (emailData.primaryEmail && emailData.primaryEmail.trim() !== '') {
    const em = emailData.primaryEmail.toLowerCase().trim();
    const byE = lookup.byEmail.get(em);
    if (byE) {
      return byE;
    }
  }

  const usk = typeof p.uniqueStringKey === 'string' ? p.uniqueStringKey.trim() : '';
  if (usk) {
    return lookup.byUniqueStringKey.get(usk);
  }

  return undefined;
};
