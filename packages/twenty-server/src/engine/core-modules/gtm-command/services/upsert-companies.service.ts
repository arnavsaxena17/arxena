import { Injectable, Logger } from '@nestjs/common';
import { v4 } from 'uuid';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { In, type ObjectLiteral } from 'typeorm';

import { buildCreatedByFromSystem } from 'src/engine/core-modules/actor/utils/build-created-by-from-system.util';
import type { CompanySearchHit } from 'src/engine/core-modules/company-api/company-api.types';
import { CompanySearchHitTransformer } from 'src/engine/core-modules/company-api/services/company-search-hit.transformer';
import {
  companyLinkedinUrl as identityCompanyLinkedinUrl,
  companyWebsiteUrl as identityCompanyWebsiteUrl,
  extractLinkedinCompanyId,
  findMatchingCompanyRecord,
  normalizeCompanyUrl,
} from 'src/engine/core-modules/company-api/utils/company-identity.util';
import { appendGtmRunKey, gtmRunKeyHasProject } from 'src/engine/core-modules/gtm-command/utils/gtm-run-key.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CompanyRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  domainName?: { primaryLinkUrl?: string | null } | null;
  domainNamePrimaryLinkUrl?: string | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  linkedinLinkPrimaryLinkUrl?: string | null;
  linkedinId?: string | null;
  gtmRunKey?: string | string[] | null;
  gtmFunnelStage?: string | null;
};

type ProjectRecord = ObjectLiteral & {
  id: string;
};

export type UpsertCompaniesInput = {
  projectId?: string;
  companies?: unknown;
  limit?: number;
};

const toPrimaryLink = (url: string) => {
  if (!isNonEmptyString(url)) {
    return null;
  }

  let href = url.trim();

  try {
    const parsed = new URL(href.includes('://') ? href : `https://${href}`);
    href = parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname);
  } catch {
    href = href.split(/[?#]/)[0] ?? href;
  }

  href = href.replace(/\/+$/, '');

  const primaryLinkUrl = href.startsWith('http') ? href : `https://${href}`;
  const primaryLinkLabel = normalizeCompanyUrl(primaryLinkUrl).split('/')[0] ?? '';

  return {
    primaryLinkUrl,
    primaryLinkLabel,
  };
};

const companyLinkedinUrl = (row: CompanyRecord): string =>
  identityCompanyLinkedinUrl(row);

const companyWebsiteUrl = (row: CompanyRecord): string =>
  identityCompanyWebsiteUrl(row);

const columnNamesFromRepository = (repository: {
  metadata?: { columns?: Array<{ propertyName?: string }> };
}): Set<string> =>
  new Set(
    (repository.metadata?.columns ?? [])
      .map((column) => column.propertyName)
      .filter((name): name is string => isNonEmptyString(name)),
  );

const pickWritable = (
  payload: Record<string, unknown>,
  columns: Set<string>,
): Record<string, unknown> => {
  const writable: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) {
      continue;
    }

    const exists =
      columns.size === 0 ||
      columns.has(key) ||
      (key === 'domainName' && columns.has('domainNamePrimaryLinkUrl')) ||
      (key === 'linkedinLink' && columns.has('linkedinLinkPrimaryLinkUrl')) ||
      (key === 'createdBy' && columns.has('createdBySource'));

    if (exists) {
      writable[key] = value;
    }
  }

  return writable;
};

