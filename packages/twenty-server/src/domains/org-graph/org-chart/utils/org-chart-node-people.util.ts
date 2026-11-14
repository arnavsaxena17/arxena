import {
  type OrgChartPositionLike,
  type ResolvedOrgChartNode,
  findOrgChartRawNodeByKey,
  parseOrgchartNodes,
  resolveOrgChartNodeFromRaw,
} from './find-org-chart-node-by-key.util';
import { extractLinkedinProfileUrlFromOrgChartCandidateRow } from './orgchart-candidate-linkedin-url.util';

const SUMMARY_MAX_CHARS = 600;

export type OrgChartNodePersonItem = {
  full_name: string;
  job_title: string;
  headline?: string;
  summary?: string;
  linkedin_url?: string;
  location?: string;
};

export type MatchedOrgChartNode = {
  resolved: ResolvedOrgChartNode;
  raw: OrgChartPositionLike;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readTrimmedString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value) && value !== 0) {
    return String(value);
  }

  return '';
};

const matchesLabel = (
  value: string | undefined,
  filter: string | undefined,
): boolean => {
  if (!filter?.trim()) {
    return true;
  }

  if (!value?.trim()) {
    return false;
  }

  return value.trim().toLowerCase() === filter.trim().toLowerCase();
};

const normalizeLinkedinKey = (url: string): string =>
  url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase();

const normalizeNameKey = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const truncateSummary = (value: string): string | undefined => {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length <= SUMMARY_MAX_CHARS) {
    return trimmed;
  }

  return `${trimmed.slice(0, SUMMARY_MAX_CHARS).trim()}…`;
};

export const extractOrgChartNodeCandidateRows = (
  node: OrgChartPositionLike,
): Record<string, unknown>[] => {
  const rawCandidates = node.candidates;

  if (Array.isArray(rawCandidates)) {
    return rawCandidates.filter(isRecord);
  }

  if (isRecord(rawCandidates)) {
    return [rawCandidates];
  }

  const indexedRows: Record<string, unknown>[] = [];

  for (let index = 0; index < 500; index += 1) {
    const fullName = readTrimmedString(node[`name_${index}`]);
    const jobTitle = readTrimmedString(node[`title_${index}`]);
    const linkedinUrl = readTrimmedString(
      node[`url_${index}`] ?? node[`linkedin_url_${index}`],
    );

    if (!fullName && !jobTitle && !linkedinUrl) {
      break;
    }

    indexedRows.push({
      full_name: fullName,
      job_title: jobTitle,
      linkedin_url: linkedinUrl,
    });
  }

  return indexedRows;
};

export const listOrgChartNodesMatching = (
  orgChartData: Record<string, unknown> | null | undefined,
  filters: {
    nodeKey?: number;
    stdFunction?: string;
    stdFunctionRoot?: string;
    stdGrade?: string;
  },
): MatchedOrgChartNode[] => {
  if (typeof filters.nodeKey === 'number' && Number.isFinite(filters.nodeKey)) {
    const rawNode = findOrgChartRawNodeByKey(orgChartData, filters.nodeKey);

    if (!rawNode) {
      return [];
    }

    const resolved = resolveOrgChartNodeFromRaw(rawNode);

    return resolved ? [{ resolved, raw: rawNode }] : [];
  }

  const matches: MatchedOrgChartNode[] = [];

  for (const rawNode of parseOrgchartNodes(orgChartData?.orgchart)) {
    const resolved = resolveOrgChartNodeFromRaw(rawNode);

    if (!resolved) {
      continue;
    }

    if (!matchesLabel(resolved.stdFunction, filters.stdFunction)) {
      continue;
    }

    if (!matchesLabel(resolved.stdFunctionRoot, filters.stdFunctionRoot)) {
      continue;
    }

    if (!matchesLabel(resolved.stdGrade, filters.stdGrade)) {
      continue;
    }

    matches.push({ resolved, raw: rawNode });
  }

  return matches;
};

const readFullName = (row: Record<string, unknown>): string => {
  const direct =
    readTrimmedString(row.full_name) ||
    readTrimmedString(row.fullName) ||
    readTrimmedString(row.name);

  if (direct) {
    return direct;
  }

  return [readTrimmedString(row.firstName), readTrimmedString(row.lastName)]
    .filter((part) => part.length > 0)
    .join(' ');
};

const readJobTitle = (row: Record<string, unknown>): string =>
  readTrimmedString(row.job_title) ||
  readTrimmedString(row.jobTitle) ||
  readTrimmedString(row.title);

