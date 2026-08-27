import { Command } from 'nest-commander';
import { isNonEmptyString } from '@sniptt/guards';
import { type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

type CompanyRow = ObjectLiteral & {
  id: string;
  linkedinId?: string | null;
  createdAt?: string | Date | null;
};

const toTimestamp = (value: string | Date | null | undefined): number => {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : 0;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000066)
@Command({
  name: 'upgrade:2-25:unique-company-linkedin-id',
  description:
    'Null empty and duplicate Company.linkedinId values, then add a unique index',
})
export class UniqueCompanyLinkedinIdCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Preparing unique Company.linkedinId for workspace ${workspaceId}`,
    );

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const companyRepository =
          await this.globalWorkspaceOrmManager.getRepository<CompanyRow>(
            workspaceId,
            'company',
            { shouldBypassPermissionChecks: true },
          );
        const hasLinkedinIdColumn = (
          companyRepository.metadata?.columns ?? []
        ).some((column) => column.propertyName === 'linkedinId');

        if (!hasLinkedinIdColumn) {
          this.logger.log(
            `Company.linkedinId is not present in workspace ${workspaceId}; skipping cleanup`,
          );

          return;
        }

        const rows = await companyRepository.find({
          select: ['id', 'linkedinId', 'createdAt'],
        });
        const emptyIds: string[] = [];
        const duplicatesByValue = new Map<string, CompanyRow[]>();

        for (const row of rows) {
          const linkedinId =
            typeof row.linkedinId === 'string' ? row.linkedinId.trim() : '';

          if (row.linkedinId === '') {
            emptyIds.push(row.id);
            continue;
          }

          if (!isNonEmptyString(linkedinId)) {
            continue;
          }

          const group = duplicatesByValue.get(linkedinId) ?? [];

          group.push(row);
          duplicatesByValue.set(linkedinId, group);
        }

        const duplicateExtraIds: string[] = [];

        for (const group of duplicatesByValue.values()) {
          if (group.length < 2) {
            continue;
          }

          const sorted = [...group].sort(
            (left, right) =>
              toTimestamp(left.createdAt) - toTimestamp(right.createdAt),
          );

          duplicateExtraIds.push(...sorted.slice(1).map((row) => row.id));
        }

        const idsToNull = [...new Set([...emptyIds, ...duplicateExtraIds])];

        this.logger.log(
          `Company.linkedinId cleanup workspace=${workspaceId} empty=${emptyIds.length} duplicateExtras=${duplicateExtraIds.length}`,
        );

        if (isDryRun || idsToNull.length === 0) {
          return;
        }

        for (const id of idsToNull) {
          await companyRepository.update(id, { linkedinId: null });
        }
      },
      authContext,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    this.logger.log(
      `Unique Company.linkedinId synced for workspace ${workspaceId}`,
    );
  }
}