@Injectable()
export class UpsertCompaniesService {
  private readonly logger = new Logger(UpsertCompaniesService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly companySearchHitTransformer: CompanySearchHitTransformer,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: UpsertCompaniesInput;
  }): Promise<{
    success: boolean;
    created: number;
    updated: number;
    skipped: number;
    projectId: string;
    companyIds: string[];
    error?: string;
  }> {
    const projectId = input.projectId?.trim() ?? '';
    const companies = this.companySearchHitTransformer.fromUnknownInput(
      input.companies,
    );
    const limit = Math.min(Math.max(1, input.limit ?? 25), 50);

    if (!isNonEmptyString(projectId)) {
      return {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        projectId: '',
        companyIds: [],
        error: 'projectId is required',
      };
    }

    const hits = companies.slice(0, limit);

    if (hits.length === 0) {
      return {
        success: false,
        created: 0,
        updated: 0,
        skipped: 0,
        projectId,
        companyIds: [],
        error: 'companies is required',
      };
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const companyRepository =
          await this.globalWorkspaceOrmManager.getRepository<CompanyRecord>(
            workspaceId,
            'company',
            { shouldBypassPermissionChecks: true },
          );
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );

        const project = await projectRepository.findOne({
          where: { id: projectId },
          select: ['id'],
        });

        if (!isDefined(project)) {
          return {
            success: false,
            created: 0,
            updated: 0,
            skipped: 0,
            projectId,
            companyIds: [],
            error: 'Project not found',
          };
        }

        const columns = columnNamesFromRepository(companyRepository);
        const existing = await this.loadExistingCompanies(
          companyRepository,
          hits,
          columns,
        );

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const companyIds: string[] = [];

        for (const hit of hits) {
          const name = hit.name.trim();
          const website = hit.website.trim();
          const linkedinUrl = hit.linkedinUrl.trim();
          const linkedinId = extractLinkedinCompanyId(hit);
          const domainLink = toPrimaryLink(website);
          const linkedinLink = toPrimaryLink(linkedinUrl);
          const normalizedLinkedin = normalizeCompanyUrl(linkedinUrl);
          const normalizedDomain = normalizeCompanyUrl(website);

          if (
            !isNonEmptyString(name) &&
            !normalizedLinkedin &&
            !normalizedDomain &&
            !isNonEmptyString(linkedinId)
          ) {
            skipped += 1;
            continue;
          }

          const match = findMatchingCompanyRecord(hit, existing);

          const nextGtmRunKey = appendGtmRunKey(match?.gtmRunKey, projectId);
          const patch = pickWritable(
            {
              ...(domainLink && !normalizeCompanyUrl(companyWebsiteUrl(match ?? {}))
                ? { domainName: domainLink }
                : {}),
              ...(linkedinLink &&
              !normalizeCompanyUrl(companyLinkedinUrl(match ?? {}))
                ? { linkedinLink }
                : {}),
              ...(isNonEmptyString(linkedinId) &&
              !isNonEmptyString(match?.linkedinId)
                ? { linkedinId }
                : {}),
              ...(!gtmRunKeyHasProject(match?.gtmRunKey, projectId)
                ? { gtmRunKey: nextGtmRunKey }
                : {}),
              ...(!isNonEmptyString(match?.gtmFunnelStage)
                ? { gtmFunnelStage: 'ADDED' }
                : {}),
            },
            columns,
          );

          if (isDefined(match)) {
            if (Object.keys(patch).length === 0) {
              skipped += 1;
              companyIds.push(match.id);
              continue;
            }

            await companyRepository.update(match.id, patch);
            Object.assign(match, patch, {
              domainNamePrimaryLinkUrl:
                domainLink?.primaryLinkUrl ?? match.domainNamePrimaryLinkUrl,
              linkedinLinkPrimaryLinkUrl:
                linkedinLink?.primaryLinkUrl ??
                match.linkedinLinkPrimaryLinkUrl,
              linkedinId: linkedinId || match.linkedinId,
              gtmRunKey: nextGtmRunKey,
            });
            updated += 1;
            companyIds.push(match.id);
            continue;
          }

          const id = v4();
          const record = pickWritable(
            {
              id,
              name: name || website || linkedinUrl,
              ...(domainLink ? { domainName: domainLink } : {}),
              ...(linkedinLink ? { linkedinLink } : {}),
              ...(isNonEmptyString(linkedinId) ? { linkedinId } : {}),
              gtmRunKey: appendGtmRunKey(null, projectId),
              gtmFunnelStage: 'ADDED',
              createdBy: buildCreatedByFromSystem(),
            },
            columns,
          );

          await companyRepository.save(record);
          existing.push({
            ...record,
            domainNamePrimaryLinkUrl: domainLink?.primaryLinkUrl,
            linkedinLinkPrimaryLinkUrl: linkedinLink?.primaryLinkUrl,
            linkedinId,
            gtmRunKey: appendGtmRunKey(null, projectId),
          });
          created += 1;
          companyIds.push(id);
        }

        this.logger.log(
          `upsert-companies project=${projectId} created=${created} updated=${updated} skipped=${skipped}`,
        );

        return {
          success: true,
          created,
          updated,
          skipped,
          projectId,
          companyIds,
        };
      },
      authContext,
    );
  }

  private async loadExistingCompanies(
    companyRepository: {
      find: (options?: {
        take?: number;
        where?: Array<Record<string, unknown>> | Record<string, unknown>;
      }) => Promise<CompanyRecord[]>;
    },
    hits: CompanySearchHit[],
    columns: Set<string>,
  ): Promise<CompanyRecord[]> {
    const linkedinIds = [
      ...new Set(
        hits
          .map((hit) => extractLinkedinCompanyId(hit))
          .filter((id) => isNonEmptyString(id)),
      ),
    ];
    const names = [
      ...new Set(
        hits
          .map((hit) => hit.name.trim())
          .filter((name) => isNonEmptyString(name)),
      ),
    ];
    const where: Array<Record<string, unknown>> = [];

    if (linkedinIds.length > 0 && (columns.size === 0 || columns.has('linkedinId'))) {
      where.push({ linkedinId: In(linkedinIds) });
    }

    if (names.length > 0 && (columns.size === 0 || columns.has('name'))) {
      where.push({ name: In(names) });
    }

    if (where.length === 0) {
      return companyRepository.find({ take: 5000 });
    }

    return companyRepository.find({ where });
  }
}
