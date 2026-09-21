import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';
import {
  sequencerAutomatedTriggerLooksHealthy,
  syncWorkflowAutomatedTriggerFromVersion,
} from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/sync-workflow-automated-trigger-from-version.util';

const SEQUENCER_NAME = SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name;

@RegisteredWorkspaceCommand('2.25.0', 1785600000128)
@Command({
  name: 'upgrade:2-25:resync-outreach-sequencer-automated-trigger',
  description:
    'Resync Candidate Sequencer workflowAutomatedTrigger from ACTIVE (or DRAFT cutover) so accept gates use candidateFlags paths',
})
export class ResyncOutreachSequencerAutomatedTriggerCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Resyncing Candidate Sequencer automated trigger for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    const schemaName = getWorkspaceSchemaName(workspaceId);
    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      await prefillOutreachWorkflows({
        entityManager: queryRunner.manager,
        workspaceId,
        schemaName,
        applicationId: workspaceCustomFlatApplication.id,
        replaceExistingDrafts: true,
        onlyGraphNames: [SEQUENCER_NAME],
      });

      const sequencerRows = (await queryRunner.manager.query(
        `
          SELECT w.id as "workflowId", wv.id as "versionId", wv.status,
                 wv.trigger
          FROM ${schemaName}.workflow w
          INNER JOIN ${schemaName}."workflowVersion" wv ON wv."workflowId" = w.id
          WHERE w.name = $1
            AND w."deletedAt" IS NULL
            AND wv."deletedAt" IS NULL
          ORDER BY
            CASE WHEN wv.status = 'ACTIVE' THEN 0
                 WHEN wv.status = 'DRAFT' THEN 1
                 ELSE 2 END,
            wv."createdAt" DESC
          LIMIT 5
        `,
        [SEQUENCER_NAME],
      )) as Array<{
        workflowId: string;
        versionId: string;
        status: string;
        trigger: {
          type?: string;
          settings?: { fields?: string[]; filter?: unknown };
        } | null;
      }>;

      const sequencerWorkflowId = sequencerRows[0]?.workflowId;

      if (!isNonEmptyString(sequencerWorkflowId)) {
        this.logger.log(
          `No Candidate Sequencer workflow in workspace ${workspaceId}; skipping`,
        );
        await queryRunner.commitTransaction();

        return;
      }

      const activeVersion = sequencerRows.find(
        (row) => row.status === 'ACTIVE',
      );
      const draftVersion = sequencerRows.find((row) => row.status === 'DRAFT');

      const activeFilterJson = JSON.stringify(
        activeVersion?.trigger?.settings?.filter ?? {},
      );
      const activeFields = activeVersion?.trigger?.settings?.fields ?? [];
      const activeHealthy =
        isDefined(activeVersion) &&
        sequencerAutomatedTriggerLooksHealthy({
          fields: activeFields,
          filterJson: activeFilterJson,
        });

      const versionIdToSync = activeHealthy
        ? activeVersion.versionId
        : draftVersion?.versionId;

      if (!isNonEmptyString(versionIdToSync)) {
        throw new Error(
          `Candidate Sequencer has no healthy ACTIVE or DRAFT to sync automated trigger from in workspace ${workspaceId}`,
        );
      }

      // If ACTIVE is stale, promote the freshly prefilled DRAFT first.
      if (!activeHealthy && isNonEmptyString(draftVersion?.versionId)) {
        await queryRunner.manager.query(
          `
            UPDATE ${schemaName}."workflowVersion"
            SET status = 'DEACTIVATED', "updatedAt" = NOW()
            WHERE "workflowId" = $1
              AND status = 'ACTIVE'
              AND "deletedAt" IS NULL
          `,
          [sequencerWorkflowId],
        );

        await queryRunner.manager.query(
          `
            UPDATE ${schemaName}."workflowVersion"
            SET status = 'ACTIVE', "updatedAt" = NOW()
            WHERE id = $1
          `,
          [draftVersion.versionId],
        );

        await queryRunner.manager.query(
          `
            UPDATE ${schemaName}.workflow
            SET statuses = ARRAY['ACTIVE']::${schemaName}.workflow_statuses_enum[],
                "lastPublishedVersionId" = $2,
                "updatedAt" = NOW()
            WHERE id = $1
          `,
          [sequencerWorkflowId, draftVersion.versionId],
        );
      }

      const synced = await syncWorkflowAutomatedTriggerFromVersion({
        schemaName,
        entityManager: queryRunner.manager,
        workflowId: sequencerWorkflowId,
        versionId: versionIdToSync,
      });

      const triggerRows = (await queryRunner.manager.query(
        `
          SELECT settings
          FROM ${schemaName}."workflowAutomatedTrigger"
          WHERE "workflowId" = $1
          LIMIT 1
        `,
        [sequencerWorkflowId],
      )) as Array<{ settings: { fields?: string[]; filter?: unknown } }>;

      const liveSettings = triggerRows[0]?.settings;
      const liveFilterJson = JSON.stringify(liveSettings?.filter ?? {});

      if (
        !sequencerAutomatedTriggerLooksHealthy({
          fields: liveSettings?.fields ?? [],
          filterJson: liveFilterJson,
        })
      ) {
        throw new Error(
          `Candidate Sequencer automated trigger still unhealthy after sync in workspace ${workspaceId}: fields=${JSON.stringify(synced.fields)} filter=${liveFilterJson.slice(0, 200)}`,
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'workflowAutomatedTriggerMaps',
    ]);

    this.logger.log(
      `Candidate Sequencer automated trigger resynced for workspace ${workspaceId}`,
    );
  }
}
