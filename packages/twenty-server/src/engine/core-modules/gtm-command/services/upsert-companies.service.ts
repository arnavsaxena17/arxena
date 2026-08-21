import { Injectable, Logger } from '@nestjs/common';
import { v4 } from 'uuid';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { buildCreatedByFromSystem } from 'src/engine/core-modules/actor/utils/build-created-by-from-system.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CompanyRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  domainName?: { primaryLinkUrl?: string | null } | null;
  linkedinLink?: { primaryLinkUrl?: string | null } | null;
  gtmRunKey?: string | null;
};

export type UpsertCompaniesHit = {
  name?: string;
  website?: string;
  domain?: string;
  linkedinUrl?: string;
  industry?: string;
};

export type UpsertCompaniesInput = {
  projectId?: string;
  companies?: UpsertCompaniesHit[];
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
    .replace(/\/+$/, '');
};

const toPrimaryLink = (url: string) =>
  isNonEmptyString(url)
    ? { primaryLinkUrl: url.startsWith('http') ? url : `https://${url}`, primaryLinkLabel: '' }
    : null;

@Injectable()
export class UpsertCompaniesService {
  private readonly logger = new Logger(UpsertCompaniesService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
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
    const companies = Array.isArray(input.companies) ? input.companies : [];
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

        const existing = await companyRepository.find({
          select: ['id', 'name', 'domainName', 'linkedinLink', 'gtmRunKey'],
          take: 5000,
        });

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const companyIds: string[] = [];

        for (const hit of hits) {
          const name = hit.name?.trim() ?? '';
          const website = (hit.website ?? hit.domain ?? '').trim();
          const linkedinUrl = hit.linkedinUrl?.trim() ?? '';
          const normalizedLinkedin = normalizeUrl(linkedinUrl);
          const normalizedDomain = normalizeUrl(website);

          if (!isNonEmptyString(name) && !normalizedLinkedin && !normalizedDomain) {
            skipped += 1;
            continue;
          }

          const match = existing.find((row) => {
            const rowLinkedin = normalizeUrl(row.linkedinLink?.primaryLinkUrl);
            const rowDomain = normalizeUrl(row.domainName?.primaryLinkUrl);

            return (
              (normalizedLinkedin.length > 0 && rowLinkedin === normalizedLinkedin) ||
              (normalizedDomain.length > 0 && rowDomain === normalizedDomain) ||
              (isNonEmptyString(name) &&
                (row.name ?? '').trim().toLowerCase() === name.toLowerCase())
            );
          });

          if (isDefined(match)) {
            if (match.gtmRunKey === projectId) {
              skipped += 1;
              companyIds.push(match.id);
              continue;
            }

            await companyRepository.update(match.id, { gtmRunKey: projectId });
            match.gtmRunKey = projectId;
            updated += 1;
            companyIds.push(match.id);
            continue;
          }

          const id = v4();
          const record = companyRepository.create({
            id,
            name: name || website || linkedinUrl,
            ...(toPrimaryLink(website)
              ? { domainName: toPrimaryLink(website) }
              : {}),
            ...(toPrimaryLink(linkedinUrl)
              ? { linkedinLink: toPrimaryLink(linkedinUrl) }
              : {}),
            gtmRunKey: projectId,
            createdBy: buildCreatedByFromSystem(),
          });

          await companyRepository.save(record);
          existing.push(record);
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
