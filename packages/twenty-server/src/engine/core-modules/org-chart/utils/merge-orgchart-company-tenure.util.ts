import type { OrgChartData, RawOrgNode } from 'twenty-shared';

import { normalizeOrgChartLinkedinUrlKey } from './merge-orgchart-profile-source-slugs.util';

const MAX_SLOT_INDEX = 48;

function parseOrgchartNodeArray(
  orgchart: OrgChartData['orgchart'],
): RawOrgNode[] | null {
  if (Array.isArray(orgchart)) {
    return orgchart;
  }
  if (typeof orgchart === 'string') {
    try {
      const parsed = JSON.parse(orgchart) as unknown;
      return Array.isArray(parsed) ? (parsed as RawOrgNode[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function tenureFromMaps(
  tenureByUrl: ReadonlyMap<string, 'current' | 'past'>,
  tenureById: ReadonlyMap<string, 'current' | 'past'>,
  linkedinUrlRaw: unknown,
  personIdRaw: unknown,
): 'current' | 'past' | undefined {
  if (typeof linkedinUrlRaw === 'string' && linkedinUrlRaw.trim().length > 0) {
    const t = tenureByUrl.get(
      normalizeOrgChartLinkedinUrlKey(linkedinUrlRaw.trim()),
    );
    if (t) return t;
  }
  if (typeof personIdRaw === 'string' && personIdRaw.trim().length > 0) {
    const t = tenureById.get(personIdRaw.trim());
    if (t) return t;
  }
  return undefined;
}

/**
 * After Python layout, attach whether each slot is a current vs past employee at the
 * chart company (derived from ContactOut/Apify experience on the search row).
 */
export function mergeOrgChartCompanyTenureOntoOrgChartData(
  orgData: OrgChartData,
  tenureByUrl: ReadonlyMap<string, 'current' | 'past'>,
  tenureById: ReadonlyMap<string, 'current' | 'past'>,
): OrgChartData {
  if (tenureByUrl.size === 0 && tenureById.size === 0) {
    return orgData;
  }

  const nodes = parseOrgchartNodeArray(orgData.orgchart);
  if (!nodes || nodes.length === 0) {
    return orgData;
  }

  const merged = nodes.map((node): RawOrgNode => {
    const out = { ...node } as Record<string, unknown>;
    const rawCandidates = out.candidates;
    const list = Array.isArray(rawCandidates) ? rawCandidates : null;

    for (let i = 0; i < MAX_SLOT_INDEX; i += 1) {
      const linkedInSlot =
        out[`linkedin_url_${i}`] ?? out[`url_${i}`];
      const cand = list?.[i];
      const candObj =
        cand && typeof cand === 'object'
          ? (cand as Record<string, unknown>)
          : undefined;
      const urlForLookup =
        typeof linkedInSlot === 'string' && linkedInSlot.trim().length > 0
          ? linkedInSlot
          : candObj?.std_linkedin_url ??
            candObj?.linkedin_url ??
            candObj?.linkedinUrl;
      const pidRaw = candObj?.id;
      const pid =
        typeof pidRaw === 'string' || typeof pidRaw === 'number'
          ? String(pidRaw)
          : undefined;
      const t = tenureFromMaps(tenureByUrl, tenureById, urlForLookup, pid);
      if (t) {
        out[`org_chart_company_tenure_${i}`] = t;
      }
      const hasSlot =
        `linkedin_url_${i}` in out ||
        `url_${i}` in out ||
        (candObj !== undefined && candObj !== null);
      if (!hasSlot) {
        break;
      }
    }

    if (list && list.length > 0) {
      out.candidates = list.map((c) => {
        if (!c || typeof c !== 'object') return c;
        const row = c as Record<string, unknown>;
        const u = row.std_linkedin_url ?? row.linkedin_url ?? row.linkedinUrl;
        const tenure = tenureFromMaps(tenureByUrl, tenureById, u, row.id);
        if (!tenure) return c;
        return { ...row, org_chart_company_tenure: tenure };
      });
    }

    return out as RawOrgNode;
  });

  return {
    ...orgData,
    orgchart: merged,
  };
}
