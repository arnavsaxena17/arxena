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
  gtmRunKey?: string | null;
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

        if (isNonEmptyString(projectId)) {
          const project = await projectRepository.findOne({
            where: { id: projectId },
            select: ['id', 'gtmRunKey'],
          });

          if (isDefined(project)) {
            const gtmRunKey = project.gtmRunKey || project.id;

            if (isDefined(company) && company.gtmRunKey !== gtmRunKey) {
              await companyRepository?.update(company.id, { gtmRunKey });
            }

            if (!isNonEmptyString(project.gtmRunKey)) {
              await projectRepository.update(project.id, { gtmRunKey });
            }

            return { projectId: project.id, gtmRunKey };
          }
        }

        if (isNonEmptyString(company?.gtmRunKey)) {
          const byKey = await projectRepository.findOne({
            where: [{ id: company.gtmRunKey }, { gtmRunKey: company.gtmRunKey }],
          });

          if (isDefined(byKey)) {
            return {
              projectId: byKey.id,
              gtmRunKey: byKey.gtmRunKey || byKey.id,
            };
          }
        }

        const existing = await projectRepository.find({
          order: { createdAt: 'DESC' },
          take: 1,
        });
        const existingProject = existing[0];

        if (isDefined(existingProject)) {
          const gtmRunKey = existingProject.gtmRunKey || existingProject.id;

          if (!isNonEmptyString(existingProject.gtmRunKey)) {
            await projectRepository.update(existingProject.id, { gtmRunKey });
          }

          if (isDefined(company) && company.gtmRunKey !== gtmRunKey) {
            await companyRepository?.update(company.id, { gtmRunKey });
          }

          return { projectId: existingProject.id, gtmRunKey };
        }

        const createdBy = buildCreatedByFromSystem();
        const created = projectRepository.create({
          name: 'GTM Outreach',
          createdBy,
          updatedBy: createdBy,
        });
        const saved = await projectRepository.save(created);
        const gtmRunKey = saved.id;

        await projectRepository.update(saved.id, { gtmRunKey });

        if (isDefined(company)) {
          await companyRepository?.update(company.id, { gtmRunKey });
        }

        this.logger.log(
          `Created GTM Project ${saved.id} for workspace ${workspaceId}`,
        );

        return { projectId: saved.id, gtmRunKey };
      },
      authContext,
    );
  }
}
