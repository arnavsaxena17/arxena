import { Injectable, Logger, Optional } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';

import { OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/outreach-command/constants/outreach-company-enrichment-model.const';
import {
  type OutreachSpreadsheetMapping,
  toColumnKey,
} from 'src/engine/core-modules/tool/tools/outreach-spreadsheet-import-tool/outreach-spreadsheet-mapping.util';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import {
  AiSdkExecutionService,
  runGenerateObject,
} from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const nullableHeader = z.string().nullable();

// Providers handle nullable better than optional fields in structured output.
export const spreadsheetMappingLlmSchema = z.object({
  company: z
    .object({
      name: nullableHeader.describe(
        'Header for the company display name. Prefer the brand / trade name over the legal entity.',
      ),
      fallbackName: nullableHeader.describe(
        'Header used when the name cell is empty, e.g. the legal / operating company',
      ),
      domain: nullableHeader,
      industry: nullableHeader,
      employees: nullableHeader,
      segment: nullableHeader,
    })
    .nullable()
    .describe('Null when the sheet has no company information'),
  peopleGroups: z
    .array(
      z.object({
        name: z.string(),
        title: nullableHeader,
        linkedinUrl: nullableHeader,
        email: nullableHeader,
      }),
    )
    .describe(
      'One group per person in a row. Wide sheets with "Contact 1 …" / "Contact 2 …" column sets give one group per set; a plain people list gives one group.',
    ),
  extraColumns: z
    .array(
      z.object({
        header: z.string(),
        key: z.string().describe('Proposed snake_case key, e.g. revenue_inr_cr'),
        label: z.string().describe('Short human column title'),
        type: z.enum(['text', 'number', 'boolean', 'url']),
      }),
    )
    .describe(
      'Useful sheet columns that fit no built-in field. Skip row numbers, formulas / helper columns and anything already mapped.',
    ),
});

type SpreadsheetMappingLlmResult = z.infer<typeof spreadsheetMappingLlmSchema>;

const SYSTEM_PROMPT = `You map the columns of an uploaded lead spreadsheet onto an outreach CRM.
Built-in company fields: name, fallbackName, domain, industry, employees, segment.
Built-in person fields: name, title, linkedinUrl, email.
Every value you return for a built-in field must be an exact header copied from the sheet, or null. Use each header at most once.
Anything else worth keeping becomes an extra column with a proposed snake_case key, a short label and a type (number only for purely numeric data).
Do not invent headers. Ignore row-number and helper / formula columns.`;

const clean = (value: string | null | undefined): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

@Injectable()
export class OutreachSpreadsheetMappingService {
  private readonly logger = new Logger(OutreachSpreadsheetMappingService.name);

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly aiSdkExecutionService?: AiSdkExecutionService,
  ) {}

  // Returns null when no model is available or the call fails; the caller
  // then falls back to the header heuristics.
  async propose(input: {
    workspaceId: string;
    headers: string[];
    sampleRows: Record<string, string>[];
  }): Promise<OutreachSpreadsheetMapping | null> {
    if (!isDefined(this.aiModelRegistryService)) {
      return null;
    }

    try {
      const registry = this.aiModelRegistryService;
      const fastModel =
        registry.getModel(OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID) ??
        registry.getDefaultSpeedModel();
      const registeredModel =
        await registry.resolveModelForAgentInWorkspace(
          { modelId: fastModel.modelId },
          input.workspaceId,
        );

      const generation = await runGenerateObject(this.aiSdkExecutionService, {
        workspaceId: input.workspaceId,
        modelId: registeredModel.modelId,
        options: {
          model: registeredModel.model,
          schema: spreadsheetMappingLlmSchema,
          system: SYSTEM_PROMPT,
          prompt: `Headers:\n${JSON.stringify(input.headers)}\n\nFirst rows:\n${JSON.stringify(input.sampleRows)}`,
          experimental_telemetry: AI_TELEMETRY_CONFIG,
        },
      });

      return this.toMapping(
        spreadsheetMappingLlmSchema.parse(generation.object),
        input.headers,
      );
    } catch (error) {
      this.logger.warn(
        `LLM spreadsheet mapping failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  // The model output is untrusted: drop headers that are not in the sheet and
  // headers claimed twice.
  private toMapping(
    result: SpreadsheetMappingLlmResult,
    headers: string[],
  ): OutreachSpreadsheetMapping {
    const valid = new Set(headers);
    const used = new Set<string>();
    const claim = (header: string | null | undefined): string | undefined => {
      const value = clean(header);

      if (value === undefined || !valid.has(value)) {
        return undefined;
      }

      return value;
    };
    const claimOnce = (header: string | null | undefined) => {
      const value = claim(header);

      if (value === undefined || used.has(value)) {
        return undefined;
      }

      used.add(value);

      return value;
    };

    const name = claimOnce(result.company?.name);
    const fallbackName = claimOnce(result.company?.fallbackName);
    const domain = claimOnce(result.company?.domain);
    const industry = claimOnce(result.company?.industry);
    const employees = claimOnce(result.company?.employees);
    const segment = claimOnce(result.company?.segment);

    const peopleGroups = result.peopleGroups.flatMap((group) => {
      const personName = claim(group.name);

      if (personName === undefined) {
        return [];
      }

      used.add(personName);

      return [
        {
          name: personName,
          title: claimOnce(group.title),
          linkedinUrl: claimOnce(group.linkedinUrl),
          email: claimOnce(group.email),
        },
      ];
    });

    const usedKeys = new Set<string>();
    const extra = result.extraColumns.flatMap((column) => {
      const header = claimOnce(column.header);

      if (header === undefined) {
        return [];
      }

      let key = toColumnKey(column.key);

      while (usedKeys.has(key)) {
        key = `${key}_2`;
      }

      usedKeys.add(key);

      return [
        {
          header,
          key,
          label: clean(column.label) ?? header,
          type: column.type,
        },
      ];
    });

    return {
      company:
        name === undefined && fallbackName === undefined
          ? undefined
          : {
              name: name ?? fallbackName,
              fallbackName: name === undefined ? undefined : fallbackName,
              domain,
              industry,
              employees,
              segment,
              extra,
            },
      peopleGroups,
    };
  }
}
