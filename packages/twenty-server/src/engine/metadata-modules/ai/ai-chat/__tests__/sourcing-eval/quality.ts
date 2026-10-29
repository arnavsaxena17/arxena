import {
  type LiveToolConfig,
  fetchTabForQuality,
} from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/live-tools';
import { type ToolCall } from 'src/engine/metadata-modules/ai/ai-chat/__tests__/sourcing-eval/run-scenario';

export type QualityReport = {
  companies: TabSlice;
  people: TabSlice;
  rankedShortlist: RankedPerson[];
  heuristics: {
    peopleCount: number;
    salesRepTitleRate: number;
    mumbaiLocationRate: number;
    fitmentPassCount: number;
    enrichmentKeys: string[];
    enrichmentFillRates: Record<string, number>;
  };
  behaviorNotes: string[];
};

type TabSlice = {
  total?: number;
  summary?: unknown;
  aiColumns?: unknown;
  sampleRows: Record<string, unknown>[];
};

type RankedPerson = {
  id?: string;
  name?: string;
  title?: string;
  companyName?: string;
  location?: string;
  fitmentScore?: number;
  fitmentOutcome?: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};

const asRows = (payload: Record<string, unknown>): Record<string, unknown>[] =>
  Array.isArray(payload.rows)
    ? (payload.rows as Record<string, unknown>[])
    : [];

const textOf = (row: Record<string, unknown>, key: string): string => {
  const direct = row[key];

  if (typeof direct === 'string') {
    return direct;
  }

  const other = asRecord(row.otherFields)[key];

  return typeof other === 'string' ? other : String(direct ?? other ?? '');
};

const numberOf = (
  row: Record<string, unknown>,
  key: string,
): number | undefined => {
  const direct = row[key];

  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return direct;
  }

  const other = asRecord(row.otherFields)[key];

  return typeof other === 'number' && Number.isFinite(other)
    ? other
    : undefined;
};

const SALES_REP_TITLE =
  /\b(sales|medical|territory|field)\b.*\b(rep|representative|executive)\b|\b(medical representative|sales representative|territory sales|field sales)\b/i;
const MUMBAI = /\bmumbai\b|\bbombay\b/i;

const enrichmentKeysFrom = (
  payload: Record<string, unknown>,
  rows: Record<string, unknown>[],
): string[] => {
  const fromMeta = Array.isArray(payload.aiColumns)
    ? (payload.aiColumns as { key?: string }[])
        .map((column) => column.key)
        .filter((key): key is string => typeof key === 'string')
    : [];

  if (fromMeta.length > 0) {
    return fromMeta;
  }

  const keys = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(asRecord(row.otherFields))) {
      if (
        key.startsWith('fitment') ||
        key === 'profile' ||
        key === 'aiColumns'
      ) {
        continue;
      }

      keys.add(key);
    }
  }

  return [...keys].slice(0, 20);
};

const rate = (
  rows: Record<string, unknown>[],
  test: (row: Record<string, unknown>) => boolean,
): number => {
  if (rows.length === 0) {
    return 0;
  }

  return rows.filter(test).length / rows.length;
};

const sliceOf = (payload: Record<string, unknown>): TabSlice => ({
  total: typeof payload.total === 'number' ? payload.total : undefined,
  summary: payload.summaries ?? payload.summary,
  aiColumns: payload.aiColumns,
  sampleRows: asRows(payload).slice(0, 25),
});

