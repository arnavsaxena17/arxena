import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { randomUUID } from 'crypto';

import { isDefined } from 'twenty-shared/utils';

import {
  labelWebSearchEngine,
  type WebSearchProviderId,
} from 'src/engine/core-modules/arx-web-search/utils/web-search-provider-chain.util';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import {
  type FilterFieldSpec,
  type FilterSpec,
} from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-contract';
import { AiFilterEngineService } from 'src/engine/core-modules/candidate-sourcing/services/ai-filter-engine/ai-filter-engine.service';
import { FilterDescriptionProcessorService } from 'src/engine/core-modules/candidate-sourcing/services/filter-description-processor.service';
import {
  OUTREACH_SAMPLE_MESSAGE_COLUMN_KEY,
  OUTREACH_SAMPLE_MESSAGE_DRAFTER,
  type OutreachSampleMessageDrafter,
  type OutreachSampleMessageInclude,
} from 'src/engine/core-modules/outreach-command/types/outreach-sample-message.types';
import {
  type OutreachWorkingSetRow,
  type OutreachWorkingSetSubject,
  OutreachWorkingSetService,
} from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';

// The engine's field spec already covers boolean, enum, text, number, integer.
export type OutreachAiColumnField = FilterFieldSpec;

export type OutreachAiColumnFilter = {
  name: string;
  prompt: string;
  selectedModel: string;
  fields: OutreachAiColumnField[];
  selectedMetadataFields: string[];
  // Set for the sample first-LinkedIn-message column: rows are drafted by the
  // opener agent instead of the AI filter engine.
  sampleMessage?: { include: OutreachSampleMessageInclude };
};

export type OutreachAiColumnValue = boolean | string | number | null;

export type OutreachAiColumnRowResult = {
  id: string;
  name: string;
  status: 'answered' | 'failed';
  values: Record<string, OutreachAiColumnValue>;
  error?: string;
};

export type OutreachAiColumnUsage = {
  engine:
    | 'jev'
    | 'openai'
    | 'openai-web-search'
    | 'perplexity-search'
    | 'bright-data-serp'
    | 'mixed-web-search';
  model: string;
  calls: number;
  webSearchCalls: number;
  // Web lookups answered per provider, when the column used web search
  webSearchProviders?: Partial<Record<WebSearchProviderId, number>>;
  inputTokens: number;
  outputTokens: number;
  // Estimated from list prices; jev is billed by the gateway and reports none.
  estimatedCostUsd: number | null;
  durationMs: number;
};

export type PreviewState = {
  previewId: string;
  workspaceId: string;
  projectId: string;
  subject: OutreachWorkingSetSubject;
  filter: OutreachAiColumnFilter;
  previewedRows: Record<string, OutreachAiColumnRowResult>;
};

// CacheStorageService takes milliseconds.
const PREVIEW_TTL_MS = 60 * 60 * 1000;
const PREVIEW_ROW_LIMIT = 10;
const SAMPLE_MESSAGE_CONCURRENCY = 3;

export const isWebSearchModel = (model: string): boolean =>
  /search|web/i.test(model);

export const toRecordForModel = (
  row: OutreachWorkingSetRow,
): { id: string } & Record<string, unknown> => ({
  id: row.id,
  // buildRecordText reads person-identity fields (jobTitle, jobCompanyName,
  // locationName, linkedinUrl) only from a nested `people` object.
  people: {
    jobTitle: row.title,
    jobCompanyName: row.companyName,
    locationName: row.locationName,
    linkedinLink: row.linkedinUrl,
  },
  name: row.name,
  title: row.title,
  jobTitle: row.title,
  headline: row.headline,
  companyName: row.companyName,
  location: row.locationName,
  linkedinUrl: row.linkedinUrl,
  domain: row.domain,
  industry: row.industry,
  employees: row.employees,
  size: row.employees,
  ...row.otherFields,
});

// Keys that carry bookkeeping rather than facts about the row.
const NON_RECORD_KEYS = new Set(['id', 'people', 'aiColumns', 'title']);

