import { type OrgChartData, type RawOrgNode } from 'twenty-shared';

/**
 * Opaque public slug for Apollo in org-chart nodes (`ds_*`). Must match
 * {@link OrgChartProfileDataSourceMapperService} (apollo / apollo_io → m7kq).
 */
export const ORGCHART_DATA_SOURCE_SLUG_APOLLO = 'm7kq';

/**
 * JSON field names for contact hints on search/API rows (opaque slug, no provider name).
 * Example: m7kqHasEmail, m7kqHasDirectPhone, m7kqHasOrgPhone.
 */
export function orgChartProviderContactHintRowKeys(
  providerPublicSlug: string,
): {
  hasEmail: string;
  hasDirectPhone: string;
  hasOrgPhone: string;
} {
  const s = providerPublicSlug.trim();
  return {
    hasEmail: `${s}HasEmail`,
    hasDirectPhone: `${s}HasDirectPhone`,
    hasOrgPhone: `${s}HasOrgPhone`,
  };
}

/**
 * Read opaque provider contact hints from a transformed search row.
 * Accepts current keys (`m7kqHasEmail`, …) and legacy `apolloHas*` for older cached payloads.
 */
export function readProviderContactHintsFromSearchRow(
  raw: Record<string, unknown>,
  providerPublicSlug: string,
): OrgChartNodeContactAvailability {
  const k = orgChartProviderContactHintRowKeys(providerPublicSlug);
  const readBool = (primary: string, legacy: string): boolean | undefined => {
    const a = raw[primary];
    if (typeof a === 'boolean') {
      return a;
    }
    const b = raw[legacy];
    if (typeof b === 'boolean') {
      return b;
    }
    return undefined;
  };
  return {
    hasEmail: readBool(k.hasEmail, 'apolloHasEmail'),
    hasDirectPhone: readBool(k.hasDirectPhone, 'apolloHasDirectPhone'),
    hasOrgPhone: readBool(k.hasOrgPhone, 'apolloHasOrgPhone'),
  };
}