export const buildQualityReport = async (
  config: LiveToolConfig,
  calls: ToolCall[],
): Promise<QualityReport> => {
  const companiesPayload = await fetchTabForQuality(config, 'companies');
  const peoplePayload = await fetchTabForQuality(config, 'people');
  const companies = sliceOf(companiesPayload);
  const people = sliceOf(peoplePayload);
  const peopleRows = people.sampleRows;

  const rankedShortlist = [...peopleRows]
    .map((row) => ({
      id: typeof row.id === 'string' ? row.id : undefined,
      name: textOf(row, 'name') || textOf(row, 'fullName') || undefined,
      title: textOf(row, 'title') || undefined,
      companyName: textOf(row, 'companyName') || undefined,
      location: textOf(row, 'location') || undefined,
      fitmentScore: numberOf(row, 'fitmentScore'),
      fitmentOutcome: textOf(row, 'fitmentOutcome') || undefined,
    }))
    .sort(
      (left, right) => (right.fitmentScore ?? -1) - (left.fitmentScore ?? -1),
    )
    .slice(0, 25);

  const enrichmentKeys = [
    ...new Set([
      ...enrichmentKeysFrom(companiesPayload, companies.sampleRows),
      ...enrichmentKeysFrom(peoplePayload, peopleRows),
    ]),
  ];

  const enrichmentFillRates: Record<string, number> = {};

  for (const key of enrichmentKeys) {
    enrichmentFillRates[key] = rate(
      [...companies.sampleRows, ...peopleRows],
      (row) => {
        const value = row[key] ?? asRecord(row.otherFields)[key];

        return value !== undefined && value !== null && value !== '';
      },
    );
  }

  const behaviorNotes: string[] = [];
  const called = new Set(calls.map((call) => call.tool));

  if (calls.some((call) => call.tool === 'find_people_by_company')) {
    behaviorNotes.push(
      'used find_people_by_company (company-first people step)',
    );
  }

  if (
    calls.some(
      (call) =>
        (call.tool === 'preview_ai_column' || call.tool === 'run_ai_column') &&
        call.args.description !== undefined &&
        call.args.fitment === undefined,
    )
  ) {
    behaviorNotes.push(
      'ran a description-based enrichment column (not only fitment)',
    );
  }

  if (
    calls.some(
      (call) =>
        (call.tool === 'preview_ai_column' || call.tool === 'run_ai_column') &&
        call.args.fitment !== undefined,
    )
  ) {
    behaviorNotes.push('ran fitment scoring');
  }

  if (called.has('generate_table_view') || called.has('apply_table_view')) {
    behaviorNotes.push('applied table view for shortlist filter/sort');
  } else {
    behaviorNotes.push(
      'no generate_table_view/apply_table_view — ranking inferred from fitmentScore only',
    );
  }

  return {
    companies,
    people,
    rankedShortlist,
    heuristics: {
      peopleCount: peopleRows.length,
      salesRepTitleRate: rate(peopleRows, (row) =>
        SALES_REP_TITLE.test(textOf(row, 'title')),
      ),
      mumbaiLocationRate: rate(peopleRows, (row) =>
        MUMBAI.test(textOf(row, 'location')),
      ),
      fitmentPassCount: peopleRows.filter(
        (row) => textOf(row, 'fitmentOutcome').toLowerCase() === 'pass',
      ).length,
      enrichmentKeys,
      enrichmentFillRates,
    },
    behaviorNotes,
  };
};

export const renderQualityReport = (report: QualityReport): string => {
  const percent = (value: number) => `${Math.round(value * 100)}%`;

  return [
    '# Live quality report',
    '',
    '## Tab',
    `- Companies total: ${report.companies.total ?? 'unknown'} (sample ${report.companies.sampleRows.length})`,
    `- People total: ${report.people.total ?? 'unknown'} (sample ${report.people.sampleRows.length})`,
    `- Company summary: ${JSON.stringify(report.companies.summary ?? null).slice(0, 400)}`,
    `- People summary: ${JSON.stringify(report.people.summary ?? null).slice(0, 400)}`,
    '',
    '## Heuristics (sample ≤25)',
    `- Sales-rep-ish title rate: ${percent(report.heuristics.salesRepTitleRate)}`,
    `- Mumbai-ish location rate: ${percent(report.heuristics.mumbaiLocationRate)}`,
    `- Fitment pass count: ${report.heuristics.fitmentPassCount}`,
    `- Enrichment keys: ${report.heuristics.enrichmentKeys.join(', ') || 'none'}`,
    ...Object.entries(report.heuristics.enrichmentFillRates).map(
      ([key, value]) => `- Enrichment fill ${key}: ${percent(value)}`,
    ),
    '',
    '## Behavior notes',
    ...report.behaviorNotes.map((line) => `- ${line}`),
    '',
    '## Ranked shortlist (by fitmentScore)',
    ...(report.rankedShortlist.length === 0
      ? ['- none']
      : report.rankedShortlist.map(
          (person, index) =>
            `${index + 1}. score=${person.fitmentScore ?? '—'} outcome=${person.fitmentOutcome ?? '—'} | ${person.name ?? '?'} | ${person.title ?? '?'} @ ${person.companyName ?? '?'} | ${person.location ?? '?'}`,
        )),
    '',
  ].join('\n');
};
