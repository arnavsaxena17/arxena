import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';
import { TRIGGER_STEP_ID } from 'twenty-shared/workflow';
import { DataSource, In, IsNull } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type WorkflowRunWorkspaceEntity } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import {
  buildWorkflowRunName,
  extractWorkflowRunTriggerRecordFromState,
} from 'src/modules/workflow/workflow-runner/utils/extract-workflow-run-trigger-record.util';

@RegisteredWorkspaceCommand('2.25.0', 1785600000072)
@Command({
  name: 'upgrade:2-25:backfill-workflow-run-related-records',
  description:
    'Backfill workflowRun relatedRecordId / relatedObjectName / candidateId from stored trigger state, and hide the duplicate Candidate column on workflow run index views',
})
export class BackfillWorkflowRunRelatedRecordsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Backfilling workflow run related records for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.backfillRelatedRecords(workspaceId);
    await this.hideWorkflowRunCandidateIndexColumn(workspaceId);
    await this.placeRelatedObjectAfterStatus(workspaceId);
    await this.uniquifyCollidingViewFieldPositions({
      workspaceId,
      objectNameSingular: 'candidate',
      fieldName: 'workflowRuns',
    });

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatViewFieldMaps',
    ]);

    this.logger.log(
      `Backfilled workflow run related records for workspace ${workspaceId}`,
    );
  }

  private async backfillRelatedRecords(workspaceId: string): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const workflowRunRepository =
        await this.globalWorkspaceOrmManager.getRepository<WorkflowRunWorkspaceEntity>(
          workspaceId,
          'workflowRun',
          { shouldBypassPermissionChecks: true },
        );
      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<{
          id: string;
          name: string | null;
        }>(workspaceId, 'candidate', { shouldBypassPermissionChecks: true });

      const runsToBackfill = await workflowRunRepository.find({
        where: [{ relatedRecordId: IsNull() }, { relatedObjectName: IsNull() }],
        select: [
          'id',
          'name',
          'state',
          'relatedRecordId',
          'relatedObjectName',
          'candidateId',
        ],
      });

      if (runsToBackfill.length === 0) {
        return;
      }

      const extractedByRunId = new Map(
        runsToBackfill.map((workflowRun) => [
          workflowRun.id,
          extractWorkflowRunTriggerRecordFromState({
            trigger: workflowRun.state?.flow?.trigger,
            triggerStepResult:
              workflowRun.state?.stepInfos?.[TRIGGER_STEP_ID]?.result,
          }),
        ]),
      );

      const candidateIdsToCheck = [
        ...new Set(
          [...extractedByRunId.values()]
            .filter(
              (relatedRecord) =>
                relatedRecord?.objectNameSingular === 'candidate',
            )
            .map((relatedRecord) => relatedRecord?.recordId)
            .filter(isDefined),
        ),
      ];
      const existingCandidates =
        candidateIdsToCheck.length === 0
          ? []
          : await candidateRepository.find({
              where: { id: In(candidateIdsToCheck) },
              select: ['id', 'name'],
            });
      const existingCandidateIds = new Set(
        existingCandidates.map((candidate) => candidate.id),
      );
      const candidateNameById = new Map(
        existingCandidates
          .filter(
            (candidate): candidate is { id: string; name: string } =>
              typeof candidate.name === 'string' &&
              candidate.name.trim().length > 0,
          )
          .map((candidate) => [candidate.id, candidate.name.trim()]),
      );

      let updatedCount = 0;

      for (const workflowRun of runsToBackfill) {
        const relatedRecord = extractedByRunId.get(workflowRun.id);

        if (!isDefined(relatedRecord)) {
          continue;
        }

        const nextName = this.buildBackfilledName({
          currentName: workflowRun.name,
          recordLabel:
            relatedRecord.recordLabel ??
            candidateNameById.get(relatedRecord.recordId),
        });
        const nextCandidateId =
          relatedRecord.objectNameSingular === 'candidate' &&
          existingCandidateIds.has(relatedRecord.recordId)
            ? relatedRecord.recordId
            : workflowRun.candidateId;

        if (
          workflowRun.relatedRecordId === relatedRecord.recordId &&
          workflowRun.relatedObjectName === relatedRecord.objectNameSingular &&
          workflowRun.candidateId === nextCandidateId &&
          workflowRun.name === nextName
        ) {
          continue;
        }

        await workflowRunRepository.update(workflowRun.id, {
          relatedRecordId: relatedRecord.recordId,
          relatedObjectName: relatedRecord.objectNameSingular,
          candidateId: nextCandidateId ?? null,
          ...(isDefined(nextName) ? { name: nextName } : {}),
        });
        updatedCount += 1;
      }

      if (updatedCount > 0) {
        this.logger.log(
          `Backfilled related record fields on ${updatedCount} workflow run(s) for workspace ${workspaceId}`,
        );
      }
    }, authContext);
  }

  private buildBackfilledName({
    currentName,
    recordLabel,
  }: {
    currentName: string | null;
    recordLabel?: string;
  }): string | null {
    if (!isDefined(recordLabel) || !isDefined(currentName)) {
      return currentName;
    }

    if (currentName.includes(' · ')) {
      return currentName;
    }

    const runNumberMatch = currentName.match(/^#(\d+)/);

    if (!isDefined(runNumberMatch?.[1])) {
      return currentName;
    }

    return buildWorkflowRunName({
      runNumber: parseInt(runNumberMatch[1], 10),
      workflowName: currentName.replace(/^#\d+\s+-\s+/, ''),
      recordLabel,
    });
  }

  private async hideWorkflowRunCandidateIndexColumn(
    workspaceId: string,
  ): Promise<void> {
    const result = await this.coreDataSource.query(
      `
        UPDATE core."viewField" AS vf
        SET "isVisible" = false,
            "updatedAt" = NOW()
        FROM core."view" AS v,
             core."fieldMetadata" AS fm,
             core."objectMetadata" AS om
        WHERE vf."viewId" = v.id
          AND fm.id = vf."fieldMetadataId"
          AND om.id = fm."objectMetadataId"
          AND vf."workspaceId" = $1
          AND om."nameSingular" = 'workflowRun'
          AND fm.name = 'candidate'
          AND v."key" = 'INDEX'
          AND vf."isVisible" = true
          AND vf."deletedAt" IS NULL
      `,
      [workspaceId],
    );

    const updatedCount = Array.isArray(result)
      ? result.length
      : (result?.[1] ?? 0);

    if (updatedCount > 0) {
      this.logger.log(
        `Hid Candidate column on ${updatedCount} workflow run index view(s) for workspace ${workspaceId}`,
      );
    }
  }

  private async placeRelatedObjectAfterStatus(
    workspaceId: string,
  ): Promise<void> {
    await this.coreDataSource.query(
      `
        UPDATE core."viewField" AS vf
        SET position = 2.5,
            "updatedAt" = NOW()
        FROM core."view" AS v,
             core."fieldMetadata" AS fm,
             core."objectMetadata" AS om
        WHERE vf."viewId" = v.id
          AND fm.id = vf."fieldMetadataId"
          AND om.id = fm."objectMetadataId"
          AND vf."workspaceId" = $1
          AND om."nameSingular" = 'workflowRun'
          AND fm.name = 'relatedObjectName'
          AND v."key" = 'INDEX'
          AND vf."deletedAt" IS NULL
          AND vf.position <> 2.5
      `,
      [workspaceId],
    );
  }

  private async uniquifyCollidingViewFieldPositions({
    workspaceId,
    objectNameSingular,
    fieldName,
  }: {
    workspaceId: string;
    objectNameSingular: string;
    fieldName: string;
  }): Promise<void> {
    await this.coreDataSource.query(
      `
        WITH colliding AS (
          SELECT
            vf.id,
            (
              SELECT COALESCE(MAX(other.position), -1) + 1
              FROM core."viewField" AS other
              WHERE other."viewId" = vf."viewId"
                AND other."deletedAt" IS NULL
            ) AS "nextPosition"
          FROM core."viewField" AS vf
          INNER JOIN core."fieldMetadata" AS fm
            ON fm.id = vf."fieldMetadataId"
          INNER JOIN core."objectMetadata" AS om
            ON om.id = fm."objectMetadataId"
          WHERE vf."workspaceId" = $1
            AND om."nameSingular" = $2
            AND fm.name = $3
            AND vf."deletedAt" IS NULL
            AND vf."isVisible" = true
            AND EXISTS (
              SELECT 1
              FROM core."viewField" AS sibling
              WHERE sibling."viewId" = vf."viewId"
                AND sibling.id <> vf.id
                AND sibling.position = vf.position
                AND sibling."isVisible" = true
                AND sibling."deletedAt" IS NULL
            )
        )
        UPDATE core."viewField" AS vf
        SET position = colliding."nextPosition",
            "updatedAt" = NOW()
        FROM colliding
        WHERE vf.id = colliding.id
      `,
      [workspaceId, objectNameSingular, fieldName],
    );
  }
}
