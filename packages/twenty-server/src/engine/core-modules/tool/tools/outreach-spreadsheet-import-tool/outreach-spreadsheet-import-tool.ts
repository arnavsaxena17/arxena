import { Injectable } from '@nestjs/common';

import { FileFolder } from 'twenty-shared/types';

import { FileService } from 'src/engine/core-modules/file/services/file.service';
import {
  CompanyNameResolverService,
  type ResolvedCompanyFromRawName,
} from 'src/engine/core-modules/org-chart/services/company-name-resolver.service';
import {
  type OutreachEphemeralCompany,
  OutreachCompaniesCacheService,
} from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { OutreachSpreadsheetMappingService } from 'src/engine/core-modules/outreach-command/services/outreach-spreadsheet-mapping.service';
import { OutreachPeopleCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { mergePeople } from 'src/engine/core-modules/outreach-command/utils/merge-people.util';
import {
  companyDedupeKey,
  toEphemeralCompany,
} from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';
import { toEphemeralPerson } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';
import {
  ImportOutreachSpreadsheetInputZodSchema,
  InspectOutreachSpreadsheetInputZodSchema,
} from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-import-tool.schema';
import {
  applyCompanyResolution,
  countCompanyResolutions,
  needsCompanyResolution,
  type SpreadsheetCompanyResolutionCounts,
} from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-company-resolution.util';
import {
  applySpreadsheetMapping,
  suggestSpreadsheetMapping,
  type ImportedCompany,
  type ImportedPerson,
  type OutreachSpreadsheetExtraColumn,
  type OutreachSpreadsheetMapping,
} from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-mapping.util';
import {
  parseSpreadsheetBuffer,
  type ParsedSpreadsheet,
} from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-parser.util';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const SAMPLE_ROW_COUNT = 5;
// CompanyNameResolverService.resolveMany takes at most 50 names per call
const RESOLVE_BATCH_SIZE = 50;

export type CompanyResolutionSummary =
  | ({ status: 'done'; checked: number } & SpreadsheetCompanyResolutionCounts)
  | { status: 'skipped'; reason: 'resolver_not_configured'; checked: number };

const describeCompanyResolution = (
  summary: CompanyResolutionSummary | undefined,
): string => {
  if (summary === undefined || summary.checked === 0) {
    return '';
  }

  if (summary.status === 'skipped') {
    return ` ${summary.checked} companies have no domain or LinkedIn URL; they were not resolved (company resolver not configured).`;
  }

  return ` Resolved ${summary.checked} companies without a domain or LinkedIn URL: ${summary.resolved} resolved, ${summary.lowConfidence} low confidence (check alternates), ${summary.unresolvable} unresolvable${
    summary.lookupFailed > 0 ? `, ${summary.lookupFailed} lookup failed` : ''
  }.`;
};

const loadSpreadsheet = async (
  fileService: FileService,
  context: ToolExecutionContext,
  input: { fileId: string; sheetName?: string; headerRow?: number },
): Promise<ParsedSpreadsheet | null> => {
  const file = await fileService.getFileContentById({
    fileId: input.fileId,
    workspaceId: context.workspaceId,
    fileFolder: FileFolder.AgentChat,
  });

  if (file === null) {
    return null;
  }

  return parseSpreadsheetBuffer(file.buffer, input);
};

// LLM proposal first (existing keys + proposed extra keys); header heuristics
// when no model is available or the call fails.
const proposeMapping = async (
  mappingService: OutreachSpreadsheetMappingService,
  workspaceId: string,
  spreadsheet: ParsedSpreadsheet,
): Promise<{
  mapping: OutreachSpreadsheetMapping;
  source: 'llm' | 'heuristic';
}> => {
  const sampleRows = spreadsheet.rows.slice(0, SAMPLE_ROW_COUNT).map((row) =>
    Object.fromEntries(
      spreadsheet.headers.map((header, index) => [
        header,
        row[index]?.link !== undefined
          ? `${row[index].text} <${row[index].link}>`
          : (row[index]?.text ?? ''),
      ]),
    ),
  );
  const proposed = await mappingService.propose({
    workspaceId,
    headers: spreadsheet.headers,
    sampleRows,
  });

  return proposed !== null &&
    (proposed.company !== undefined || proposed.peopleGroups.length > 0)
    ? { mapping: proposed, source: 'llm' }
    : {
        mapping: suggestSpreadsheetMapping(spreadsheet.headers),
        source: 'heuristic',
      };
};

const fileNotFound: ToolOutput = {
  success: false,
  message:
    'Spreadsheet not found. Ask the user to attach the file to the chat again.',
  error: 'FILE_NOT_FOUND',
};

@Injectable()
export class InspectOutreachSpreadsheetTool implements Tool {
  description = `Read an attached .xlsx / .csv and propose how its columns map to Outreach companies and people.
Returns the headers, ${SAMPLE_ROW_COUNT} sample rows, a suggested mapping and how many companies / people it would produce. Writes nothing.
Call this first, show the mapping to the user, and only then call import_outreach_spreadsheet.`;

  inputSchema = InspectOutreachSpreadsheetInputZodSchema;

  constructor(
    private readonly fileService: FileService,
    private readonly outreachSpreadsheetMappingService: OutreachSpreadsheetMappingService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parseResult =
      InspectOutreachSpreadsheetInputZodSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid inspect_outreach_spreadsheet input',
        error: parseResult.error.message,
      };
    }

    const spreadsheet = await loadSpreadsheet(
      this.fileService,
      context,
      parseResult.data,
    );

    if (spreadsheet === null) {
      return fileNotFound;
    }

    const { mapping: suggestedMapping, source: mappingSource } =
      await proposeMapping(
        this.outreachSpreadsheetMappingService,
        context.workspaceId,
        spreadsheet,
      );
    const preview = applySpreadsheetMapping(
      spreadsheet.headers,
      spreadsheet.rows,
      suggestedMapping,
    );

    return {
      success: true,
      message: `Sheet "${spreadsheet.sheetName}": ${spreadsheet.rows.length} data rows. The suggested mapping yields ${preview.companies.length} companies and ${preview.people.length} people.`,
      result: {
        sheetNames: spreadsheet.sheetNames,
        sheetName: spreadsheet.sheetName,
        headerRow: spreadsheet.headerRowIndex + 1,
        headers: spreadsheet.headers,
        rowCount: spreadsheet.rows.length,
        sampleRows: spreadsheet.rows.slice(0, SAMPLE_ROW_COUNT).map((row) =>
          Object.fromEntries(
            spreadsheet.headers.map((header, index) => [
              header,
              row[index]?.link !== undefined
                ? `${row[index].text} <${row[index].link}>`
                : (row[index]?.text ?? ''),
            ]),
          ),
        ),
        suggestedMapping,
        mappingSource,
        suggestedCounts: {
          companies: preview.companies.length,
          people: preview.people.length,
          skippedRows: preview.skippedRowCount,
          skippedPeople: preview.skippedPeopleCount,
        },
      },
    };
  }
}

