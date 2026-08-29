import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';
import { In, IsNull } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { type WorkflowRunWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';

@RegisteredWorkspaceCommand('2.25.0', 1785600000071)
@Command({
  name: 'upgrade:2-25:add-candidate-workflow-runs-relation',
  description:
    'Add a Candidate → Workflow Runs relation and backfill it from relatedRecordId so candidates can show associated runs in a column',
})
export class AddCandidateWorkflowRunsRelationCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Adding Candidate workflowRuns relation for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    await this.backfillCandidateIds(workspaceId);

    this.logger.log(
      `Added Candidate workflowRuns relation for workspace ${workspaceId}`,
    );
  }

  private async backfillCandidateIds(workspaceId: string): Promise<void> {
    const { flatObjectMetadataMaps, flatFieldMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatObjectMetadataMaps',
        'flatFieldMetadataMaps',
      ]);

    const workflowRunObject = Object.values(
      flatObjectMetadataMaps.byUniversalIdentifier,
    ).find(
      (objectMetadata) =>
        isDefined(objectMetadata) &&
        objectMetadata.nameSingular === 'workflowRun',
    );

    const hasCandidateJoinColumn =
      isDefined(workflowRunObject) &&
      Object.values(flatFieldMetadataMaps.byUniversalIdentifier).some(
        (fieldMetadata) =>
          isDefined(fieldMetadata) &&
          fieldMetadata.objectMetadataId === workflowRunObject.id &&
          fieldMetadata.name === 'candidate',
      );

    if (!hasCandidateJoinColumn) {
      this.logger.warn(
        `workflowRun.candidateId was not created for workspace ${workspaceId}, skipping backfill`,
      );

      return;
    }

    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const workflowRunRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkflowRunWorkspaceEntity>(
          workspaceId,
          'workflowRun',
          { shouldBypassPermissionChecks: true },
        );
      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<{ id: string }>(
          workspaceId,
          'candidate',
          { shouldBypassPermissionChecks: true },
        );

      const runsToBackfill = await workflowRunRepository.find({
        where: {
          relatedObjectName: 'candidate',
          candidateId: IsNull(),
        },
        select: ['id', 'relatedRecordId'],
      });

      const relatedRecordIds = [
        ...new Set(
          runsToBackfill
            .map((workflowRun) => workflowRun.relatedRecordId)
            .filter(isDefined),
        ),
      ];

      if (relatedRecordIds.length === 0) {
        return;
      }

      const existingCandidates = await candidateRepository.find({
        where: { id: In(relatedRecordIds) },
        select: ['id'],
      });
      const existingCandidateIds = new Set(
        existingCandidates.map((candidate) => candidate.id),
      );

      let updatedCount = 0;

      for (const workflowRun of runsToBackfill) {
        if (
          !isDefined(workflowRun.relatedRecordId) ||
          !existingCandidateIds.has(workflowRun.relatedRecordId)
        ) {
          continue;
        }

        await workflowRunRepository.update(workflowRun.id, {
          candidateId: workflowRun.relatedRecordId,
        });
        updatedCount += 1;
      }

      if (updatedCount > 0) {
        this.logger.log(
          `Backfilled candidateId on ${updatedCount} workflow run(s) for workspace ${workspaceId}`,
        );
      }
    }, authContext);
  }
}
