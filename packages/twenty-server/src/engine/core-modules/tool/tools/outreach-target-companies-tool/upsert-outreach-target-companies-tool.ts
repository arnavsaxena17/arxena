import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';

import {
  type OutreachEphemeralCompany,
  OutreachCompaniesCacheService,
} from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { ChatTabWritesService } from 'src/engine/core-modules/outreach-command/services/chat-tab-writes.service';
import { mergeOutreachOtherFields } from 'src/engine/core-modules/outreach-command/utils/merge-outreach-other-fields.util';
import {
  type UpsertOutreachTargetCompaniesInput,
  UpsertOutreachTargetCompaniesInputZodSchema,
} from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool.schema';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

export const normalizeDomain = (domain: string): string =>
  domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];

const normalizeName = (name: string): string =>
  cleanCompanyName(name)
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|pvt|private|limited)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Row names arrive from providers with trademarks and case differences: Pice®
// and PICE, or one row with a domain and the same company without one
export const cleanCompanyName = (name: string): string =>
  name.replace(/[®™©]/g, '').replace(/\s+/g, ' ').trim();

export const companyDedupeKey = (company: {
  name: string;
  domain: string;
}): string => {
  const domain = normalizeDomain(company.domain);

  if (isNonEmptyString(domain)) {
    return `domain:${domain}`;
  }

  return `name:${normalizeName(company.name)}`;
};

const buildEphemeralId = (company: {
  id?: string;
  name: string;
  domain: string;
}): string => {
  if (isNonEmptyString(company.id)) {
    return company.id;
  }

  const seed = companyDedupeKey(company);

  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
};

export const toEphemeralCompany = (company: {
  id?: string;
  name: string;
  domain: string;
  industry?: string;
  employees?: string;
  segment?: string;
  icpFit?: string;
  status?: string;
  otherFields?: Record<string, unknown>;
}): OutreachEphemeralCompany => ({
  id: buildEphemeralId(company),
  name: cleanCompanyName(company.name),
  domain: normalizeDomain(company.domain ?? ''),
  industry: company.industry ?? '',
  employees: company.employees ?? '',
  segment: company.segment ?? '',
  icpFit: company.icpFit ?? '',
  status: isNonEmptyString(company.status) ? company.status : 'new',
  ...(company.otherFields !== undefined &&
  Object.keys(company.otherFields).length > 0
    ? { otherFields: company.otherFields }
    : {}),
});

@Injectable()
export class UpsertOutreachTargetCompaniesTool implements Tool {
  description = `Write target companies to the Outreach Companies tab (ephemeral Redis list per projectId).
Use this when the user is on /outreach-home and asks to find/fetch/add/build target companies.
Do NOT create CRM Company records for the Companies tab — only call this tool.
Prefer mode=merge. Pass projectId from the outreachCommand browsing context.`;

  inputSchema = UpsertOutreachTargetCompaniesInputZodSchema;

  constructor(
    private readonly outreachCompaniesCacheService: OutreachCompaniesCacheService,
    private readonly chatTabWritesService: ChatTabWritesService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parseResult =
      UpsertOutreachTargetCompaniesInputZodSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid upsert_outreach_target_companies input',
        error: parseResult.error.message,
      };
    }

    const input: UpsertOutreachTargetCompaniesInput = parseResult.data;
    const incoming = input.companies.map(toEphemeralCompany);

    const existingPayload = await this.outreachCompaniesCacheService.get(
      context.workspaceId,
      input.projectId,
    );
    const existing = existingPayload?.companies ?? [];

    let next: OutreachEphemeralCompany[];
    const writtenRowIds: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    if (input.mode === 'replace') {
      next = dedupeCompanies(incoming);
      for (const company of next) {
        writtenRowIds.push(company.id);
        createdCount += 1;
      }
    } else {
      const byKey = new Map<string, OutreachEphemeralCompany>();
      // A company seen once with a domain and once without is one company:
      // the name finds the row the domain already owns
      const keyByCompanyName = new Map<string, string>();

      for (const company of existing) {
        const key = companyDedupeKey(company);

        byKey.set(key, company);
        keyByCompanyName.set(`name:${normalizeName(company.name)}`, key);
      }

      for (const company of incoming) {
        const nameKey = `name:${normalizeName(company.name)}`;
        const ownKey = companyDedupeKey(company);
        const namedKey = keyByCompanyName.get(nameKey);
        const key =
          namedKey !== undefined &&
          (ownKey.startsWith('name:') || namedKey.startsWith('name:'))
            ? namedKey
            : ownKey;
        const previous = byKey.get(key);

        const otherFields = mergeOutreachOtherFields(
          previous?.otherFields,
          company.otherFields,
        );

        const merged: OutreachEphemeralCompany = {
          ...(previous ?? company),
          ...company,
          // An empty field from a thinner source does not erase what the row
          // already knows
          ...(previous !== undefined &&
            !isNonEmptyString(company.domain) && {
              domain: previous.domain,
            }),
          ...(previous !== undefined &&
            !isNonEmptyString(company.industry) && {
              industry: previous.industry,
            }),
          // Keep stable id when merging into an existing row
          id: previous?.id ?? company.id ?? randomUUID(),
          ...(otherFields !== undefined ? { otherFields } : {}),
        };

        byKey.set(key, merged);
        keyByCompanyName.set(nameKey, key);
        writtenRowIds.push(merged.id);

        if (previous !== undefined) {
          updatedCount += 1;
        } else {
          createdCount += 1;
        }
      }

      next = [...byKey.values()];
    }

    await this.outreachCompaniesCacheService.set(
      context.workspaceId,
      input.projectId,
      next,
    );

    const uniqueWrittenRowIds = [...new Set(writtenRowIds)];

    await this.chatTabWritesService.append(
      context.threadId,
      input.projectId,
      'companies',
      uniqueWrittenRowIds,
    );

    return {
      success: true,
      message: `Wrote ${incoming.length} company(ies) to Companies tab (${input.mode}). Total now ${next.length} for project ${input.projectId}.`,
      result: {
        projectId: input.projectId,
        mode: input.mode,
        writtenCount: incoming.length,
        totalCount: next.length,
        writtenRowIds: uniqueWrittenRowIds,
        createdCount,
        updatedCount,
        companies: next.slice(0, 25).map((company) => ({
          id: company.id,
          name: company.name,
          domain: company.domain,
          industry: company.industry,
          status: company.status,
        })),
      },
    };
  }
}

const dedupeCompanies = (
  companies: OutreachEphemeralCompany[],
): OutreachEphemeralCompany[] => {
  const byKey = new Map<string, OutreachEphemeralCompany>();
  const keyByCompanyName = new Map<string, string>();

  for (const company of companies) {
    const nameKey = `name:${normalizeName(company.name)}`;
    const ownKey = companyDedupeKey(company);
    const namedKey = keyByCompanyName.get(nameKey);
    const key =
      namedKey !== undefined &&
      (ownKey.startsWith('name:') || namedKey.startsWith('name:'))
        ? namedKey
        : ownKey;

    byKey.set(key, { ...(byKey.get(key) ?? company), ...company });
    keyByCompanyName.set(nameKey, key);
  }

  return [...byKey.values()];
};
