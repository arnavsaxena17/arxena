import {
  type SourceAdapter,
  type SourceSearchResult,
  type SourceSpec,
  roundUsd,
} from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import {
  HARVEST_COST_PER_RECORD_USD,
  splitHarvestTitleList,
} from 'src/domains/org-graph/org-chart/utils/harvest-search-params.util';

// Adapters that search through the existing search tools. A search tool
// already normalises its rows, writes them to the project tab and records the
// search in the ledger, so the adapter's whole job is to say the spec in the
// tool's arguments and read the counts back.

// Runs one search tool against the run's project and returns what the tool
// provider reports once the rows are on the tab
export type RunSearchTool = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

const INDEX_MAX_PAGE_SIZE = 100;

const numberAt = (
  record: Record<string, unknown>,
  key: string,
): number | undefined => {
  const value = record[key];

  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

const pagingOf = (result: Record<string, unknown>): Record<string, unknown> =>
  typeof result.paging === 'object' && result.paging !== null
    ? (result.paging as Record<string, unknown>)
    : {};

const stringsAt = (record: Record<string, unknown>, key: string): string[] => {
  const value = record[key];

  return Array.isArray(value)
    ? value.filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim() !== '',
      )
    : [];
};

const stringAt = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = record[key];

  return typeof value === 'string' && value.trim() !== ''
    ? value.trim()
    : undefined;
};

// The tool provider answers a search with counts; a refusal comes back as an
// error string on the same object
const readCounts = (
  result: Record<string, unknown>,
): Pick<SourceSearchResult, 'fetched' | 'newUnique'> => {
  if (typeof result.error === 'string' && result.error !== '') {
    throw new Error(result.error);
  }

  const fetched = numberAt(result, 'fetched');

  if (fetched === undefined) {
    throw new Error('The search tool did not report how many rows it fetched');
  }

  return { fetched, newUnique: numberAt(result, 'newUnique') ?? 0 };
};

// The Arxena people index: free, filtered on facets, paged by offset
export const createIndexAdapter = (runTool: RunSearchTool): SourceAdapter => ({
  rejects: (spec: SourceSpec): string | undefined =>
    spec.kind === 'facets' && stringsAt(spec.filters, 'companies').length > 1
      ? 'it filters on one company per search'
      : undefined,
  search: async (spec, { cursor, pageSize }) => {
    if (spec.kind !== 'facets') {
      throw new Error('The index adapter takes a facets spec');
    }

    const limit = Math.min(pageSize, INDEX_MAX_PAGE_SIZE);
    const offset = cursor === undefined ? 0 : Number(cursor);
    // The index has no city filter; a place goes in the free-text query,
    // which searches country too
    const query = [
      stringAt(spec.filters, 'keywords'),
      ...stringsAt(spec.filters, 'locations'),
    ]
      .filter((part): part is string => part !== undefined)
      .join(' ');
    const jobTitle = stringAt(spec.filters, 'jobTitle');
    const [companyName] = stringsAt(spec.filters, 'companies');
    const result = await runTool('search_people_index', {
      ...(query !== '' && { query }),
      ...(jobTitle !== undefined && { jobTitle }),
      ...(companyName !== undefined && { companyName }),
      limit,
      offset,
    });
    const counts = readCounts(result);
    const total =
      numberAt(pagingOf(result), 'total') ??
      numberAt(pagingOf(result), 'total_count');

    return {
      ...counts,
      costUsd: 0,
      ...(total !== undefined && { counts: total }),
      // A full page is the only sign the index has more
      ...(counts.fetched >= limit && { nextCursor: String(offset + limit) }),
    };
  },
});

const harvestParameters = (
  spec: Extract<SourceSpec, { kind: 'boolean' }>,
): Record<string, unknown> => {
  const title = stringAt(spec.facets, 'jobTitle');
  // A plain OR list is a title filter; anything factored only `search` reads
  const titleList = title === undefined ? null : splitHarvestTitleList(title);
  const search = [
    spec.query.trim(),
    title !== undefined && titleList === null ? title : '',
  ]
    .filter((part) => part !== '')
    .map((part, _index, parts) => (parts.length > 1 ? `(${part})` : part))
    .join(' AND ');
  const locations = stringsAt(spec.facets, 'locations');

  return {
    ...(search !== '' && { search }),
    ...(titleList !== null &&
      titleList.length > 0 && { currentJobTitles: titleList }),
    ...(locations.length > 0 && { locations }),
  };
};

// Harvest: Sales Navigator lead search on Harvest's accounts, billed per row
export const createHarvestAdapter = (
  runTool: RunSearchTool,
): SourceAdapter => ({
  rejects: (spec: SourceSpec): string | undefined => {
    if (spec.kind !== 'boolean') {
      return undefined;
    }

    if (stringsAt(spec.facets, 'companies').length > 0) {
      return 'it filters employers by LinkedIn company URL, not by name';
    }

    // An empty filter set would page through LinkedIn at our cost
    return Object.keys(harvestParameters(spec)).length === 0
      ? 'the query has nothing Harvest can filter on'
      : undefined;
  },
  search: async (spec, { cursor, pageSize }) => {
    if (spec.kind !== 'boolean') {
      throw new Error('The Harvest adapter takes a boolean spec');
    }

    const result = await runTool('search_harvest_leads', {
      searchParameters: harvestParameters(spec),
      page: cursor === undefined ? 1 : Number(cursor),
      limit: pageSize,
    });
    const counts = readCounts(result);
    const paging = pagingOf(result);
    const nextPage = numberAt(paging, 'nextPage');
    const total = numberAt(paging, 'totalElements');

    return {
      ...counts,
      costUsd:
        numberAt(result, 'costUsd') ??
        roundUsd(counts.fetched * HARVEST_COST_PER_RECORD_USD),
      ...(total !== undefined && { counts: total }),
      ...(nextPage !== undefined && { nextCursor: String(nextPage) }),
    };
  },
});
