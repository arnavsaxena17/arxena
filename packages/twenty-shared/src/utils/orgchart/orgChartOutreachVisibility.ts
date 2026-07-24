import type { OrgChartNodeData } from './orgChartDataUtils';

import { isValidLinkedInProfileUrl } from './isValidLinkedInProfileUrl';

const readBool = (data: OrgChartNodeData, key: string): boolean | undefined => {
  const v = (data as Record<string, unknown>)[key];
  return typeof v === 'boolean' ? v : undefined;
};

/**
 * True when this slot can be used for email outreach: value on file, or
 * M7kq directory says email can be fetched (`has_email_i === true`).
 */
export const orgChartSlotHasEmailForOutreach = (
  data: OrgChartNodeData,
  i: number,
): boolean => {
  const e = data[`email_${i}` as keyof OrgChartNodeData];
  if (typeof e === 'string' && e.trim().length > 0) {
    return true;
  }
  return readBool(data, `has_email_${i}`) === true;
};

/**
 * True when this slot can be used for phone/WhatsApp: value on file, or
 * M7kq directory indicates direct/org phone may exist (fetch from node or API).
 * Explicit `false` for both has_* means no phone in directory.
 */
export const orgChartSlotHasPhoneForOutreach = (
  data: OrgChartNodeData,
  i: number,
): boolean => {
  const p = data[`phone_${i}` as keyof OrgChartNodeData];
  if (typeof p === 'string' && p.trim().length > 0) {
    return true;
  }
  const none =
    readBool(data, `has_direct_phone_${i}`) === false &&
    readBool(data, `has_org_phone_${i}`) === false;
  if (none) {
    return false;
  }
  return (
    readBool(data, `has_direct_phone_${i}`) === true ||
    readBool(data, `has_org_phone_${i}`) === true
  );
};

export const orgChartNodeHasOutreachLinkedin = (
  data: OrgChartNodeData | null,
): boolean => {
  if (!data) return false;
  for (let i = 0; i < 4; i += 1) {
    const u = data[`linkedin_url_${i}` as keyof OrgChartNodeData];
    if (typeof u === 'string' && isValidLinkedInProfileUrl(u)) {
      return true;
    }
  }
  return false;
};

export const orgChartFirstSlotWithLinkedin = (
  data: OrgChartNodeData,
): number => {
  for (let i = 0; i < 4; i += 1) {
    const u = data[`linkedin_url_${i}` as keyof OrgChartNodeData];
    if (typeof u === 'string' && isValidLinkedInProfileUrl(u)) {
      return i;
    }
  }
  return 0;
};

export const orgChartNodeHasOutreachPhone = (
  data: OrgChartNodeData | null,
): boolean => {
  if (!data) return false;
  for (let i = 0; i < 4; i += 1) {
    if (orgChartSlotHasPhoneForOutreach(data, i)) {
      return true;
    }
  }
  return false;
};

export const orgChartFirstSlotWithPhone = (data: OrgChartNodeData): number => {
  for (let i = 0; i < 4; i += 1) {
    if (orgChartSlotHasPhoneForOutreach(data, i)) {
      return i;
    }
  }
  return 0;
};

export const orgChartNodeHasOutreachEmail = (
  data: OrgChartNodeData | null,
): boolean => {
  if (!data) return false;
  for (let i = 0; i < 4; i += 1) {
    if (orgChartSlotHasEmailForOutreach(data, i)) {
      return true;
    }
  }
  return false;
};

export const orgChartFirstSlotWithEmail = (data: OrgChartNodeData): number => {
  for (let i = 0; i < 4; i += 1) {
    if (orgChartSlotHasEmailForOutreach(data, i)) {
      return i;
    }
  }
  return 0;
};

export const orgChartFirstSlotWithPhoneAndEmail = (
  data: OrgChartNodeData,
): number => {
  for (let i = 0; i < 4; i += 1) {
    if (
      orgChartSlotHasPhoneForOutreach(data, i) &&
      orgChartSlotHasEmailForOutreach(data, i)
    ) {
      return i;
    }
  }
  return 0;
};

export const orgChartNodeHasGoogleContactFields = (
  data: OrgChartNodeData | null,
): boolean => {
  if (!data) return false;
  for (let i = 0; i < 4; i += 1) {
    if (
      orgChartSlotHasPhoneForOutreach(data, i) &&
      orgChartSlotHasEmailForOutreach(data, i)
    ) {
      return true;
    }
  }
  return false;
};

/** Matches GoJS context menu `Binding('visible', …)` for outreach items. */
export const isOutreachLinkedInContextVisible = (
  d: OrgChartNodeData | null,
): boolean =>
  !!d && d.nodeState === 'active' && orgChartNodeHasOutreachLinkedin(d);

export const isOutreachWhatsappContextVisible = (
  d: OrgChartNodeData | null,
): boolean =>
  !!d && d.nodeState === 'active' && orgChartNodeHasOutreachPhone(d);

export const isOutreachGoogleContactContextVisible = (
  d: OrgChartNodeData | null,
): boolean =>
  !!d && d.nodeState === 'active' && orgChartNodeHasGoogleContactFields(d);

export const isOutreachEmailContextVisible = (
  d: OrgChartNodeData | null,
): boolean =>
  !!d && d.nodeState === 'active' && orgChartNodeHasOutreachEmail(d);