// The model reads the whole record: every field the row has (core fields, the
// source data such as about and specialties, and answers of earlier columns),
// not only the few the column design picked. Order is stable: the chosen fields
// first, then the rest as they appear.
export const wholeRecordFields = ({
  records,
  preferredFields,
  excludedFields,
}: {
  records: Array<Record<string, unknown>>;
  preferredFields: string[];
  excludedFields: string[];
}): string[] => {
  const excluded = new Set(excludedFields);
  const fields = new Set<string>(preferredFields);

  for (const record of records) {
    for (const [key, value] of Object.entries(record)) {
      if (
        NON_RECORD_KEYS.has(key) ||
        excluded.has(key) ||
        value === undefined ||
        value === null ||
        `${value}`.trim() === ''
      ) {
        continue;
      }

      fields.add(key);
    }
  }

  return [...fields].filter((field) => !excluded.has(field));
};

// AI columns already on the rows: key, label, type, enum values and how many
// rows hold an answer.
export type ExistingAiColumn = {
  key: string;
  label: string;
  type: string;
  enumValues?: string[];
  filled: number;
};

export const readExistingAiColumns = (
  rows: OutreachWorkingSetRow[],
): ExistingAiColumn[] => {
  const columns = new Map<string, ExistingAiColumn>();

  for (const row of rows) {
    const meta = row.otherFields.aiColumns;

    if (typeof meta !== 'object' || meta === null) {
      continue;
    }

    for (const [key, entry] of Object.entries(
      meta as Record<string, unknown>,
    )) {
      if (typeof entry !== 'object' || entry === null) {
        continue;
      }

      const record = entry as Record<string, unknown>;
      const existing = columns.get(key) ?? {
        key,
        label: typeof record.label === 'string' ? record.label : key,
        type: typeof record.type === 'string' ? record.type : 'text',
        ...(Array.isArray(record.enumValues)
          ? { enumValues: record.enumValues.map(String) }
          : {}),
        filled: 0,
      };
      const value = row.otherFields[key];

      if (value !== undefined && value !== null && `${value}`.trim() !== '') {
        existing.filled += 1;
      }

      columns.set(key, existing);
    }
  }

  return [...columns.values()];
};

const KEY_STOP_TOKENS = new Set([
  'is',
  'in',
  'of',
  'the',
  'has',
  'runs',
  'count',
  'number',
  'total',
  'usd',
  'inr',
  'crore',
  'india',
  'source',
]);

const keyTokens = (key: string): string[] =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.replace(/s$/, ''))
    .filter((token) => token.length > 0 && !KEY_STOP_TOKENS.has(token));

const tokensOverlap = (a: string, b: string): boolean =>
  a === b ||
  (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));

// A new field that shares a meaningful word with an existing column probably
// repeats it (storeCount vs physicalStoresCount, brandCategory vs brandCat).
export const findLookAlikeColumns = (
  newKeys: string[],
  existingColumns: ExistingAiColumn[],
): string[] => {
  const existingKeys = new Set(existingColumns.map((column) => column.key));

  return newKeys
    .filter((key) => !existingKeys.has(key))
    .flatMap((key) => {
      const tokens = keyTokens(key);
      const similar = existingColumns.filter((column) =>
        keyTokens(column.key).some((existingToken) =>
          tokens.some((token) => tokensOverlap(token, existingToken)),
        ),
      );

      return similar.length === 0
        ? []
        : [
            `New field "${key}" looks like the existing column ${similar
              .map(
                (column) =>
                  `"${column.key}" (${column.label}, ${column.filled} rows filled)`,
              )
              .join(
                ', ',
              )}. Reuse the existing column key if it is the same fact (call preview_ai_column again with a description that says to fill or update that column); keep a new column only if it is a genuinely different fact.`,
          ];
    });
};

// Web answers come back with markdown links and tracking parameters.
const cleanText = (value: string): string =>
  value
    .replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label, url) =>
      /^https?:/.test(label) ? url : `${label} ${url}`.trim(),
    )
    .replace(/[?&]utm_[a-z]+=[^&\s)]*/gi, '')
    .replace(/^\((.*)\)$/, '$1')
    .trim();

