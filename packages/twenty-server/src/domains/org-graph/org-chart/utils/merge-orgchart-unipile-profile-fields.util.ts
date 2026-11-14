import type { OrgChartData, RawOrgNode } from 'twenty-shared';

import { normalizeOrgChartLinkedinUrlKey } from './merge-orgchart-profile-source-slugs.util';

export type OrgChartUnipileProfileFields = {
  network_distance?: string;
  shared_connections_count?: number;
  premium?: boolean;
  verified?: boolean;
  open_profile?: boolean;
  followers_count?: number;
  connections_count?: number;
  location_name?: string;
  location_country?: string;
  location_region?: string;
};

const PROFILE_FIELD_KEYS: Array<keyof OrgChartUnipileProfileFields> = [
  'network_distance',
  'shared_connections_count',
  'premium',
  'verified',
  'open_profile',
  'followers_count',
  'connections_count',
  'location_name',
  'location_country',
  'location_region',
];

const readOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const readOptionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  return undefined;
};

/**
 * Extract Unipile / LinkedIn search profile fields from a transformed candidate row.
 */
export const extractUnipileProfileFieldsFromSearchRow = (
  raw: Record<string, unknown>,
): OrgChartUnipileProfileFields => {
  const linkedinSpecific =
    raw.linkedinSpecificData && typeof raw.linkedinSpecificData === 'object'
      ? (raw.linkedinSpecificData as Record<string, unknown>)
      : undefined;

  const networkDistance =
    readOptionalString(raw.networkDistance) ??
    readOptionalString(raw.network_distance) ??
    readOptionalString(linkedinSpecific?.networkDistance);

  const locationName =
    readOptionalString(raw.location_name) ??
    readOptionalString(raw.locationName) ??
    (typeof raw.location === 'string'
      ? readOptionalString(raw.location)
      : undefined);

  const locationCountry =
    readOptionalString(raw.location_country) ??
    readOptionalString(raw.locationCountry) ??
    readOptionalString(raw.country);

  const locationRegion =
    readOptionalString(raw.location_region) ??
    readOptionalString(raw.locationRegion);

  const fields: OrgChartUnipileProfileFields = {};
  if (networkDistance && networkDistance !== 'UNKNOWN') {
    fields.network_distance = networkDistance;
  }
  const shared = readOptionalNumber(
    raw.sharedConnectionsCount ?? raw.shared_connections_count,
  );
  if (shared !== undefined) {
    fields.shared_connections_count = shared;
  }
  const premium = readOptionalBoolean(raw.premium);
  if (premium !== undefined) {
    fields.premium = premium;
  }
  const verified = readOptionalBoolean(raw.verified);
  if (verified !== undefined) {
    fields.verified = verified;
  }
  const openProfile = readOptionalBoolean(
    raw.openProfile ?? raw.open_profile ?? linkedinSpecific?.isOpenProfile,
  );
  if (openProfile !== undefined) {
    fields.open_profile = openProfile;
  }
  const followers = readOptionalNumber(
    raw.followersCount ?? raw.followers_count,
  );
  if (followers !== undefined) {
    fields.followers_count = followers;
  }
  const connections = readOptionalNumber(
    raw.connectionsCount ?? raw.connections_count,
  );
  if (connections !== undefined) {
    fields.connections_count = connections;
  }
  if (locationName) {
    fields.location_name = locationName;
  }
  if (locationCountry) {
    fields.location_country = locationCountry;
  }
  if (locationRegion) {
    fields.location_region = locationRegion;
  }
  return fields;
};

const hasAnyProfileField = (fields: OrgChartUnipileProfileFields): boolean =>
  PROFILE_FIELD_KEYS.some((key) => fields[key] !== undefined);

const mergeFieldsOntoRow = (
  row: Record<string, unknown>,
  fields: OrgChartUnipileProfileFields,
): Record<string, unknown> => {
  const next = { ...row };
  for (const key of PROFILE_FIELD_KEYS) {
    const value = fields[key];
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next;
};

const parseOrgchartNodeArray = (
  orgchart: OrgChartData['orgchart'],
): RawOrgNode[] | null => {
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
};

const lookupFields = (
  byUrl: ReadonlyMap<string, OrgChartUnipileProfileFields>,
  byId: ReadonlyMap<string, OrgChartUnipileProfileFields>,
  linkedinUrlRaw: unknown,
  personIdRaw: unknown,
): OrgChartUnipileProfileFields | undefined => {
  if (typeof linkedinUrlRaw === 'string' && linkedinUrlRaw.trim().length > 0) {
    const fromUrl = byUrl.get(
      normalizeOrgChartLinkedinUrlKey(linkedinUrlRaw.trim()),
    );
    if (fromUrl && hasAnyProfileField(fromUrl)) {
      return fromUrl;
    }
  }
  if (typeof personIdRaw === 'string' && personIdRaw.trim().length > 0) {
    const fromId = byId.get(personIdRaw.trim());
    if (fromId && hasAnyProfileField(fromId)) {
      return fromId;
    }
  }
  if (
    (typeof personIdRaw === 'number' || typeof personIdRaw === 'string') &&
    String(personIdRaw).trim().length > 0
  ) {
    const fromId = byId.get(String(personIdRaw).trim());
    if (fromId && hasAnyProfileField(fromId)) {
      return fromId;
    }
  }
  return undefined;
};

/**
 * After Python layout (which drops Unipile-only columns), re-attach profile
 * enrichment fields onto node candidates by LinkedIn URL / person id.
 */
export const mergeOrgChartUnipileProfileFieldsOntoOrgChartData = (
  orgData: OrgChartData,
  byUrl: ReadonlyMap<string, OrgChartUnipileProfileFields>,
  byId: ReadonlyMap<string, OrgChartUnipileProfileFields>,
): OrgChartData => {
  if (byUrl.size === 0 && byId.size === 0) {
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
    if (!list || list.length === 0) {
      return out as RawOrgNode;
    }

    out.candidates = list.map((c) => {
      if (!c || typeof c !== 'object') {
        return c;
      }
      const row = c as Record<string, unknown>;
      const url = row.std_linkedin_url ?? row.linkedin_url ?? row.linkedinUrl;
      const fields = lookupFields(byUrl, byId, url, row.id);
      if (!fields) {
        return c;
      }
      return mergeFieldsOntoRow(row, fields);
    });

    return out as RawOrgNode;
  });

  return {
    ...orgData,
    orgchart: merged,
  };
};