/** Align with matching logic in org-chart build (trim, lowercase, no trailing slash). */
export function normalizeOrgChartLinkedinUrlKey(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

/** Per chart slot; written to nodes as has_email_i / has_direct_phone_i / has_org_phone_i. */
export type OrgChartNodeContactAvailability = {
  hasEmail?: boolean;
  hasDirectPhone?: boolean;
  hasOrgPhone?: boolean;
};

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

const MAX_SLOT_INDEX = 48;

/**
 * A person "slot" may have no LinkedIn URL (e.g. Apollo + LinkedIn search results)
 * but still show a name. Those rows never enter `urlToSlug`, so `ds_i` must be
 * back-filled and the slot must be counted for {@link applyApolloOnlyNodeLockState}.
 */
function orgChartIndexShowsPersonWithEmptyOrMissingUrl(
  node: Record<string, unknown>,
  index: number,
): boolean {
  const nameKey = `name_${index}`;
  const nameVal = node[nameKey];
  if (typeof nameVal === 'string' && nameVal.trim().length > 0) {
    return true;
  }
  const cands = node.candidates;
  if (Array.isArray(cands) && cands[index]) {
    const c = cands[index] as Record<string, unknown>;
    const fn = c.full_name ?? c.fullName;
    if (typeof fn === 'string' && fn.trim().length > 0) {
      return true;
    }
    if (typeof c.id === 'string' && c.id.trim().length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Python may omit `linkedin_url_i` entirely when the URL is empty; older code
 * treated "key missing" as "no more slots" and exited at i=0, skipping backfill
 * and lock. Only stop the slot sequence when the URL key is absent *and* there
 * is no `name_i` / `candidates[i]` person at this index.
 */
function shouldEndOrgChartSlotsAtIndex(
  node: Record<string, unknown>,
  index: number,
): boolean {
  const urlKey = `linkedin_url_${index}`;
  if (urlKey in node) {
    return false;
  }
  return !orgChartIndexShowsPersonWithEmptyOrMissingUrl(node, index);
}

/**
 * Org charts built only from Apollo candidates: set every person slot's
 * `ds_i` to the Apollo public slug (e.g. `m7kq`) without using LinkedIn URL as a
 * join key. Runs before contact-hint merges and {@link applyApolloOnlyNodeLockState}.
 */
export function assignApolloPublicSlugToAllPersonSlots(
  orgData: OrgChartData,
  apolloPublicSlug: string,
): OrgChartData {
  if (apolloPublicSlug.trim().length === 0) {
    return orgData;
  }

  const nodes = parseOrgchartNodeArray(orgData.orgchart);
  if (!nodes || nodes.length === 0) {
    return orgData;
  }

  const outNodes = nodes.map((node) => {
    const n = node as Record<string, unknown>;
    const next: Record<string, unknown> = { ...n };
    let changed = false;
    for (let i = 0; i < MAX_SLOT_INDEX; i += 1) {
      if (shouldEndOrgChartSlotsAtIndex(n, i)) {
        break;
      }
      const urlKey = `linkedin_url_${i}`;
      const rawUrl = n[urlKey];
      const hasUrl = typeof rawUrl === 'string' && rawUrl.trim().length > 0;
      if (!hasUrl && !orgChartIndexShowsPersonWithEmptyOrMissingUrl(n, i)) {
        continue;
      }
      const dsKey = `ds_${i}` as const;
      if (next[dsKey] === apolloPublicSlug) {
        continue;
      }
      next[dsKey] = apolloPublicSlug;
      changed = true;
    }
    return changed ? (next as RawOrgNode) : node;
  });

  return {
    ...orgData,
    orgchart: outNodes,
  };
}

/**
 * After Python org-chart layout, attach per-person opaque slugs on each node as
 * `ds_0`, `ds_1`, … by matching `linkedin_url_*` to the pre-layout URL→slug map.
 */
export function mergeProfileSourceSlugsOntoOrgChartData(
  orgData: OrgChartData,
  urlToSlug: ReadonlyMap<string, string>,
): OrgChartData {
  if (urlToSlug.size === 0) {
    return orgData;
  }

  const nodes = parseOrgchartNodeArray(orgData.orgchart);
  if (!nodes || nodes.length === 0) {
    return orgData;
  }

  const merged = nodes.map((node): RawOrgNode => {
    const out: RawOrgNode = { ...node };
    for (let i = 0; i < MAX_SLOT_INDEX; i += 1) {
      const urlKey = `linkedin_url_${i}`;
      if (!(urlKey in out)) {
        break;
      }
      const rawUrl = out[urlKey];
      if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
        continue;
      }
      const slug = urlToSlug.get(normalizeOrgChartLinkedinUrlKey(rawUrl));
      if (slug) {
        out[`ds_${i}`] = slug;
      }
    }
    return out;
  });

  return {
    ...orgData,
    orgchart: merged,
  };
}

/**
 * Merge Apollo (or other) contact-hint flags onto org chart nodes by LinkedIn URL slot.
 */
export function mergeContactAvailabilityOntoOrgChartData(
  orgData: OrgChartData,
  urlToContact: ReadonlyMap<string, OrgChartNodeContactAvailability>,
): OrgChartData {
  if (urlToContact.size === 0) {
    return orgData;
  }

  const nodes = parseOrgchartNodeArray(orgData.orgchart);
  if (!nodes || nodes.length === 0) {
    return orgData;
  }

  const merged = nodes.map((node): RawOrgNode => {
    const out: RawOrgNode = { ...node };
    for (let i = 0; i < MAX_SLOT_INDEX; i += 1) {
      const urlKey = `linkedin_url_${i}`;
      if (!(urlKey in out)) {
        break;
      }
      const rawUrl = out[urlKey];
      if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
        continue;
      }
      const slot = urlToContact.get(
        normalizeOrgChartLinkedinUrlKey(rawUrl),
      );
      if (!slot) {
        continue;
      }
      if (typeof slot.hasEmail === 'boolean') {
        out[`has_email_${i}`] = slot.hasEmail;
      }
      if (typeof slot.hasDirectPhone === 'boolean') {
        out[`has_direct_phone_${i}`] = slot.hasDirectPhone;
      }
      if (typeof slot.hasOrgPhone === 'boolean') {
        out[`has_org_phone_${i}`] = slot.hasOrgPhone;
      }
    }
    return out;
  });

  return {
    ...orgData,
    orgchart: merged,
  };
}

function candidatePersonIdFromSlot(c: unknown): string {
  if (!c || typeof c !== 'object') {
    return '';
  }
  const r = c as Record<string, unknown>;
  const id = r.id;
  if (typeof id === 'string') {
    return id.trim();
  }
  if (typeof id === 'number') {
    return String(id);
  }
  return '';
}

/**
 * When `linkedin_url_*` is empty, {@link mergeContactAvailabilityOntoOrgChartData} cannot
 * attach hints. Python org nodes still include `candidates[]` with person `id` — merge
 * `has_email_*` / phone flags by that id using a map built from the same search rows.
 */
export function mergeContactAvailabilityOntoOrgChartDataByPersonId(
  orgData: OrgChartData,
  personIdToContact: ReadonlyMap<string, OrgChartNodeContactAvailability>,
): OrgChartData {
  if (personIdToContact.size === 0) {
    return orgData;
  }

  const nodes = parseOrgchartNodeArray(orgData.orgchart);
  if (!nodes || nodes.length === 0) {
    return orgData;
  }

  const merged = nodes.map((node): RawOrgNode => {
    const out: RawOrgNode = { ...node };
    const rawCandidates = (out as Record<string, unknown>).candidates;
    const list = Array.isArray(rawCandidates) ? rawCandidates : null;
    if (!list || list.length === 0) {
      return out;
    }

    for (let i = 0; i < MAX_SLOT_INDEX && i < list.length; i += 1) {
      const pid = candidatePersonIdFromSlot(list[i]);
      if (!pid) {
        continue;
      }
      const slot = personIdToContact.get(pid);
      if (!slot) {
        continue;
      }
      const emailKey = `has_email_${i}` as const;
      const dphKey = `has_direct_phone_${i}` as const;
      const ophKey = `has_org_phone_${i}` as const;
      if (
        typeof out[emailKey] !== 'boolean' &&
        typeof slot.hasEmail === 'boolean'
      ) {
        (out as Record<string, boolean>)[emailKey] = slot.hasEmail;
      }
      if (
        typeof out[dphKey] !== 'boolean' &&
        typeof slot.hasDirectPhone === 'boolean'
      ) {
        (out as Record<string, boolean>)[dphKey] = slot.hasDirectPhone;
      }
      if (
        typeof out[ophKey] !== 'boolean' &&
        typeof slot.hasOrgPhone === 'boolean'
      ) {
        (out as Record<string, boolean>)[ophKey] = slot.hasOrgPhone;
      }
    }
    return out;
  });

  return {
    ...orgData,
    orgchart: merged,
  };
}

/**
 * For Apollo-only org chart builds: Python `linkedin_url_*` values may not match
 * {@link normalizeOrgChartLinkedinUrlKey} keys in the search `urlToSlug` map, leaving
 * `ds_*` unset. Without a slug, {@link applyApolloOnlyNodeLockState} cannot mark nodes
 * locked. This fills missing `ds_i` for any non-empty `linkedin_url_i` with the
 * Apollo public slug (only when `ds_i` is absent — never overwrites a different source).
 * Also back-fills `ds_i` when `linkedin_url_i` is empty but `name_i` (or
 * `candidates[i]`) still identifies a person — common when Apollo has no public URL.
 */
export function backfillUnmappedLinkedInSlotsWithApolloSlug(
  orgData: OrgChartData,
  apolloPublicSlug: string,
): OrgChartData {
  if (apolloPublicSlug.trim().length === 0) {
    return orgData;
  }

  const nodes = parseOrgchartNodeArray(orgData.orgchart);
  if (!nodes || nodes.length === 0) {
    return orgData;
  }

  const outNodes = nodes.map((node) => {
    const n = node as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = { ...n };
    for (let i = 0; i < MAX_SLOT_INDEX; i += 1) {
      if (shouldEndOrgChartSlotsAtIndex(n, i)) {
        break;
      }
      const urlKey = `linkedin_url_${i}`;
      const rawUrl = n[urlKey];
      const hasUrl = typeof rawUrl === 'string' && rawUrl.trim().length > 0;
      if (!hasUrl) {
        if (!orgChartIndexShowsPersonWithEmptyOrMissingUrl(n, i)) {
          continue;
        }
      }
      const dsKey = `ds_${i}` as const;
      const existing = n[dsKey];
      if (typeof existing === 'string' && existing.trim().length > 0) {
        continue;
      }
      next[dsKey] = apolloPublicSlug;
      changed = true;
    }
    return changed ? (next as RawOrgNode) : node;
  });

  return {
    ...orgData,
    orgchart: outNodes,
  };
}

/**
 * When every person slot on a node is tagged with the Apollo public slug, set
 * `nodeState: 'lock'` so the UI can show "Locked" and paid-plan messaging
 * (not Active / Preview).
 */
export function applyApolloOnlyNodeLockState(
  orgData: OrgChartData,
  apolloPublicSlug: string,
): OrgChartData {
  if (apolloPublicSlug.trim().length === 0) {
    return orgData;
  }

  const nodes = parseOrgchartNodeArray(orgData.orgchart);
  if (!nodes || nodes.length === 0) {
    return orgData;
  }

  const collectPersonSlotKeysForNode = (
    nodeRecord: Record<string, unknown>,
  ): { dsKey: `ds_${number}` }[] => {
    const slotKeys: { dsKey: `ds_${number}` }[] = [];
    for (let i = 0; i < MAX_SLOT_INDEX; i += 1) {
      if (shouldEndOrgChartSlotsAtIndex(nodeRecord, i)) {
        break;
      }
      const urlKey = `linkedin_url_${i}`;
      const rawUrl = nodeRecord[urlKey];
      const hasUrl = typeof rawUrl === 'string' && rawUrl.trim().length > 0;
      if (hasUrl || orgChartIndexShowsPersonWithEmptyOrMissingUrl(nodeRecord, i)) {
        slotKeys.push({ dsKey: `ds_${i}` as const });
      }
    }
    return slotKeys;
  };

  const outNodes = nodes.map((node) => {
    const slotKeys = collectPersonSlotKeysForNode(node as Record<string, unknown>);
    if (slotKeys.length === 0) {
      return node;
    }
    const allSlotsAreApollo = slotKeys.every((sk) => {
      const ds = (node as Record<string, unknown>)[sk.dsKey];
      return typeof ds === 'string' && ds === apolloPublicSlug;
    });
    if (!allSlotsAreApollo) {
      return node;
    }
    return { ...node, nodeState: 'lock' } as RawOrgNode;
  });

  return {
    ...orgData,
    orgchart: outNodes,
  };
}
