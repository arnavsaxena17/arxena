import type { OrgChartNodeData } from './orgChartDataUtils';

import { isValidLinkedInProfileUrl } from './isValidLinkedInProfileUrl';

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

export const orgChartFirstSlotWithLinkedin = (data: OrgChartNodeData): number => {
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
    const p = data[`phone_${i}` as keyof OrgChartNodeData];
    if (typeof p === 'string' && p.trim().length > 0) {
      return true;
    }
  }
  return false;
};

export const orgChartFirstSlotWithPhone = (data: OrgChartNodeData): number => {
  for (let i = 0; i < 4; i += 1) {
    const p = data[`phone_${i}` as keyof OrgChartNodeData];
    if (typeof p === 'string' && p.trim().length > 0) {
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
    const e = data[`email_${i}` as keyof OrgChartNodeData];
    if (typeof e === 'string' && e.trim().length > 0) {
      return true;
    }
  }
  return false;
};

export const orgChartFirstSlotWithEmail = (data: OrgChartNodeData): number => {
  for (let i = 0; i < 4; i += 1) {
    const e = data[`email_${i}` as keyof OrgChartNodeData];
    if (typeof e === 'string' && e.trim().length > 0) {
      return i;
    }
  }
  return 0;
};

export const orgChartFirstSlotWithPhoneAndEmail = (
  data: OrgChartNodeData,
): number => {
  for (let i = 0; i < 4; i += 1) {
    const p = data[`phone_${i}` as keyof OrgChartNodeData];
    const e = data[`email_${i}` as keyof OrgChartNodeData];
    if (
      typeof p === 'string' &&
      p.trim().length > 0 &&
      typeof e === 'string' &&
      e.trim().length > 0
    ) {
      return i;
    }
  }
  return 0;
};

export const orgChartNodeHasGoogleContactFields = (
  data: OrgChartNodeData | null,
): boolean =>
  orgChartNodeHasOutreachPhone(data) && orgChartNodeHasOutreachEmail(data);

/** Matches GoJS context menu `Binding('visible', …)` for outreach items. */
export const isOutreachLinkedInContextVisible = (
  d: OrgChartNodeData | null,
): boolean =>
  !!d && d.nodeState === 'active' && orgChartNodeHasOutreachLinkedin(d);

export const isOutreachWhatsappContextVisible = (
  d: OrgChartNodeData | null,
): boolean => !!d && d.nodeState === 'active' && orgChartNodeHasOutreachPhone(d);

export const isOutreachGoogleContactContextVisible = (
  d: OrgChartNodeData | null,
): boolean =>
  !!d && d.nodeState === 'active' && orgChartNodeHasGoogleContactFields(d);

export const isOutreachEmailContextVisible = (
  d: OrgChartNodeData | null,
): boolean => !!d && d.nodeState === 'active' && orgChartNodeHasOutreachEmail(d);
