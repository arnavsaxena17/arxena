import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { projectIdsHasProject } from 'src/engine/core-modules/outreach-command/utils/project-ids.util';
import { OutreachCompaniesCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { OutreachPeopleCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { resolvePeopleCompanyIds } from 'src/engine/core-modules/outreach-command/utils/resolve-people-company-ids.util';
import { buildPeopleFoundValues } from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';
import { type OutreachTableTab } from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';
import { stripAiColumnKeys } from 'src/engine/core-modules/outreach-command/utils/strip-ai-column-keys.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

export type OutreachTabRow = {
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

export type OutreachTabPage = {
  total: number;
  // AI columns already on these rows: reuse them before adding a new one
  aiColumns: OutreachExistingAiColumn[];
  rows: OutreachTabRow[];
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
    : `name:${(company.name ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()}`;
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
export class OutreachTabService {
  constructor(
    private readonly outreachPeopleCacheService: OutreachPeopleCacheService,
    private readonly outreachCompaniesCacheService: OutreachCompaniesCacheService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async getPage({
    workspaceId,
    projectId,
    tab,
    limit,
    cursor,
  }: {
    workspaceId: string;
    projectId: string;
    tab: OutreachTableTab;
    limit: number;
    cursor?: string;
  }): Promise<OutreachTabPage> {
    const all = await this.getAll({ workspaceId, projectId, tab });
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

  private collectAiColumns(rows: OutreachTabRow[]): OutreachExistingAiColumn[] {
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
    tab,
  }: {
    workspaceId: string;
    projectId: string;
    tab: OutreachTableTab;
  }): Promise<OutreachTabRow[]> {
    return tab === 'people'
      ? this.getPeople(workspaceId, projectId)
      : this.getCompanies(workspaceId, projectId);
  }

  async getRowsByIds({
    workspaceId,
    projectId,
    tab,
    ids,
  }: {
    workspaceId: string;
    projectId: string;
    tab: OutreachTableTab;
    ids: string[];
  }): Promise<OutreachTabRow[]> {
    const wanted = new Set(ids);
    const all = await this.getAll({ workspaceId, projectId, tab });

    return all.filter((row) => wanted.has(row.id));
  }

  // Adds each row's new keys next to its existing otherFields, on the
  // ephemeral list and on the CRM candidate.
  async writeOtherFields(args: {
    workspaceId: string;
    projectId: string;
    tab: OutreachTableTab;
    valuesByRowId: Map<string, Record<string, unknown>>;
  }): Promise<{ ephemeralUpdated: number; crmUpdated: number }> {
    return this.enqueueOtherFieldsWrite(args, 'merge');
  }

  // Drops AI column value keys and their aiColumns meta from every row in
  // the project tab (ephemeral Find list + CRM).
  async removeAiColumns({
    workspaceId,
    projectId,
    tab,
    columnKeys,
  }: {
    workspaceId: string;
    projectId: string;
    tab: OutreachTableTab;
    columnKeys: string[];
  }): Promise<{
    ephemeralUpdated: number;
    crmUpdated: number;
    columnKeys: string[];
    rowsTouched: number;
  }> {
    const keys = [
      ...new Set(columnKeys.filter((key) => isNonEmptyString(key))),
    ];

    if (keys.length === 0) {
      return {
        ephemeralUpdated: 0,
        crmUpdated: 0,
        columnKeys: [],
        rowsTouched: 0,
      };
    }

    const rows = await this.getAll({ workspaceId, projectId, tab });
    const valuesByRowId = new Map<string, Record<string, unknown>>();

    for (const row of rows) {
      const stripped = stripAiColumnKeys(row.otherFields, keys);

      if (!isDefined(stripped)) {
        continue;
      }

      valuesByRowId.set(row.id, stripped);
    }

    if (valuesByRowId.size === 0) {
      return {
        ephemeralUpdated: 0,
        crmUpdated: 0,
        columnKeys: keys,
        rowsTouched: 0,
      };
    }

    const written = await this.enqueueOtherFieldsWrite(
      { workspaceId, projectId, tab, valuesByRowId },
      'replace',
    );

    return {
      ...written,
      columnKeys: keys,
      rowsTouched: valuesByRowId.size,
    };
  }

  private enqueueOtherFieldsWrite(
    args: {
      workspaceId: string;
      projectId: string;
      tab: OutreachTableTab;
      valuesByRowId: Map<string, Record<string, unknown>>;
    },
    mode: 'merge' | 'replace',
  ): Promise<{ ephemeralUpdated: number; crmUpdated: number }> {
    // Each write reads and rewrites the whole ephemeral list, so concurrent
    // writes to one project (25 companies finishing together) would overwrite
    // each other; they run one after another instead.
    const key = `${args.workspaceId}:${args.projectId}:${args.tab}`;
    const previous = this.writeQueues.get(key) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(() => this.writeOtherFieldsNow(args, mode));
    const tail = run.catch(() => undefined);

    this.writeQueues.set(key, tail);
    void tail.then(() => {
      if (this.writeQueues.get(key) === tail) {
        this.writeQueues.delete(key);
      }
    });

    return run;
  }

  private readonly writeQueues = new Map<string, Promise<unknown>>();

  private async writeOtherFieldsNow(
    {
      workspaceId,
      projectId,
      tab,
      valuesByRowId,
    }: {
      workspaceId: string;
      projectId: string;
      tab: OutreachTableTab;
      valuesByRowId: Map<string, Record<string, unknown>>;
    },
    mode: 'merge' | 'replace' = 'merge',
  ): Promise<{ ephemeralUpdated: number; crmUpdated: number }> {
    if (valuesByRowId.size === 0) {
      return { ephemeralUpdated: 0, crmUpdated: 0 };
    }

    if (tab === 'companies') {
      return {
        ephemeralUpdated: await this.writeEphemeralCompanies(
          workspaceId,
          projectId,
          valuesByRowId,
          mode,
        ),
        crmUpdated: await this.writeCompanies(workspaceId, valuesByRowId, mode),
      };
    }

    const ephemeralUpdated = await this.writeEphemeralPeople(
      workspaceId,
      projectId,
      valuesByRowId,
      mode,
    );
    const crmUpdated = await this.writeCandidates(
      workspaceId,
      valuesByRowId,
      mode,
    );

    return { ephemeralUpdated, crmUpdated };
  }

  // Fills the "People found" / "People count" columns of companies from the
  // people already on the tab, so companies searched before those columns
  // existed (or found through another provider) get them without a re-run.
  // A company with no people stays blank: nothing says it was searched.
  // "Not found" and "Related role only" come from a lookup and are kept
  // unless people now exist for the company.
  async syncPeopleFound({
    workspaceId,
    projectId,
  }: {
    workspaceId: string;
    projectId: string;
  }): Promise<{ updated: number }> {
    const [companiesPayload, peoplePayload] = await Promise.all([
      this.outreachCompaniesCacheService.get(workspaceId, projectId),
      this.outreachPeopleCacheService.get(workspaceId, projectId),
    ]);
    const companies = companiesPayload?.companies ?? [];

    if (companies.length === 0 || !isDefined(peoplePayload)) {
      return { updated: 0 };
    }

    const countByCompanyId = new Map<string, number>();
    const linkedPeople = resolvePeopleCompanyIds(
      peoplePayload.people,
      companies,
    );

    // save the link on the people too, so the People tab can scope by company
    if (
      linkedPeople.some(
        (person, index) =>
          person.companyId !== peoplePayload.people[index].companyId,
      )
    ) {
      await this.outreachPeopleCacheService.set(
        workspaceId,
        projectId,
        linkedPeople,
      );
    }

    for (const person of linkedPeople) {
      if (isNonEmptyString(person.companyId)) {
        countByCompanyId.set(
          person.companyId,
          (countByCompanyId.get(person.companyId) ?? 0) + 1,
        );
      }
    }

    const valuesByRowId = new Map<string, Record<string, unknown>>();

    for (const company of companies) {
      const count = countByCompanyId.get(company.id) ?? 0;
      const current = toRecord(company.otherFields);

      if (count === 0 || current.peopleFoundCount === count) {
        continue;
      }

      valuesByRowId.set(
        company.id,
        buildPeopleFoundValues(
          current.peopleFound === 'Related role only'
            ? 'Related role only'
            : 'Found',
          count,
        ),
      );
    }

    await this.writeOtherFields({
      workspaceId,
      projectId,
      tab: 'companies',
      valuesByRowId,
    });

    return { updated: valuesByRowId.size };
  }

  private async getPeople(
    workspaceId: string,
    projectId: string,
  ): Promise<OutreachTabRow[]> {
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
    const ephemeralRows: OutreachTabRow[] = (payload?.people ?? [])
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
  ): Promise<OutreachTabRow[]> {
    const crmRows = await this.getCrmCompanies(workspaceId, projectId);
    const crmKeys = new Set(crmRows.map(companyIdentityKey));
    const payload = await this.outreachCompaniesCacheService.get(
      workspaceId,
      projectId,
    );
    const ephemeralRows: OutreachTabRow[] = (payload?.companies ?? [])
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
  ): Promise<OutreachTabRow[]> {
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
          .filter((company) =>
            projectIdsHasProject(company.projectIds, projectId),
          )
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
  ): Promise<OutreachTabRow[]> {
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

  private applyOtherFields(
    existing: unknown,
    values: Record<string, unknown>,
    mode: 'merge' | 'replace',
  ): Record<string, unknown> {
    return mode === 'replace'
      ? values
      : mergeOtherFieldValues(existing, values);
  }

  private async writeEphemeralPeople(
    workspaceId: string,
    projectId: string,
    valuesByRowId: Map<string, Record<string, unknown>>,
    mode: 'merge' | 'replace' = 'merge',
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
        otherFields: this.applyOtherFields(person.otherFields, values, mode),
      };
    });

    if (updated > 0) {
      await this.outreachPeopleCacheService.set(workspaceId, projectId, people);
    }

    return updated;
  }

  private async writeEphemeralCompanies(
    workspaceId: string,
    projectId: string,
    valuesByRowId: Map<string, Record<string, unknown>>,
    mode: 'merge' | 'replace' = 'merge',
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
        otherFields: this.applyOtherFields(company.otherFields, values, mode),
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
    mode: 'merge' | 'replace' = 'merge',
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
            otherFields: this.applyOtherFields(
              company.otherFields,
              values,
              mode,
            ),
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
    mode: 'merge' | 'replace' = 'merge',
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
            otherFields: this.applyOtherFields(
              candidate.otherFields,
              values,
              mode,
            ),
          } as QueryDeepPartialEntity<CandidateRecord>);
        }

        return candidates.length;
      },
      authContext,
    );
  }
}