export const humanizeKey = (key: string): string => {
  const spaced = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// Text answers like "~$120M (FY24)" or "~350 employees" cannot be sorted or
// filtered as numbers. Tell the agent so it re-designs the column.
const NUMERIC_LOOKING_TEXT =
  /^[~≈<>]?\s*[$€£₹]?\s*\d[\d,.]*\s*(k|m|b|bn|mn|million|billion|thousand|cr|crore|lakh)?\b/i;

const detectTypeWarnings = (
  fields: OutreachAiColumnField[],
  results: OutreachAiColumnRowResult[],
): string[] =>
  fields.flatMap((field) => {
    if (field.type !== 'text') {
      return [];
    }

    const values = results
      .map((result) => result.values[field.name])
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.toLowerCase() !== 'unknown',
      );
    const numericLooking = values.filter((value) =>
      NUMERIC_LOOKING_TEXT.test(value.trim()),
    );

    return values.length >= 3 && numericLooking.length / values.length >= 0.7
      ? [
          `"${field.name}" is text but ${numericLooking.length}/${values.length} answers are numbers. Use type "integer" (counts) or "number" (money, ratios), or an enum of ranges, so the column can be sorted and filtered.`,
        ]
      : [];
  });

// Web lookups about a person's employer (revenue, headcount) are made once per
// company and copied to every person who works there.
export const shouldGroupByCompany = (
  subject: OutreachWorkingSetSubject,
  filter: OutreachAiColumnFilter,
): boolean =>
  subject === 'person' &&
  isWebSearchModel(filter.selectedModel) &&
  filter.selectedMetadataFields.some((field) =>
    ['companyName', 'jobCompanyName'].includes(field),
  );

