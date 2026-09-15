import { randomUUID } from 'crypto';

import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { DataSource, type EntityManager } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import {
  buildProjectExperimentConfigUpdate,
  readProjectExperimentConfig,
  type OutreachExperimentConfig,
} from 'src/engine/core-modules/outreach-command/utils/outreach-experiment.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { deactivateOutreachWorkflowsByName } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/outreach-workflow-cleanup.util';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

const STAGE_B_C_NAMES = [
  SEEDED_OUTREACH_WORKFLOW.perCandidate.name,
  SEEDED_OUTREACH_WORKFLOW.candidateUpdated.name,
] as const;

const SEQUENCER_NAME = SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name;

const migrateExperimentConfigOffStageBC = (project: {
  outreachConfig?: unknown;
  experimentConfig?: string | null;
}): OutreachExperimentConfig | null => {
  const parsed = readProjectExperimentConfig(project);

  if (!isDefined(parsed)) {
    return null;
  }

  const workflows = { ...(parsed.workflows ?? {}) } as Record<string, unknown>;
  const hadStageBinding =
    isDefined(workflows.perCandidate) || isDefined(workflows.candidateUpdated);

  delete workflows.perCandidate;
  delete workflows.candidateUpdated;

  if (!hadStageBinding) {
    return null;
  }

  // Mid-flight B/C experiments cannot remap onto Sequencer versions.
  return {
    status: 'completed',
    split: parsed.split,
    name: parsed.name,
    workflows:
      isDefined(workflows.companySearch) ||
      isDefined(workflows.candidateSequencer)
        ? (workflows as OutreachExperimentConfig['workflows'])
        : undefined,
  };
};

