import { atom } from 'recoil';

export type OrgChartContactInfo = {
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  fullName?: string;
  /** Indicates a fetch was attempted (even if empty). */
  fetched?: boolean;
};

/**
 * Session-only cache for org-chart contact enrichment.
 *
 * Key format:
 * - `m7kq:<companyDomain>:<personId>` when `raw.id` + company domain are available
 * - `li:<linkedinUrl>` fallback
 */
export const orgChartContactsByKeyState = atom<Record<string, OrgChartContactInfo>>(
  {
    key: 'orgchart/orgChartContactsByKeyState',
    default: {},
  },
);