const readHeadline = (row: Record<string, unknown>): string =>
  readTrimmedString(row.headline) ||
  readTrimmedString(row.linkedinHeadline) ||
  readTrimmedString(row.linkedin_headline);

const readSummary = (row: Record<string, unknown>): string =>
  readTrimmedString(row.linkedinSummary) ||
  readTrimmedString(row.linkedin_summary) ||
  readTrimmedString(row.summary) ||
  readTrimmedString(row.about);

const readLocation = (row: Record<string, unknown>): string =>
  readTrimmedString(row.location_name) ||
  readTrimmedString(row.locationName) ||
  readTrimmedString(row.location);

const personLookupKeys = (
  row: Record<string, unknown>,
): { linkedinKey?: string; nameKey?: string } => {
  const linkedinUrl =
    extractLinkedinProfileUrlFromOrgChartCandidateRow(row) ||
    readTrimmedString(row.linkedinUrl);
  const fullName = readFullName(row);

  return {
    ...(linkedinUrl ? { linkedinKey: normalizeLinkedinKey(linkedinUrl) } : {}),
    ...(fullName ? { nameKey: normalizeNameKey(fullName) } : {}),
  };
};

const buildStoredPeopleIndex = (
  storedPeople: unknown[] | null | undefined,
): {
  byLinkedin: Map<string, Record<string, unknown>>;
  byName: Map<string, Record<string, unknown>>;
} => {
  const byLinkedin = new Map<string, Record<string, unknown>>();
  const byName = new Map<string, Record<string, unknown>>();

  if (!Array.isArray(storedPeople)) {
    return { byLinkedin, byName };
  }

  for (const row of storedPeople) {
    if (!isRecord(row)) {
      continue;
    }

    const keys = personLookupKeys(row);

    if (keys.linkedinKey && !byLinkedin.has(keys.linkedinKey)) {
      byLinkedin.set(keys.linkedinKey, row);
    }

    if (keys.nameKey && !byName.has(keys.nameKey)) {
      byName.set(keys.nameKey, row);
    }
  }

  return { byLinkedin, byName };
};

const projectPerson = (
  nodePerson: Record<string, unknown>,
  storedPerson?: Record<string, unknown>,
): OrgChartNodePersonItem | null => {
  const merged = storedPerson ? { ...nodePerson, ...storedPerson } : nodePerson;
  const fullName = storedPerson
    ? readFullName(storedPerson) || readFullName(nodePerson)
    : readFullName(merged);
  const jobTitle = storedPerson
    ? readJobTitle(storedPerson) || readJobTitle(nodePerson)
    : readJobTitle(merged);
  const linkedinUrl =
    extractLinkedinProfileUrlFromOrgChartCandidateRow(merged) ||
    readTrimmedString(merged.linkedinUrl);

  if (!fullName && !jobTitle && !linkedinUrl) {
    return null;
  }

  const item: OrgChartNodePersonItem = {
    full_name: fullName,
    job_title: jobTitle,
  };
  const headline = readHeadline(merged);
  const summary = truncateSummary(readSummary(merged));
  const location = readLocation(merged);

  if (headline) {
    item.headline = headline;
  }

  if (summary) {
    item.summary = summary;
  }

  if (linkedinUrl) {
    item.linkedin_url = linkedinUrl;
  }

  if (location) {
    item.location = location;
  }

  return item;
};

const personDedupeKey = (item: OrgChartNodePersonItem): string => {
  if (item.linkedin_url) {
    return `li:${normalizeLinkedinKey(item.linkedin_url)}`;
  }

  return `name:${normalizeNameKey(item.full_name)}|${normalizeNameKey(item.job_title)}`;
};

export const hydrateOrgChartNodePeople = (
  nodePeople: Record<string, unknown>[],
  storedPeople: unknown[] | null | undefined,
  limit?: number,
): OrgChartNodePersonItem[] => {
  const index = buildStoredPeopleIndex(storedPeople);
  const items: OrgChartNodePersonItem[] = [];
  const seen = new Set<string>();

  for (const nodePerson of nodePeople) {
    const keys = personLookupKeys(nodePerson);
    const storedPerson =
      (keys.linkedinKey ? index.byLinkedin.get(keys.linkedinKey) : undefined) ??
      (keys.nameKey ? index.byName.get(keys.nameKey) : undefined);
    const item = projectPerson(nodePerson, storedPerson);

    if (!item) {
      continue;
    }

    const dedupeKey = personDedupeKey(item);

    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    items.push(item);
  }

  if (typeof limit === 'number' && limit >= 0) {
    return items.slice(0, Math.floor(limit));
  }

  return items;
};
