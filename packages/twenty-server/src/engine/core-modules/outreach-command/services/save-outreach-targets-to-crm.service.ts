import { Injectable, Logger } from '@nestjs/common';
import { v4 } from 'uuid';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';

import { buildCreatedByFromSystem } from 'src/engine/core-modules/actor/utils/build-created-by-from-system.util';
import {
  type OutreachEphemeralCompany,
  OutreachCompaniesCacheService,
} from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import {
  type OutreachEphemeralPerson,
  OutreachPeopleCacheService,
} from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { UpsertCompaniesService } from 'src/engine/core-modules/outreach-command/services/upsert-companies.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type PersonRecord = ObjectLiteral & {
  id: string;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  linkedinLinkPrimaryLinkUrl?: string | null;
  jobTitle?: string | null;
  companyId?: string | null;
};

export type SaveOutreachTargetsToCrmInput = {
  projectId: string;
  target: 'companies' | 'people' | 'both';
  // Ephemeral ids from the tab. Empty or missing saves every row on the tab.
  companyIds?: string[];
  personIds?: string[];
};

export type SaveOutreachTargetsToCrmResult = {
  success: boolean;
  error?: string;
  companies: { created: number; matched: number; skipped: number };
  people: { created: number; matched: number; skipped: number };
  // ephemeral id -> CRM id, so the caller can link or navigate.
  crmCompanyIdByEphemeralId: Record<string, string>;
  crmPersonIdByEphemeralId: Record<string, string>;
};

const MAX_ROWS_PER_CALL = 500;

const normalizeLinkedinUrl = (linkedinUrl: string): string =>
  linkedinUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .split('?')[0];

const toHttpsUrl = (value: string): string => {
  const trimmed = value.trim();

  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
};

const emptyCounts = () => ({ created: 0, matched: 0, skipped: 0 });

@Injectable()
export class SaveOutreachTargetsToCrmService {
  private readonly logger = new Logger(SaveOutreachTargetsToCrmService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly outreachCompaniesCacheService: OutreachCompaniesCacheService,
    private readonly outreachPeopleCacheService: OutreachPeopleCacheService,
    private readonly upsertCompaniesService: UpsertCompaniesService,
  ) {}