// SQL activate avoids WorkflowTriggerModule (circular AuthModule init in CLI).
const activateSequencerViaSql = async ({
  schemaName,
  entityManager,
  workflowId,
  versionId,
}: {
  schemaName: string;
  entityManager: EntityManager;
  workflowId: string;
  versionId: string;
}): Promise<void> => {
  const alreadyActive = (await entityManager.query(
    `
      SELECT 1
      FROM ${schemaName}."workflowVersion"
      WHERE "workflowId" = $1
        AND status = 'ACTIVE'
        AND "deletedAt" IS NULL
      LIMIT 1
    `,
    [workflowId],
  )) as unknown[];

  if (alreadyActive.length > 0) {
    return;
  }

  const versionRows = (await entityManager.query(
    `
      SELECT id, trigger, "coreWorkflowVersionId"
      FROM ${schemaName}."workflowVersion"
      WHERE id = $1
        AND "deletedAt" IS NULL
      LIMIT 1
    `,
    [versionId],
  )) as Array<{
    id: string;
    trigger: {
      type?: string;
      settings?: Record<string, unknown>;
    } | null;
    coreWorkflowVersionId: string | null;
  }>;

  const version = versionRows[0];

  if (!isDefined(version)) {
    throw new Error(`Sequencer draft version ${versionId} not found`);
  }

  await entityManager.query(
    `
      UPDATE ${schemaName}."workflowVersion"
      SET status = 'ACTIVE', "updatedAt" = NOW()
      WHERE id = $1
    `,
    [versionId],
  );

  if (isNonEmptyString(version.coreWorkflowVersionId)) {
    await entityManager.query(
      `
        UPDATE core."workflowVersion"
        SET status = 'ACTIVE'
        WHERE id = $1
      `,
      [version.coreWorkflowVersionId],
    );
  }

  await entityManager.query(
    `
      UPDATE ${schemaName}.workflow
      SET statuses = ARRAY['ACTIVE']::${schemaName}.workflow_statuses_enum[],
          "lastPublishedVersionId" = $2,
          "updatedAt" = NOW()
      WHERE id = $1
    `,
    [workflowId, versionId],
  );

  const trigger = version.trigger;

  if (trigger?.type !== 'DATABASE_EVENT' || !isDefined(trigger.settings)) {
    return;
  }

  const existingTriggers = (await entityManager.query(
    `
      SELECT 1
      FROM ${schemaName}."workflowAutomatedTrigger"
      WHERE "workflowId" = $1
      LIMIT 1
    `,
    [workflowId],
  )) as unknown[];

  if (existingTriggers.length > 0) {
    return;
  }

  const { eventName, fields, filter } = trigger.settings as {
    eventName?: string;
    fields?: string[];
    filter?: unknown;
  };

  if (!isNonEmptyString(eventName)) {
    return;
  }

  const settings: Record<string, unknown> = { eventName };

  if (isDefined(fields) && fields.length > 0) {
    settings.fields = fields;
  }

  if (isDefined(filter)) {
    settings.filter = filter;
  }

  await entityManager.query(
    `
      INSERT INTO ${schemaName}."workflowAutomatedTrigger"
        (id, "workflowId", type, settings, "createdAt", "updatedAt")
      VALUES ($1, $2, 'DATABASE_EVENT', $3::jsonb, NOW(), NOW())
    `,
    [randomUUID(), workflowId, JSON.stringify(settings)],
  );
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000117)
@Command({
  name: 'upgrade:2-25:cutover-outreach-candidate-sequencer',
  description:
    'Resync Candidate Sequencer (QUEUED connectionSentAt guard), rebind Project pins + experiments, deactivate Stage B/C, activate Sequencer',
})
export class CutoverOutreachCandidateSequencerCommand extends ProvisionedWorkspaceCommandRunner {
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
      `${isDryRun ? '[DRY RUN] ' : ''}Cutting over outreach to Candidate Sequencer for workspace ${workspaceId}`,
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
          SELECT w.id as "workflowId", wv.id as "versionId", wv.status
          FROM ${schemaName}.workflow w
          INNER JOIN ${schemaName}."workflowVersion" wv ON wv."workflowId" = w.id
          WHERE w.name = $1
            AND w."deletedAt" IS NULL
            AND wv."deletedAt" IS NULL
          ORDER BY
            CASE WHEN wv.status = 'DRAFT' THEN 0
                 WHEN wv.status = 'ACTIVE' THEN 1
                 ELSE 2 END,
            wv."createdAt" DESC
          LIMIT 5
        `,
        [SEQUENCER_NAME],
      )) as Array<{
        workflowId: string;
        versionId: string;
        status: string;
      }>;

      const sequencerWorkflowId = sequencerRows[0]?.workflowId ?? null;
      const sequencerVersionId =
        sequencerRows.find((row) => row.status === 'DRAFT')?.versionId ??
        sequencerRows.find((row) => row.status === 'ACTIVE')?.versionId ??
        null;

      if (!isNonEmptyString(sequencerWorkflowId)) {
        throw new Error(
          `Candidate Sequencer workflow missing after prefill in workspace ${workspaceId}`,
        );
      }

      const stageBCRows = (await queryRunner.manager.query(
        `
          SELECT id
          FROM ${schemaName}.workflow
          WHERE name = ANY($1)
            AND "deletedAt" IS NULL
        `,
        [[...STAGE_B_C_NAMES]],
      )) as Array<{ id: string }>;
      const stageBCIds = stageBCRows.map((row) => row.id);

      const projectTableExists = (await queryRunner.manager.query(
        `
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = 'project'
          LIMIT 1
        `,
        [schemaName],
      )) as unknown[];

      if (projectTableExists.length > 0) {
        const projects = (await queryRunner.manager.query(
          `
            SELECT id, "outreachWorkflowId", "outreachConfig"
            FROM ${schemaName}.project
            WHERE "deletedAt" IS NULL
          `,
        )) as Array<{
          id: string;
          outreachWorkflowId: string | null;
          outreachConfig: unknown;
        }>;

        for (const project of projects) {
          const shouldRebindPin =
            !isNonEmptyString(project.outreachWorkflowId) ||
            stageBCIds.includes(project.outreachWorkflowId);

          const migratedExperiment = migrateExperimentConfigOffStageBC({
            outreachConfig: project.outreachConfig,
          });

          const patch: Record<string, unknown> = {};

          if (shouldRebindPin) {
            patch.outreachWorkflowId = sequencerWorkflowId;
          }

          if (isDefined(migratedExperiment)) {
            const update = buildProjectExperimentConfigUpdate(
              { outreachConfig: project.outreachConfig },
              migratedExperiment,
            );

            patch.outreachConfig = update.outreachConfig;
          }

          if (Object.keys(patch).length === 0) {
            continue;
          }

          if (
            isDefined(patch.outreachWorkflowId) &&
            isDefined(patch.outreachConfig)
          ) {
            await queryRunner.manager.query(
              `
                UPDATE ${schemaName}.project
                SET "outreachWorkflowId" = $2,
                    "outreachConfig" = $3,
                    "updatedAt" = NOW()
                WHERE id = $1
              `,
              [project.id, patch.outreachWorkflowId, patch.outreachConfig],
            );
          } else if (isDefined(patch.outreachWorkflowId)) {
            await queryRunner.manager.query(
              `
                UPDATE ${schemaName}.project
                SET "outreachWorkflowId" = $2,
                    "updatedAt" = NOW()
                WHERE id = $1
              `,
              [project.id, patch.outreachWorkflowId],
            );
          } else if (isDefined(patch.outreachConfig)) {
            await queryRunner.manager.query(
              `
                UPDATE ${schemaName}.project
                SET "outreachConfig" = $2,
                    "updatedAt" = NOW()
                WHERE id = $1
              `,
              [project.id, patch.outreachConfig],
            );
          }
        }
      }

      await deactivateOutreachWorkflowsByName({
        schemaName,
        entityManager: queryRunner.manager,
        workflowNames: STAGE_B_C_NAMES,
      });

      if (isNonEmptyString(sequencerVersionId)) {
        await activateSequencerViaSql({
          schemaName,
          entityManager: queryRunner.manager,
          workflowId: sequencerWorkflowId,
          versionId: sequencerVersionId,
        });
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
      'flatAgentMaps',
      'workflowAutomatedTriggerMaps',
    ]);

    this.logger.log(
      `Candidate Sequencer cutover complete for workspace ${workspaceId}`,
    );
  }
}
