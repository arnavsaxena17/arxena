import { Injectable, Logger } from '@nestjs/common';
import { v4 } from 'uuid';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { buildCreatedByFromSystem } from 'src/engine/core-modules/actor/utils/build-created-by-from-system.util';
import type { CompanySearchHit } from 'src/engine/core-modules/company-api/company-api.types';
import { CompanySearchHitTransformer } from 'src/engine/core-modules/company-api/services/company-search-hit.transformer';
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
};

type ProjectRecord = ObjectLiteral & {
  id: string;
};

export type UpsertCompaniesInput = {
  projectId?: string;
  companies?: unknown;
  limit?: number;
};

const normalizeUrl = (value?: string | null): string => {
  if (!isNonEmptyString(value)) {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
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
  const primaryLinkLabel = normalizeUrl(primaryLinkUrl).split('/')[0] ?? '';

  return {
    primaryLinkUrl,
    primaryLinkLabel,
  };
};

const companyLinkedinUrl = (row: CompanyRecord): string =>
  row.linkedinLink?.primaryLinkUrl ?? row.linkedinLinkPrimaryLinkUrl ?? '';

const companyWebsiteUrl = (row: CompanyRecord): string =>
  row.domainName?.primaryLinkUrl ?? row.domainNamePrimaryLinkUrl ?? '';

const extractLinkedinCompanyId = (hit: CompanySearchHit): string => {
  if (/^\d+$/.test(hit.id.trim())) {
    return hit.id.trim();
  }

  const fromUrl = hit.linkedinUrl.match(
    /linkedin\.com\/(?:company|school|showcase)\/(\d+)/i,
  );

  if (fromUrl?.[1]) {
    return fromUrl[1];
  }

  if (
    isNonEmptyString(hit.id) &&
    !hit.id.includes('/') &&
    !hit.id.includes('http')
  ) {
    return hit.id.trim();
  }

  return '';
};

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
        const existing = await companyRepository.find({
          take: 5000,
        });

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
          const normalizedLinkedin = normalizeUrl(linkedinUrl);
          const normalizedDomain = normalizeUrl(website);

          if (
            !isNonEmptyString(name) &&
            !normalizedLinkedin &&
            !normalizedDomain &&
            !isNonEmptyString(linkedinId)
          ) {
            skipped += 1;
            continue;
          }

          const match = existing.find((row) => {
            const rowLinkedin = normalizeUrl(companyLinkedinUrl(row));
            const rowDomain = normalizeUrl(companyWebsiteUrl(row));
            const rowLinkedinId = (row.linkedinId ?? '').trim();

            return (
              (isNonEmptyString(linkedinId) && rowLinkedinId === linkedinId) ||
              (normalizedLinkedin.length > 0 &&
                rowLinkedin === normalizedLinkedin) ||
              (normalizedDomain.length > 0 && rowDomain === normalizedDomain) ||
              (isNonEmptyString(name) &&
                (row.name ?? '').trim().toLowerCase() === name.toLowerCase())
            );
          });

          const nextGtmRunKey = appendGtmRunKey(match?.gtmRunKey, projectId);
          const patch = pickWritable(
            {
              ...(domainLink && !normalizeUrl(companyWebsiteUrl(match ?? {}))
                ? { domainName: domainLink }
                : {}),
              ...(linkedinLink && !normalizeUrl(companyLinkedinUrl(match ?? {}))
                ? { linkedinLink }
                : {}),
              ...(isNonEmptyString(linkedinId) &&
              !isNonEmptyString(match?.linkedinId)
                ? { linkedinId }
                : {}),
              ...(!gtmRunKeyHasProject(match?.gtmRunKey, projectId)
                ? { gtmRunKey: nextGtmRunKey }
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
}
