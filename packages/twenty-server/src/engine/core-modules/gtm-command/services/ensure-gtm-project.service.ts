import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { buildCreatedByFromSystem } from 'src/engine/core-modules/actor/utils/build-created-by-from-system.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type CompanyRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  domainName?: { primaryLinkUrl?: string } | null;
  gtmRunKey?: string | null;
};

type ProjectRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  icpSpec?: string | null;
  peopleSearchBlurb?: string | null;
  maxPersonasPerCompany?: number | null;
};

@Injectable()
export class EnsureGtmProjectService {
  private readonly logger = new Logger(EnsureGtmProjectService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async ensureForCompany({
    workspaceId,
    companyId,
    projectId,
  }: {
    workspaceId: string;
    companyId?: string | null;
    projectId?: string | null;
  }): Promise<{ projectId: string; gtmRunKey: string } | null> {
    if (!isNonEmptyString(workspaceId)) {
      return null;
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const projectRepository =
          await this.globalWorkspaceOrmManager.getRepository<ProjectRecord>(
            workspaceId,
            'project',
            { shouldBypassPermissionChecks: true },
          );
        const companyRepository = isNonEmptyString(companyId)
          ? await this.globalWorkspaceOrmManager.getRepository<CompanyRecord>(
              workspaceId,
              'company',
              { shouldBypassPermissionChecks: true },
            )
          : null;

        const company =
          isDefined(companyRepository) && isNonEmptyString(companyId)
            ? await companyRepository.findOne({
                where: { id: companyId },
                select: ['id', 'name', 'gtmRunKey'],
              })
            : null;

        const tagCompany = async (resolvedProjectId: string) => {
          if (isDefined(company) && company.gtmRunKey !== resolvedProjectId) {
            await companyRepository?.update(company.id, {
              gtmRunKey: resolvedProjectId,
            });
          }
        };

        if (isNonEmptyString(projectId)) {
          const project = await projectRepository.findOne({
            where: { id: projectId },
            select: ['id'],
          });

          if (isDefined(project)) {
            await tagCompany(project.id);

            return { projectId: project.id, gtmRunKey: project.id };
          }
        }

        if (isNonEmptyString(company?.gtmRunKey)) {
          const byId = await projectRepository.findOne({
            where: { id: company.gtmRunKey },
          });

          if (isDefined(byId)) {
            await tagCompany(byId.id);

            return { projectId: byId.id, gtmRunKey: byId.id };
          }
        }

        const existing = await projectRepository.find({
          order: { createdAt: 'DESC' },
          take: 1,
        });
        const existingProject = existing[0];

        if (isDefined(existingProject)) {
          await tagCompany(existingProject.id);

          return { projectId: existingProject.id, gtmRunKey: existingProject.id };
        }

        const createdBy = buildCreatedByFromSystem();
        const created = projectRepository.create({
          name: 'GTM Outreach',
          createdBy,
          updatedBy: createdBy,
        });
        const saved = await projectRepository.save(created);

        await tagCompany(saved.id);

        this.logger.log(
          `Created GTM Project ${saved.id} for workspace ${workspaceId}`,
        );

        return { projectId: saved.id, gtmRunKey: saved.id };
      },
      authContext,
    );
  }
}
