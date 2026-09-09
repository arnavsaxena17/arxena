import { Command } from 'nest-commander';
import { type ObjectLiteral } from 'typeorm';
import { type QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

const LEGACY_JOIN_COLUMN_NAME = 'projectsId';
const JOIN_COLUMN_NAME = 'projectId';

type WorkflowVersionRecord = ObjectLiteral & {
  id: string;
  steps: unknown;
  trigger: unknown;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000100)
@Command({
  name: 'upgrade:2-25:standardize-candidate-project-fk',
  description:
    'Rename candidate.projects → candidate.project and chatMessage.projects → chatMessage.project so the FK column is projectId like every other child of project',
})
export class StandardizeCandidateProjectFkCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Standardizing ${LEGACY_JOIN_COLUMN_NAME} → ${JOIN_COLUMN_NAME} on candidate and chatMessage for workspace ${workspaceId}`,
    );

    // The sync moves the live row onto the new name and identifier before it
    // diffs, so the field is updated in place instead of dropped and recreated
    if (!isDryRun) {
      await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
        { workspaceId },
      );

      this.logger.log(
        `Synced Arxena standard application (candidate.project, chatMessage.project) for workspace ${workspaceId}`,
      );
    }

    await this.patchWorkflowFieldPaths({ workspaceId, isDryRun });
  }

  private rewriteJoinColumnName(value: unknown): {
    next: unknown;
    changed: boolean;
  } {
    const serialized = JSON.stringify(value);

    if (!serialized?.includes(LEGACY_JOIN_COLUMN_NAME)) {
      return { next: value, changed: false };
    }

    const rewritten = serialized
      .split(LEGACY_JOIN_COLUMN_NAME)
      .join(JOIN_COLUMN_NAME);

    return { next: JSON.parse(rewritten), changed: true };
  }

  // Seeded outreach graphs embed the column name in variable paths such as
  // {{stepId.first.projectsId}} and in FIND_RECORDS filter values
  private async patchWorkflowFieldPaths({
    workspaceId,
    isDryRun,
  }: {
    workspaceId: string;
    isDryRun: boolean;
  }): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const workflowVersionRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkflowVersionRecord>(
          workspaceId,
          'workflowVersion',
          { shouldBypassPermissionChecks: true },
        );
      const versions = await workflowVersionRepository.find();
      let patched = 0;

      for (const version of versions) {
        const stepsResult = this.rewriteJoinColumnName(version.steps);
        const triggerResult = this.rewriteJoinColumnName(version.trigger);

        if (!stepsResult.changed && !triggerResult.changed) {
          continue;
        }

        patched += 1;

        if (isDryRun) {
          continue;
        }

        await workflowVersionRepository.update(version.id, {
          ...(stepsResult.changed ? { steps: stepsResult.next } : {}),
          ...(triggerResult.changed ? { trigger: triggerResult.next } : {}),
        } as QueryDeepPartialEntity<WorkflowVersionRecord>);
      }

      this.logger.log(
        `${isDryRun ? '[DRY RUN] ' : ''}Patched ${patched} workflowVersion(s) ${LEGACY_JOIN_COLUMN_NAME} → ${JOIN_COLUMN_NAME} for workspace ${workspaceId}`,
      );
    }, authContext);
  }
}