export const companyGroupKey = (row: OutreachWorkingSetRow): string => {
  const key = (row.companyName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return key === '' ? `row:${row.id}` : `company:${key}`;
};

// All model work goes through AiFilterEngineService, the same core the
// workflow AI-filtering step uses. This service only prepares rows, designs
// the column and keeps the preview.
@Injectable()
export class OutreachAiColumnService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
    private readonly outreachWorkingSetService: OutreachWorkingSetService,
    private readonly aiFilterEngineService: AiFilterEngineService,
    private readonly filterDescriptionProcessorService: FilterDescriptionProcessorService,
    // The drafter lives in ToolModule, which imports this module (cycle).
    private readonly moduleRef: ModuleRef,
  ) {}

  // Types are decided by the description LLM (the original AI filtering
  // design call), not hand-written by the chat agent.
  async designFilter({
    description,
    subject,
    workspaceId,
    existingColumns = [],
  }: {
    description: string;
    subject: OutreachWorkingSetSubject;
    workspaceId: string;
    existingColumns?: ExistingAiColumn[];
  }): Promise<OutreachAiColumnFilter> {
    const design = await this.filterDescriptionProcessorService.designColumn({
      description,
      subject,
      workspaceId,
      existingColumns,
    });
    const existingByKey = new Map(
      existingColumns.map((column) => [column.key, column]),
    );
    // A field that reuses an existing key keeps that column's type and enum
    // values, so the run fills the same column instead of changing it.
    const fields: OutreachAiColumnField[] = design.fields.map((field) => {
      const existing = existingByKey.get(field.name);
      const type =
        (existing?.type as typeof field.type | undefined) ?? field.type;
      const enumValues =
        type === 'enum'
          ? (existing?.enumValues ?? field.enumValues)
          : undefined;

      return {
        name: field.name,
        type,
        description: field.description,
        ...(enumValues !== undefined ? { enumValues } : {}),
      };
    });
    const decidedFromRow = fields.every(
      (field) => field.type === 'boolean' || field.type === 'enum',
    );

    return {
      name: design.columnName,
      prompt: design.prompt,
      // jev for decisions the row can answer, web search for outside facts,
      // gpt-4o-mini for everything else.
      selectedModel: design.needsWebSearch
        ? 'gpt4ominisearchpreview'
        : decidedFromRow
          ? 'jev'
          : 'gpt4omini',
      fields,
      // The model must always be able to tell which row it is answering for.
      selectedMetadataFields: [
        ...new Set(['name', ...design.selectedMetadataFields]),
      ],
    };
  }

  async preview({
    workspaceId,
    projectId,
    subject,
    filter,
    description,
    rowLimit,
  }: {
    workspaceId: string;
    projectId: string;
    subject: OutreachWorkingSetSubject;
    filter?: OutreachAiColumnFilter;
    description?: string;
    rowLimit?: number;
  }): Promise<{
    previewId: string;
    total: number;
    filter: OutreachAiColumnFilter;
    columns: Array<{ key: string; type: string; enumValues?: string[] }>;
    typeWarnings: string[];
    reusedColumns: string[];
    duplicateWarnings: string[];
    rows: OutreachAiColumnRowResult[];
    usage: OutreachAiColumnUsage;
    estimatedRunCostUsd: number | null;
  }> {
    const all = await this.outreachWorkingSetService.getAll({
      workspaceId,
      projectId,
      subject,
    });

    if (all.length === 0 && subject === 'company') {
      throw new Error(
        'This project has no companies: no CRM companies tagged to it and no ephemeral Find list. If the user is on the People tab, call again with subject "person": the column then describes each person\'s company.',
      );
    }

    const resolvedFilter =
      filter ??
      (isDefined(description)
        ? await this.designFilter({
            description,
            subject,
            workspaceId,
            existingColumns: readExistingAiColumns(all),
          })
        : undefined);

    if (!isDefined(resolvedFilter)) {
      throw new Error('Pass a description of the column (or a filter).');
    }

    const groupByCompany = shouldGroupByCompany(subject, resolvedFilter);
    const sample = this.pickPreviewSample(
      all,
      resolvedFilter,
      Math.min(rowLimit ?? PREVIEW_ROW_LIMIT, PREVIEW_ROW_LIMIT),
      groupByCompany,
    );
    const { results, usage } = await this.evaluateRows(
      sample,
      subject,
      resolvedFilter,
      workspaceId,
    );
    const existingColumns = readExistingAiColumns(all);
    const previewId = randomUUID();
    const state: PreviewState = {
      previewId,
      workspaceId,
      projectId,
      subject,
      filter: resolvedFilter,
      previewedRows: Object.fromEntries(
        results
          .filter((result) => result.status === 'answered')
          .map((result) => [result.id, result]),
      ),
    };

    await this.cache.set(this.previewKey(previewId), state, PREVIEW_TTL_MS);

    const remaining = groupByCompany
      ? Math.max(
          0,
          new Set(all.map(companyGroupKey)).size -
            new Set(sample.map(companyGroupKey)).size,
        )
      : Math.max(0, all.length - sample.length);
    const perRowCost =
      usage.estimatedCostUsd !== null && sample.length > 0
        ? usage.estimatedCostUsd / sample.length
        : null;

    return {
      previewId,
      total: all.length,
      filter: resolvedFilter,
      columns: resolvedFilter.fields.map((field) => ({
        key: field.name,
        type: field.type,
        ...(field.type === 'enum' ? { enumValues: field.enumValues } : {}),
      })),
      typeWarnings: detectTypeWarnings(resolvedFilter.fields, results),
      reusedColumns: resolvedFilter.fields
        .map((field) => field.name)
        .filter((name) =>
          existingColumns.some((column) => column.key === name),
        ),
      duplicateWarnings: findLookAlikeColumns(
        resolvedFilter.fields.map((field) => field.name),
        existingColumns,
      ),
      rows: results,
      usage,
      estimatedRunCostUsd:
        perRowCost === null
          ? null
          : Number((perRowCost * remaining).toFixed(4)),
    };
  }

  async getPreviewState(previewId: string): Promise<PreviewState | undefined> {
    return this.cache.get<PreviewState>(this.previewKey(previewId));
  }

  // Selection drawer action: stash the sample-message filter without drafting
  // a preview sample, then run only the chosen row ids.
  async createSampleMessagePreview({
    workspaceId,
    projectId,
    include,
  }: {
    workspaceId: string;
    projectId: string;
    include?: OutreachSampleMessageInclude;
  }): Promise<string> {
    const previewId = randomUUID();
    const state: PreviewState = {
      previewId,
      workspaceId,
      projectId,
      subject: 'person',
      filter: {
        name: 'Sample LinkedIn message',
        prompt: 'Draft the first LinkedIn message for this prospect.',
        selectedModel: 'linkedin-message-agent',
        fields: [
          {
            name: OUTREACH_SAMPLE_MESSAGE_COLUMN_KEY,
            type: 'text',
            description: 'Draft of the first LinkedIn message',
          },
        ],
        selectedMetadataFields: ['name'],
        sampleMessage: { include: include ?? {} },
      },
      previewedRows: {},
    };

    await this.cache.set(this.previewKey(previewId), state, PREVIEW_TTL_MS);

    return previewId;
  }

  // The preview should show real answers, so rows that carry data for the
  // fields the model will read come first; thin rows only fill what is left.
  private pickPreviewSample(
    rows: OutreachWorkingSetRow[],
    filter: OutreachAiColumnFilter,
    limit: number,
    distinctCompanies: boolean,
  ): OutreachWorkingSetRow[] {
    const dataFields = filter.selectedMetadataFields.filter(
      (field) => field !== 'name',
    );
    const filledFieldCount = (row: OutreachWorkingSetRow): number => {
      const record = toRecordForModel(row);

      return dataFields.filter((field) => {
        const value = record[field];

        return (
          value !== undefined && value !== null && `${value}`.trim() !== ''
        );
      }).length;
    };

    const ranked = rows
      .map((row, index) => ({ row, index, filled: filledFieldCount(row) }))
      .sort((a, b) => b.filled - a.filled || a.index - b.index)
      .map(({ row }) => row);

    if (!distinctCompanies) {
      return ranked.slice(0, limit);
    }

    const seen = new Set<string>();

    return ranked
      .filter((row) => {
        const key = companyGroupKey(row);

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);

        return true;
      })
      .slice(0, limit);
  }

  async evaluateRows(
    rows: OutreachWorkingSetRow[],
    subject: OutreachWorkingSetSubject,
    filter: OutreachAiColumnFilter,
    workspaceId: string,
  ): Promise<{
    results: OutreachAiColumnRowResult[];
    usage: OutreachAiColumnUsage;
  }> {
    if (isDefined(filter.sampleMessage)) {
      return this.draftSampleMessages(
        rows,
        filter,
        filter.sampleMessage.include,
        workspaceId,
      );
    }

    if (!shouldGroupByCompany(subject, filter)) {
      return this.runEngine(rows, subject, filter);
    }

    // One web lookup per employer, copied to everyone who works there.
    const membersByKey = new Map<string, OutreachWorkingSetRow[]>();

    for (const row of rows) {
      const key = companyGroupKey(row);

      membersByKey.set(key, [...(membersByKey.get(key) ?? []), row]);
    }

    const { results, usage } = await this.runEngine(
      [...membersByKey.values()].map((members) => members[0]),
      subject,
      filter,
    );
    const resultByKey = new Map(
      results.map((result) => [
        companyGroupKey(rows.find((row) => row.id === result.id)!),
        result,
      ]),
    );

    return {
      usage,
      results: rows.map((row): OutreachAiColumnRowResult => {
        const shared = resultByKey.get(companyGroupKey(row))!;

        return { ...shared, id: row.id, name: row.name };
      }),
    };
  }

  // Rows are drafted a few at a time: each can cost a live profile fetch.
  private async draftSampleMessages(
    rows: OutreachWorkingSetRow[],
    filter: OutreachAiColumnFilter,
    include: OutreachSampleMessageInclude,
    workspaceId: string,
  ): Promise<{
    results: OutreachAiColumnRowResult[];
    usage: OutreachAiColumnUsage;
  }> {
    const startedAt = Date.now();
    const drafter = this.moduleRef.get<OutreachSampleMessageDrafter>(
      OUTREACH_SAMPLE_MESSAGE_DRAFTER,
      { strict: false },
    );
    const columnKey = filter.fields[0].name;
    const results: OutreachAiColumnRowResult[] = [];

    for (
      let index = 0;
      index < rows.length;
      index += SAMPLE_MESSAGE_CONCURRENCY
    ) {
      const batch = rows.slice(index, index + SAMPLE_MESSAGE_CONCURRENCY);

      results.push(
        ...(await Promise.all(
          batch.map(async (row): Promise<OutreachAiColumnRowResult> => {
            try {
              const draft = await drafter.draftForProspect({
                workspaceId,
                include,
                prospect: {
                  // CRM working-set rows are keyed by candidate id.
                  candidateId: row.source === 'crm' ? row.id : undefined,
                  name: row.name,
                  title: row.title,
                  companyName: row.companyName,
                  linkedinUrl: row.linkedinUrl,
                },
              });

              if (!draft.message.trim()) {
                return {
                  id: row.id,
                  name: row.name,
                  status: 'failed',
                  values: {},
                  error:
                    draft.warnings.join(' ') ||
                    'Opener draft returned an empty message',
                };
              }

              return {
                id: row.id,
                name: row.name,
                status: 'answered',
                values: { [columnKey]: draft.message },
              };
            } catch (error) {
              return {
                id: row.id,
                name: row.name,
                status: 'failed',
                values: {},
                error: error instanceof Error ? error.message : String(error),
              };
            }
          }),
        )),
      );
    }

    return {
      results,
      usage: {
        engine: 'openai',
        model: filter.selectedModel,
        calls: rows.length,
        webSearchCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: null,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  private async runEngine(
    rows: OutreachWorkingSetRow[],
    subject: OutreachWorkingSetSubject,
    filter: OutreachAiColumnFilter,
  ): Promise<{
    results: OutreachAiColumnRowResult[];
    usage: OutreachAiColumnUsage;
  }> {
    const webSearch = isWebSearchModel(filter.selectedModel);
    // A single yes/no column is a filter (keep / reject); anything else is an
    // enrichment column and may answer "unknown".
    const keepField =
      filter.fields.length === 1 && filter.fields[0].type === 'boolean'
        ? filter.fields[0].name
        : undefined;
    const spec: FilterSpec = {
      name: filter.name,
      subject,
      criteria: filter.prompt,
      fields: filter.fields,
      keepField,
      model: filter.selectedModel,
      metadataFields: [],
      webSearch,
      allowUnknown: keepField === undefined,
    };
    const records = rows.map(toRecordForModel);

    spec.metadataFields = wholeRecordFields({
      records,
      preferredFields: filter.selectedMetadataFields,
      excludedFields: filter.fields.map((field) => field.name),
    });

    const { verdicts, stats } = await this.aiFilterEngineService.run(
      records,
      spec,
    );
    const nameById = new Map(rows.map((row) => [row.id, row.name]));
    const results = verdicts.map((verdict): OutreachAiColumnRowResult => {
      const values: Record<string, OutreachAiColumnValue> = {};

      for (const field of filter.fields) {
        const answer = verdict.answers[field.name];

        values[field.name] =
          typeof answer === 'string'
            ? cleanText(answer) || null
            : (answer ?? null);
      }

      return {
        id: verdict.id,
        name: nameById.get(verdict.id) ?? '',
        status: verdict.status,
        values,
        error: verdict.error,
      };
    });

    return {
      results,
      usage: {
        engine:
          webSearch && stats.engine === 'openai'
            ? labelWebSearchEngine(stats.webSearchProviders)
            : stats.engine,
        model: stats.model,
        calls: stats.calls,
        webSearchCalls: stats.webSearchCalls,
        ...(webSearch ? { webSearchProviders: stats.webSearchProviders } : {}),
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        estimatedCostUsd: stats.estimatedCostUsd,
        durationMs: stats.durationMs,
      },
    };
  }

  private previewKey(previewId: string): string {
    return `outreach-ai-column-preview:${previewId}`;
  }
}