  // Saves ephemeral Find-tab rows as plain Company / Person records. It never
  // creates a Candidate: enrollment stays a separate, explicit step.
  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: SaveOutreachTargetsToCrmInput;
  }): Promise<SaveOutreachTargetsToCrmResult> {
    const result: SaveOutreachTargetsToCrmResult = {
      success: true,
      companies: emptyCounts(),
      people: emptyCounts(),
      crmCompanyIdByEphemeralId: {},
      crmPersonIdByEphemeralId: {},
    };
    const projectId = input.projectId.trim();

    if (!isNonEmptyString(projectId)) {
      return { ...result, success: false, error: 'projectId is required' };
    }

    const [companiesPayload, peoplePayload] = await Promise.all([
      this.outreachCompaniesCacheService.get(workspaceId, projectId),
      this.outreachPeopleCacheService.get(workspaceId, projectId),
    ]);
    const tabCompanies = companiesPayload?.companies ?? [];
    const tabPeople = peoplePayload?.people ?? [];

    const wantsPeople = input.target === 'people' || input.target === 'both';
    const wantsCompanies =
      input.target === 'companies' || input.target === 'both';

    const selectedPeople = wantsPeople
      ? this.select(tabPeople, input.personIds).slice(0, MAX_ROWS_PER_CALL)
      : [];
    const selectedCompanies = wantsCompanies
      ? this.select(tabCompanies, input.companyIds)
      : [];

    // People need their employer in the CRM, so a people save also saves the
    // Companies-tab rows those people point at.
    const companyById = new Map(tabCompanies.map((row) => [row.id, row]));
    const companiesToSave = new Map<string, OutreachEphemeralCompany>();

    for (const company of selectedCompanies) {
      companiesToSave.set(company.id, company);
    }

    for (const person of selectedPeople) {
      const company = companyById.get(person.companyId);

      if (isDefined(company)) {
        companiesToSave.set(company.id, company);
      }
    }

    const companiesInScope = [...companiesToSave.values()].slice(
      0,
      MAX_ROWS_PER_CALL,
    );

    if (companiesInScope.length === 0 && selectedPeople.length === 0) {
      return {
        ...result,
        success: false,
        error:
          'No matching rows on the Companies / People tab for this project',
      };
    }

    for (const company of companiesInScope) {
      const outcome = await this.saveCompany({
        workspaceId,
        projectId,
        company,
      });

      if (outcome.status === 'skipped') {
        result.companies.skipped += 1;
        continue;
      }

      result.companies[outcome.status] += 1;
      result.crmCompanyIdByEphemeralId[company.id] = outcome.crmId;
    }

    if (selectedPeople.length > 0) {
      await this.savePeople({
        workspaceId,
        people: selectedPeople,
        companyById,
        result,
      });
    }

    this.logger.log(
      `save-to-crm project=${projectId} companies=${JSON.stringify(result.companies)} people=${JSON.stringify(result.people)}`,
    );

    return result;
  }

  private select<TRow extends { id: string }>(
    rows: TRow[],
    ids: string[] | undefined,
  ): TRow[] {
    if (!isDefined(ids) || ids.length === 0) {
      return rows;
    }

    const wanted = new Set(ids);

    return rows.filter((row) => wanted.has(row.id));
  }

  private async saveCompany({
    workspaceId,
    projectId,
    company,
  }: {
    workspaceId: string;
    projectId: string;
    company: OutreachEphemeralCompany;
  }): Promise<
    | { status: 'created' | 'matched'; crmId: string }
    | { status: 'skipped'; crmId?: undefined }
  > {
    const linkedinUrl = company.otherFields?.linkedinUrl;
    const outcome = await this.upsertCompaniesService.execute({
      workspaceId,
      input: {
        projectId,
        companies: [
          {
            name: company.name,
            website: company.domain,
            industry: company.industry,
            ...(typeof linkedinUrl === 'string' ? { linkedinUrl } : {}),
          },
        ],
      },
    });
    const crmId = outcome.companyIds[0];

    if (!outcome.success || !isNonEmptyString(crmId)) {
      return { status: 'skipped' };
    }

    return { status: outcome.created > 0 ? 'created' : 'matched', crmId };
  }

  private async savePeople({
    workspaceId,
    people,
    companyById,
    result,
  }: {
    workspaceId: string;
    people: OutreachEphemeralPerson[];
    companyById: Map<string, OutreachEphemeralCompany>;
    result: SaveOutreachTargetsToCrmResult;
  }): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const personRepository =
        await this.globalWorkspaceOrmManager.getRepository<PersonRecord>(
          workspaceId,
          'person',
          { shouldBypassPermissionChecks: true },
        );

      const urls = people
        .map((person) => normalizeLinkedinUrl(person.linkedinUrl))
        .filter((url) => isNonEmptyString(url));
      const urlVariants = [
        ...new Set(
          urls.flatMap((url) => [
            `https://${url}`,
            `https://www.${url}`,
            `http://${url}`,
            `https://${url}/`,
          ]),
        ),
      ];
      const existing =
        urlVariants.length > 0
          ? await personRepository.find({
              where: { linkedinLink: { primaryLinkUrl: In(urlVariants) } },
            })
          : [];
      const existingByUrl = new Map<string, PersonRecord>();

      for (const record of existing) {
        const url = normalizeLinkedinUrl(
          record.linkedinLink?.primaryLinkUrl ??
            record.linkedinLinkPrimaryLinkUrl ??
            '',
        );

        if (isNonEmptyString(url)) {
          existingByUrl.set(url, record);
        }
      }

      for (const person of people) {
        const normalizedUrl = normalizeLinkedinUrl(person.linkedinUrl);
        const name = person.name.trim();

        // Without a LinkedIn URL there is no safe identity to dedupe on, and
        // a name-only match would merge different people.
        if (!isNonEmptyString(name) || !isNonEmptyString(normalizedUrl)) {
          result.people.skipped += 1;
          continue;
        }

        const match = existingByUrl.get(normalizedUrl);

        if (isDefined(match)) {
          result.people.matched += 1;
          result.crmPersonIdByEphemeralId[person.id] = match.id;
          continue;
        }

        const ephemeralCompany = companyById.get(person.companyId);
        const crmCompanyId = isDefined(ephemeralCompany)
          ? result.crmCompanyIdByEphemeralId[ephemeralCompany.id]
          : undefined;
        const nameParts = name.split(/\s+/);
        const id = v4();

        try {
          await personRepository.save({
            id,
            name: {
              firstName: nameParts[0] ?? '',
              lastName: nameParts.slice(1).join(' '),
            },
            jobTitle: person.title,
            ...(isNonEmptyString(person.companyName)
              ? { jobCompanyName: person.companyName }
              : {}),
            ...(isNonEmptyString(crmCompanyId)
              ? { companyId: crmCompanyId }
              : {}),
            ...(isNonEmptyString(person.email)
              ? { emails: { primaryEmail: person.email } }
              : {}),
            linkedinLink: {
              primaryLinkUrl: toHttpsUrl(person.linkedinUrl),
              primaryLinkLabel: normalizedUrl,
            },
            createdBy: buildCreatedByFromSystem(),
          });
        } catch (error) {
          this.logger.warn(
            `save-to-crm failed for person ${person.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          result.people.skipped += 1;
          continue;
        }

        existingByUrl.set(normalizedUrl, { id });
        result.people.created += 1;
        result.crmPersonIdByEphemeralId[person.id] = id;
      }
    }, authContext);
  }
}