@Injectable()
export class ImportOutreachSpreadsheetTool implements Tool {
  description = `Import an attached .xlsx / .csv into the Outreach Companies and/or People tabs of a project (ephemeral lists, not CRM).
Parses every row on the server and upserts: companies by domain (fallback name), people by LinkedIn URL (fallback name + company). Wide sheets with "Contact 1 / Contact 2" column sets become one person per set.
Companies without a domain or LinkedIn URL are then resolved against the company index (free): a high-confidence match fills the domain and LinkedIn URL, every match writes matchConfidence and alternates, and a company with no match gets status "unresolvable". The result's companyResolution has the counts.
Use only after inspect_outreach_spreadsheet and the user's confirmation of the project, target (companies / people / both) and mapping.`;

  inputSchema = ImportOutreachSpreadsheetInputZodSchema;

  constructor(
    private readonly fileService: FileService,
    private readonly outreachCompaniesCacheService: OutreachCompaniesCacheService,
    private readonly outreachPeopleCacheService: OutreachPeopleCacheService,
    private readonly outreachSpreadsheetMappingService: OutreachSpreadsheetMappingService,
    private readonly companyNameResolverService: CompanyNameResolverService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parseResult =
      ImportOutreachSpreadsheetInputZodSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid import_outreach_spreadsheet input',
        error: parseResult.error.message,
      };
    }

    const input = parseResult.data;
    const spreadsheet = await loadSpreadsheet(
      this.fileService,
      context,
      input,
    );

    if (spreadsheet === null) {
      return fileNotFound;
    }

    const mapping: OutreachSpreadsheetMapping =
      input.mapping ??
      (
        await proposeMapping(
          this.outreachSpreadsheetMappingService,
          context.workspaceId,
          spreadsheet,
        )
      ).mapping;

    const unknownHeaders = collectMappedHeaders(mapping).filter(
      (header) => !spreadsheet.headers.includes(header),
    );

    if (unknownHeaders.length > 0) {
      return {
        success: false,
        message: `Mapping references columns that are not in the sheet: ${unknownHeaders.join(', ')}. Valid headers: ${spreadsheet.headers.join(', ')}`,
        error: 'UNKNOWN_COLUMNS',
      };
    }

    const imported = applySpreadsheetMapping(
      spreadsheet.headers,
      spreadsheet.rows,
      {
        ...mapping,
        peopleGroups: input.target === 'companies' ? [] : mapping.peopleGroups,
      },
    );

    if (input.target !== 'people' && mapping.company === undefined) {
      return {
        success: false,
        message:
          'No company name column in the mapping. Map one, or import people only.',
        error: 'MISSING_COMPANY_NAME',
      };
    }

    if (input.target !== 'companies' && imported.people.length === 0) {
      return {
        success: false,
        message:
          'No people found with this mapping. Map the person name column(s), or import companies only.',
        error: 'MISSING_PEOPLE_MAPPING',
      };
    }

    const companyIdByName = new Map<string, string>();
    let companiesTotal: number | undefined;
    let peopleTotal: number | undefined;
    let companyResolution: CompanyResolutionSummary | undefined;

    if (input.target !== 'people') {
      ({ total: companiesTotal, resolution: companyResolution } =
        await this.writeCompanies(
          context.workspaceId,
          input.projectId,
          input.mode,
          imported.companies,
          mapping.company?.extra ?? [],
          companyIdByName,
        ));
    }

    if (input.target !== 'companies') {
      peopleTotal = await this.writePeople(
        context.workspaceId,
        input.projectId,
        input.mode,
        imported.people,
        companyIdByName,
      );
    }

    return {
      success: true,
      message: `Imported into project ${input.projectId}: ${
        companiesTotal !== undefined
          ? `${imported.companies.length} companies (tab total ${companiesTotal})`
          : 'no companies'
      }, ${
        peopleTotal !== undefined
          ? `${imported.people.length} people (tab total ${peopleTotal})`
          : 'no people'
      }. Skipped ${imported.skippedRowCount} rows without a company name and ${imported.skippedPeopleCount} empty contact slots.${describeCompanyResolution(companyResolution)} Nothing was written to the CRM.`,
      result: {
        projectId: input.projectId,
        target: input.target,
        mode: input.mode,
        companiesImported: imported.companies.length,
        peopleImported: imported.people.length,
        companiesTabTotal: companiesTotal,
        peopleTabTotal: peopleTotal,
        skippedRows: imported.skippedRowCount,
        skippedPeople: imported.skippedPeopleCount,
        companyResolution,
        mapping,
      },
    };
  }

  private async writeCompanies(
    workspaceId: string,
    projectId: string,
    mode: 'merge' | 'replace',
    companies: ImportedCompany[],
    extraColumns: OutreachSpreadsheetExtraColumn[],
    companyIdByName: Map<string, string>,
  ): Promise<{ total: number; resolution: CompanyResolutionSummary }> {
    const existing =
      mode === 'merge'
        ? ((await this.outreachCompaniesCacheService.get(workspaceId, projectId))
            ?.companies ?? [])
        : [];
    const byKey = new Map(
      existing.map((company) => [companyDedupeKey(company), company]),
    );
    // A row whose domain was filled by resolution is keyed by domain, while
    // the same sheet row imported again has no domain and is keyed by name.
    const keyByName = new Map(
      existing.map((company) => [
        companyDedupeKey({ name: company.name, domain: '' }),
        companyDedupeKey(company),
      ]),
    );
    const importedKeys = new Set<string>();

    for (const company of companies) {
      const incoming = toEphemeralCompany({
        name: company.name,
        domain: company.domain,
        industry: company.industry,
        employees: company.employees,
        segment: company.segment,
      });
      const incomingKey = companyDedupeKey(incoming);
      const key = byKey.has(incomingKey)
        ? incomingKey
        : (keyByName.get(incomingKey) ?? incomingKey);
      const previous = byKey.get(key);

      const merged = {
        ...(previous ?? incoming),
        ...incoming,
        id: previous?.id ?? incoming.id,
        domain: incoming.domain || (previous?.domain ?? ''),
        otherFields: {
          ...previous?.otherFields,
          ...company.extra,
          // Same label/type record the AI columns use, so the table titles
          // and formats the imported columns.
          aiColumns: {
            ...(previous?.otherFields?.aiColumns as
              | Record<string, unknown>
              | undefined),
            ...Object.fromEntries(
              extraColumns
                .filter((column) => column.key in company.extra)
                .map((column) => [
                  column.key,
                  { label: column.label, type: column.type, source: 'import' },
                ]),
            ),
          },
        },
      };

      byKey.set(key, merged);
      importedKeys.add(key);
      companyIdByName.set(company.name, merged.id);
    }

    const resolution = await this.resolveImportedCompanies(byKey, importedKeys);

    await this.outreachCompaniesCacheService.set(workspaceId, projectId, [
      ...byKey.values(),
    ]);

    return { total: byKey.size, resolution };
  }

  // Resolves before the one cache write, so the filled domain and the
  // "unresolvable" status (top-level row fields, which writeOtherFields does
  // not touch) land with the import instead of in a second rewrite of the
  // whole list.
  private async resolveImportedCompanies(
    byKey: Map<string, OutreachEphemeralCompany>,
    importedKeys: Set<string>,
  ): Promise<CompanyResolutionSummary> {
    const keysToResolve = [...importedKeys].filter((key) => {
      const company = byKey.get(key);

      return company !== undefined && needsCompanyResolution(company);
    });

    if (!this.companyNameResolverService.isEnabled()) {
      return {
        status: 'skipped',
        reason: 'resolver_not_configured',
        checked: keysToResolve.length,
      };
    }

    const resolutions: ResolvedCompanyFromRawName[] = [];

    for (
      let offset = 0;
      offset < keysToResolve.length;
      offset += RESOLVE_BATCH_SIZE
    ) {
      const batchKeys = keysToResolve.slice(
        offset,
        offset + RESOLVE_BATCH_SIZE,
      );
      // Imported names are never empty, so results line up with the keys.
      const batchResults = await this.companyNameResolverService.resolveMany(
        batchKeys.map((key) => byKey.get(key)?.name ?? ''),
      );

      batchKeys.forEach((key, index) => {
        const company = byKey.get(key);
        const result = batchResults[index];

        if (company === undefined || result === undefined) {
          return;
        }

        byKey.set(key, applyCompanyResolution(company, result));
        resolutions.push(result);
      });
    }

    return {
      status: 'done',
      checked: keysToResolve.length,
      ...countCompanyResolutions(resolutions),
    };
  }

  private async writePeople(
    workspaceId: string,
    projectId: string,
    mode: 'merge' | 'replace',
    people: ImportedPerson[],
    companyIdByName: Map<string, string>,
  ): Promise<number> {
    const existing =
      mode === 'merge'
        ? ((await this.outreachPeopleCacheService.get(workspaceId, projectId))
            ?.people ?? [])
        : [];
    // Same identity keys as every other writer: a spreadsheet row is the same
    // person as a search row when the URL, the email or name + employer match
    const incoming = people.map((person) =>
      toEphemeralPerson({
        name: person.name,
        title: person.title,
        linkedinUrl: person.linkedinUrl,
        email: person.email,
        companyName: person.companyName,
        companyId: companyIdByName.get(person.companyName) ?? '',
      }),
    );
    const next = mergePeople(existing, incoming);

    await this.outreachPeopleCacheService.set(workspaceId, projectId, next);

    return next.length;
  }
}

const collectMappedHeaders = (mapping: OutreachSpreadsheetMapping): string[] => {
  const { extra = [], ...companyColumns } = mapping.company ?? {};

  return [
    ...Object.values(companyColumns),
    ...extra.map((column) => column.header),
    ...mapping.peopleGroups.flatMap((group) => Object.values(group)),
  ].filter((header): header is string => typeof header === 'string');
};
