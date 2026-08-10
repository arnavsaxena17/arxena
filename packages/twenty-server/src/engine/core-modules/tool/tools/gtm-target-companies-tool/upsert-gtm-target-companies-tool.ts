import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';

import {
  type GtmEphemeralCompany,
  GtmCompaniesCacheService,
} from 'src/engine/core-modules/gtm-command/services/gtm-companies-cache.service';
import {
  type UpsertGtmTargetCompaniesInput,
  UpsertGtmTargetCompaniesInputZodSchema,
} from 'src/engine/core-modules/tool/tools/gtm-target-companies-tool/upsert-gtm-target-companies-tool.schema';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const normalizeDomain = (domain: string): string =>
  domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0];

const normalizeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|pvt|private|limited)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const companyDedupeKey = (company: {
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

const toEphemeralCompany = (company: {
  id?: string;
  name: string;
  domain: string;
  industry?: string;
  employees?: string;
  segment?: string;
  icpFit?: string;
  status?: string;
}): GtmEphemeralCompany => ({
  id: buildEphemeralId(company),
  name: company.name.trim(),
  domain: normalizeDomain(company.domain ?? ''),
  industry: company.industry ?? '',
  employees: company.employees ?? '',
  segment: company.segment ?? '',
  icpFit: company.icpFit ?? '',
  status: isNonEmptyString(company.status) ? company.status : 'new',
});

@Injectable()
export class UpsertGtmTargetCompaniesTool implements Tool {
  description = `Write target companies to the GTM Command Companies tab (ephemeral Redis list per projectId).
Use this when the user is on /gtm-home and asks to find/fetch/add/build target companies.
Do NOT create CRM Company records for the Companies tab — only call this tool.
Prefer mode=merge. Pass projectId from the gtmCommand browsing context.`;

  inputSchema = UpsertGtmTargetCompaniesInputZodSchema;

  constructor(
    private readonly gtmCompaniesCacheService: GtmCompaniesCacheService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parseResult =
      UpsertGtmTargetCompaniesInputZodSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid upsert_gtm_target_companies input',
        error: parseResult.error.message,
      };
    }

    const input: UpsertGtmTargetCompaniesInput = parseResult.data;
    const incoming = input.companies.map(toEphemeralCompany);

    const existingPayload = await this.gtmCompaniesCacheService.get(
      context.workspaceId,
      input.projectId,
    );
    const existing = existingPayload?.companies ?? [];

    let next: GtmEphemeralCompany[];

    if (input.mode === 'replace') {
      next = dedupeCompanies(incoming);
    } else {
      const byKey = new Map<string, GtmEphemeralCompany>();

      for (const company of existing) {
        byKey.set(companyDedupeKey(company), company);
      }

      for (const company of incoming) {
        const key = companyDedupeKey(company);
        const previous = byKey.get(key);

        byKey.set(key, {
          ...(previous ?? company),
          ...company,
          // Keep stable id when merging into an existing row
          id: previous?.id ?? company.id ?? randomUUID(),
        });
      }

      next = [...byKey.values()];
    }

    await this.gtmCompaniesCacheService.set(
      context.workspaceId,
      input.projectId,
      next,
    );

    return {
      success: true,
      message: `Wrote ${incoming.length} company(ies) to GTM Companies tab (${input.mode}). Total now ${next.length} for project ${input.projectId}.`,
      result: {
        projectId: input.projectId,
        mode: input.mode,
        writtenCount: incoming.length,
        totalCount: next.length,
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
  companies: GtmEphemeralCompany[],
): GtmEphemeralCompany[] => {
  const byKey = new Map<string, GtmEphemeralCompany>();

  for (const company of companies) {
    byKey.set(companyDedupeKey(company), company);
  }

  return [...byKey.values()];
};
