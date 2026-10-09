import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { projectIdsHasProject } from 'src/engine/core-modules/outreach-command/utils/project-ids.util';
import { OutreachCompaniesCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { OutreachPeopleCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

export type OutreachWorkingSetSubject = 'person' | 'company';

export type OutreachWorkingSetRow = {
  // Ephemeral id, or the CRM candidate id for enrolled people.
  id: string;
  source: 'ephemeral' | 'crm';
  name: string;
  title?: string;
  headline?: string;
  companyName?: string;
  locationName?: string;
  linkedinUrl?: string;
  domain?: string;
  industry?: string;
  employees?: string;
  segment?: string;
  icpFit?: string;
  otherFields: Record<string, unknown>;
};

export type OutreachExistingAiColumn = {
  key: string;
  label: string;
  type: string;
  // Rows that already hold an answer for this column
  filled: number;
};

export type OutreachWorkingSetPage = {
  total: number;
  // AI columns already on these rows: reuse them before adding a new one
  aiColumns: OutreachExistingAiColumn[];
  rows: OutreachWorkingSetRow[];
  nextCursor: string | null;
};

type CandidateRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  projectId?: string | null;
  peopleId?: string | null;
  otherFields?: unknown;
};

type CompanyRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  domainName?: { primaryLinkUrl?: string | null } | null;
  industry?: string | null;
  employees?: number | string | null;
  icpSegment?: string | null;
  icpFit?: string | null;
  projectIds?: unknown;
  otherFields?: unknown;
};

type PersonRecord = ObjectLiteral & {
  id: string;
  jobTitle?: string | null;
  jobCompanyName?: string | null;
  locationName?: string | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
};

const MAX_PAGE_SIZE = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

// Only CRM records can be looked up by id; an ephemeral row id may be any
// string and would make Postgres reject the whole query.
const crmIds = (valuesByRowId: Map<string, unknown>): string[] =>
  [...valuesByRowId.keys()].filter((id) => UUID_PATTERN.test(id));
const CRM_COMPANY_LIMIT = 5000;
const CRM_CANDIDATE_LIMIT = 5000;

const toRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    try {
      return toRecord(JSON.parse(value));
    } catch {
      return {};
    }
  }

  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

// aiColumns holds one meta entry per AI column, so it is merged key by key
// instead of replaced when another column is added to the same row.
const mergeOtherFieldValues = (
  existing: unknown,
  values: Record<string, unknown>,
): Record<string, unknown> => {
  const current = toRecord(existing);

  return {
    ...current,
    ...values,
    ...(isDefined(values.aiColumns)
      ? {
          aiColumns: {
            ...toRecord(current.aiColumns),
            ...toRecord(values.aiColumns),
          },
        }
      : {}),
  };
};

// Same company, whichever side it came from: by domain, else by name.
const companyIdentityKey = (company: {
  name?: string;
  domain?: string;
}): string => {
  const domain = (company.domain ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');

  return domain !== ''
    ? `domain:${domain}`
    : `name:${(company.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;
};

const normalizeLinkedinKey = (linkedinUrl: string): string =>
  linkedinUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .split('?')[0];

// Merges the ephemeral Find list (Redis, per project) with the CRM records
// that belong to the project, so AI columns see the same rows as the tabs.
@Injectable()
export class OutreachWorkingSetService {
  constructor(
    private readonly outreachPeopleCacheService: OutreachPeopleCacheService,
    private readonly outreachCompaniesCacheService: OutreachCompaniesCacheService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async getPage({
    workspaceId,
    projectId,
    subject,
    limit,
    cursor,
  }: {
    workspaceId: string;
    projectId: string;
    subject: OutreachWorkingSetSubject;
    limit: number;
    cursor?: string;
  }): Promise<OutreachWorkingSetPage> {
    const all = await this.getAll({ workspaceId, projectId, subject });
    const offset = Math.max(0, Number.parseInt(cursor ?? '0', 10) || 0);
    const pageSize = Math.min(Math.max(1, limit), MAX_PAGE_SIZE);
    const rows = all.slice(offset, offset + pageSize);
    const next = offset + rows.length;

    return {
      total: all.length,
      aiColumns: this.collectAiColumns(all),
      rows,
      nextCursor: next < all.length ? String(next) : null,
    };
  }

  private collectAiColumns(
    rows: OutreachWorkingSetRow[],
  ): OutreachExistingAiColumn[] {
    const columns = new Map<string, OutreachExistingAiColumn>();

    for (const row of rows) {
      const meta = row.otherFields.aiColumns;

      if (typeof meta !== 'object' || meta === null) {
        continue;
      }

      for (const [key, entry] of Object.entries(meta)) {
        const record =
          typeof entry === 'object' && entry !== null
            ? (entry as Record<string, unknown>)
            : {};
        const existing = columns.get(key) ?? {
          key,
          label: typeof record.label === 'string' ? record.label : key,
          type: typeof record.type === 'string' ? record.type : 'text',
          filled: 0,
        };

        if (record.status === 'ok') {
          existing.filled += 1;
        }

        columns.set(key, existing);
      }
    }

    return [...columns.values()];
  }

  async getAll({
    workspaceId,
    projectId,
    subject,
  }: {
    workspaceId: string;
    projectId: string;
    subject: OutreachWorkingSetSubject;
  }): Promise<OutreachWorkingSetRow[]> {
    return subject === 'person'
      ? this.getPeople(workspaceId, projectId)
      : this.getCompanies(workspaceId, projectId);
  }

  async getRowsByIds({
    workspaceId,
    projectId,
    subject,
    ids,
  }: {
    workspaceId: string;
    projectId: string;
    subject: OutreachWorkingSetSubject;
    ids: string[];
  }): Promise<OutreachWorkingSetRow[]> {
    const wanted = new Set(ids);
    const all = await this.getAll({ workspaceId, projectId, subject });

    return all.filter((row) => wanted.has(row.id));
  }

  // Adds each row's new keys next to its existing otherFields, on the
  // ephemeral list and on the CRM candidate.
  async writeOtherFields({
    workspaceId,
    projectId,
    subject,
    valuesByRowId,
  }: {
    workspaceId: string;
    projectId: string;
    subject: OutreachWorkingSetSubject;
    valuesByRowId: Map<string, Record<string, unknown>>;
  }): Promise<{ ephemeralUpdated: number; crmUpdated: number }> {
    if (valuesByRowId.size === 0) {
      return { ephemeralUpdated: 0, crmUpdated: 0 };
    }

    if (subject === 'company') {
      return {
        ephemeralUpdated: await this.writeEphemeralCompanies(
          workspaceId,
          projectId,
          valuesByRowId,
        ),
        crmUpdated: await this.writeCompanies(workspaceId, valuesByRowId),
      };
    }

    const ephemeralUpdated = await this.writeEphemeralPeople(
      workspaceId,
      projectId,
      valuesByRowId,
    );
    const crmUpdated = await this.writeCandidates(workspaceId, valuesByRowId);

    return { ephemeralUpdated, crmUpdated };
  }

  private async getPeople(
    workspaceId: string,
    projectId: string,
  ): Promise<OutreachWorkingSetRow[]> {
    const crmRows = await this.getCrmPeople(workspaceId, projectId);
    const crmLinkedinKeys = new Set(
      crmRows
        .map((row) => normalizeLinkedinKey(row.linkedinUrl ?? ''))
        .filter(isNonEmptyString),
    );
    const payload = await this.outreachPeopleCacheService.get(
      workspaceId,
      projectId,
    );
    const ephemeralRows: OutreachWorkingSetRow[] = (payload?.people ?? [])
      .filter((person) => {
        const key = normalizeLinkedinKey(person.linkedinUrl);

        return !(isNonEmptyString(key) && crmLinkedinKeys.has(key));
      })
      .map((person) => ({
        id: person.id,
        source: 'ephemeral' as const,
        name: person.name,
        title: person.title,
        headline: person.headline,
        companyName: person.companyName,
        linkedinUrl: person.linkedinUrl,
        otherFields: toRecord(person.otherFields),
      }));

    return [...crmRows, ...ephemeralRows];
  }

  // CRM companies tagged to the project (company.projectIds) plus the
  // ephemeral Find list. A company in both is shown once, as the CRM record.
  private async getCompanies(
    workspaceId: string,
    projectId: string,
  ): Promise<OutreachWorkingSetRow[]> {
    const crmRows = await this.getCrmCompanies(workspaceId, projectId);
    const crmKeys = new Set(crmRows.map(companyIdentityKey));
    const payload = await this.outreachCompaniesCacheService.get(
      workspaceId,
      projectId,
    );
    const ephemeralRows: OutreachWorkingSetRow[] = (payload?.companies ?? [])
      .filter((company) => !crmKeys.has(companyIdentityKey(company)))
      .map((company) => ({
        id: company.id,
        source: 'ephemeral' as const,
        name: company.name,
        domain: company.domain,
        industry: company.industry,
        employees: company.employees,
        segment: company.segment,
        icpFit: company.icpFit,
        otherFields: toRecord(company.otherFields),
      }));

    return [...crmRows, ...ephemeralRows];
  }

  async getCrmCompanies(
    workspaceId: string,
    projectId: string,
  ): Promise<OutreachWorkingSetRow[]> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const companyRepository =
          await this.globalWorkspaceOrmManager.getRepository<CompanyRecord>(
            workspaceId,
            'company',
            { shouldBypassPermissionChecks: true },
          );
        const companies = await companyRepository.find({
          take: CRM_COMPANY_LIMIT,
        });

        return companies
          .filter((company) => projectIdsHasProject(company.projectIds, projectId))
          .map((company) => ({
            id: company.id,
            source: 'crm' as const,
            name: company.name ?? '',
            domain: company.domainName?.primaryLinkUrl ?? undefined,
            industry: company.industry ?? undefined,
            employees:
              company.employees === null || company.employees === undefined
                ? undefined
                : String(company.employees),
            segment: company.icpSegment ?? undefined,
            icpFit: company.icpFit ?? undefined,
            otherFields: toRecord(company.otherFields),
          }));
      },
      authContext,
    );
  }

  private async getCrmPeople(
    workspaceId: string,
    projectId: string,
  ): Promise<OutreachWorkingSetRow[]> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );
        const candidates = await candidateRepository.find({
          where: { projectId },
          select: {
            id: true,
            name: true,
            peopleId: true,
            otherFields: true,
          },
          take: CRM_CANDIDATE_LIMIT,
        });

        const personIds = candidates
          .map((candidate) => candidate.peopleId)
          .filter(isNonEmptyString);
        const personById = new Map<string, PersonRecord>();

        if (personIds.length > 0) {
          const personRepository =
            await this.globalWorkspaceOrmManager.getRepository<PersonRecord>(
              workspaceId,
              'person',
              { shouldBypassPermissionChecks: true },
            );
          const people = await personRepository.find({
            where: { id: In(personIds) },
          });

          for (const person of people) {
            personById.set(person.id, person);
          }
        }

        return candidates.map((candidate) => {
          const person = isNonEmptyString(candidate.peopleId)
            ? personById.get(candidate.peopleId)
            : undefined;

          return {
            id: candidate.id,
            source: 'crm' as const,
            name: candidate.name ?? '',
            title: person?.jobTitle ?? undefined,
            companyName: person?.jobCompanyName ?? undefined,
            locationName: person?.locationName ?? undefined,
            linkedinUrl: person?.linkedinLink?.primaryLinkUrl ?? undefined,
            otherFields: toRecord(candidate.otherFields),
          };
        });
      },
      authContext,
    );
  }

  private async writeEphemeralPeople(
    workspaceId: string,
    projectId: string,
    valuesByRowId: Map<string, Record<string, unknown>>,
  ): Promise<number> {
    const payload = await this.outreachPeopleCacheService.get(
      workspaceId,
      projectId,
    );

    if (!isDefined(payload)) {
      return 0;
    }

    let updated = 0;
    const people = payload.people.map((person) => {
      const values = valuesByRowId.get(person.id);

      if (!isDefined(values)) {
        return person;
      }

      updated += 1;

      return {
        ...person,
        otherFields: mergeOtherFieldValues(person.otherFields, values),
      };
    });

    if (updated > 0) {
      await this.outreachPeopleCacheService.set(
        workspaceId,
        projectId,
        people,
      );
    }

    return updated;
  }

  private async writeEphemeralCompanies(
    workspaceId: string,
    projectId: string,
    valuesByRowId: Map<string, Record<string, unknown>>,
  ): Promise<number> {
    const payload = await this.outreachCompaniesCacheService.get(
      workspaceId,
      projectId,
    );

    if (!isDefined(payload)) {
      return 0;
    }

    let updated = 0;
    const companies = payload.companies.map((company) => {
      const values = valuesByRowId.get(company.id);

      if (!isDefined(values)) {
        return company;
      }

      updated += 1;

      return {
        ...company,
        otherFields: mergeOtherFieldValues(company.otherFields, values),
      };
    });

    if (updated > 0) {
      await this.outreachCompaniesCacheService.set(
        workspaceId,
        projectId,
        companies,
      );
    }

    return updated;
  }

  private async writeCompanies(
    workspaceId: string,
    valuesByRowId: Map<string, Record<string, unknown>>,
  ): Promise<number> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const companyRepository =
          await this.globalWorkspaceOrmManager.getRepository<CompanyRecord>(
            workspaceId,
            'company',
            { shouldBypassPermissionChecks: true },
          );
        const ids = crmIds(valuesByRowId);

        if (ids.length === 0) {
          return 0;
        }

        const companies = await companyRepository.find({
          where: { id: In(ids) },
        });

        for (const company of companies) {
          const values = valuesByRowId.get(company.id);

          if (!isDefined(values)) {
            continue;
          }

          await companyRepository.update(company.id, {
            otherFields: mergeOtherFieldValues(company.otherFields, values),
          } as QueryDeepPartialEntity<CompanyRecord>);
        }

        return companies.length;
      },
      authContext,
    );
  }

  private async writeCandidates(
    workspaceId: string,
    valuesByRowId: Map<string, Record<string, unknown>>,
  ): Promise<number> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const candidateRepository =
          await this.globalWorkspaceOrmManager.getRepository<CandidateRecord>(
            workspaceId,
            'candidate',
            { shouldBypassPermissionChecks: true },
          );
        const ids = crmIds(valuesByRowId);

        if (ids.length === 0) {
          return 0;
        }

        const candidates = await candidateRepository.find({
          where: { id: In(ids) },
          select: { id: true, otherFields: true },
        });

        for (const candidate of candidates) {
          const values = valuesByRowId.get(candidate.id);

          if (!isDefined(values)) {
            continue;
          }

          await candidateRepository.update(candidate.id, {
            otherFields: mergeOtherFieldValues(candidate.otherFields, values),
          } as QueryDeepPartialEntity<CandidateRecord>);
        }

        return candidates.length;
      },
      authContext,
    );
  }
}
