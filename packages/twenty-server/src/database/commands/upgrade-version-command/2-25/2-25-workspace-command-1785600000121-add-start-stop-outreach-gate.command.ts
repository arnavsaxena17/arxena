import { randomUUID } from 'crypto';

import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { DataSource, type EntityManager, type ObjectLiteral } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';
import { ARXENA_STANDARD_COMMAND_MENU_ITEMS } from 'src/engine/workspace-manager/twenty-standard-application/constants/arxena-standard-command-menu-item.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const SEQUENCER_NAME = SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name;

const START_STOP_OUTREACH_CMI_UNIVERSAL_IDENTIFIERS = [
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxStartOutreachCandidate
    .universalIdentifier,
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxStopOutreachCandidate
    .universalIdentifier,
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxStartOutreachPerson.universalIdentifier,
  ARXENA_STANDARD_COMMAND_MENU_ITEMS.arxStopOutreachPerson.universalIdentifier,
];

const forceActivateSequencerDraftViaSql = async ({
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
      SET status = 'DEACTIVATED', "updatedAt" = NOW()
      WHERE "workflowId" = $1
        AND status = 'ACTIVE'
        AND "deletedAt" IS NULL
    `,
    [workflowId],
  );

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
        SET status = 'DEACTIVATED'
        WHERE id IN (
          SELECT wv."coreWorkflowVersionId"
          FROM ${schemaName}."workflowVersion" wv
          WHERE wv."workflowId" = $1
            AND wv.status = 'DEACTIVATED'
            AND wv."coreWorkflowVersionId" IS NOT NULL
            AND wv."deletedAt" IS NULL
        )
      `,
      [workflowId],
    );

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

  await entityManager.query(
    `
      DELETE FROM ${schemaName}."workflowAutomatedTrigger"
      WHERE "workflowId" = $1
    `,
    [workflowId],
  );

  const trigger = version.trigger;

  if (trigger?.type !== 'DATABASE_EVENT' || !isDefined(trigger.settings)) {
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

@RegisteredWorkspaceCommand('2.25.0', 1785600000121)
@Command({
  name: 'upgrade:2-25:add-start-stop-outreach-gate',
  description:
    'Add Candidate startOutreach/stopOutreach fields, Start/Stop Outreach CMIs, gate sequencer trigger, force Automated (no Manual), backfill mid-flight startOutreach',
})
export class AddStartStopOutreachGateCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Adding start/stop outreach gate for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    const authContext = buildSystemAuthContext(workspaceId);
    let backfilled = 0;

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const candidateRepository =
        await this.globalWorkspaceOrmManager.getRepository<
          ObjectLiteral & {
            id: string;
            outreachSequenceStage?: string | null;
            startOutreach?: boolean | null;
            stopOutreach?: boolean | null;
          }
        >(workspaceId, 'candidate', { shouldBypassPermissionChecks: true });

      const candidates = await candidateRepository.find({ take: 50_000 });

      for (const candidate of candidates) {
        const stage = candidate.outreachSequenceStage ?? '';

        if (!isNonEmptyString(stage) || stage === 'STOPPED') {
          if (
            candidate.startOutreach !== false ||
            candidate.stopOutreach !== (stage === 'STOPPED')
          ) {
            await candidateRepository.update(candidate.id, {
              startOutreach: false,
              stopOutreach: stage === 'STOPPED',
            });
          }
          continue;
        }

        if (
          candidate.startOutreach === true &&
          candidate.stopOutreach === false
        ) {
          continue;
        }

        await candidateRepository.update(candidate.id, {
          startOutreach: true,
          stopOutreach: false,
        });
        backfilled += 1;
      }
    }, authContext);

    this.logger.log(
      `Backfilled startOutreach on ${backfilled} mid-flight candidates for workspace ${workspaceId}`,
    );

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { flatCommandMenuItemMaps: existingFlatCommandMenuItemMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatCommandMenuItemMaps',
      ]);

    const missingUniversalIdentifiers =
      START_STOP_OUTREACH_CMI_UNIVERSAL_IDENTIFIERS.filter(
        (universalIdentifier) =>
          !isDefined(
            existingFlatCommandMenuItemMaps.byUniversalIdentifier[
              universalIdentifier
            ],
          ),
      );

    if (missingUniversalIdentifiers.length > 0) {
      const { allFlatEntityMaps: standardAllFlatEntityMaps } =
        computeTwentyStandardApplicationAllFlatEntityMaps({
          now: new Date().toISOString(),
          workspaceId,
          twentyStandardApplicationId: twentyStandardFlatApplication.id,
        });

      const itemsToCreate = missingUniversalIdentifiers
        .map(
          (universalIdentifier) =>
            standardAllFlatEntityMaps.flatCommandMenuItemMaps
              .byUniversalIdentifier[universalIdentifier],
        )
        .filter(isDefined);

      if (itemsToCreate.length > 0) {
        const validateAndBuildResult =
          await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
            {
              allFlatEntityOperationByMetadataName: {
                commandMenuItem: {
                  flatEntityToCreate: itemsToCreate,
                  flatEntityToDelete: [],
                  flatEntityToUpdate: [],
                },
              },
              workspaceId,
              applicationUniversalIdentifier:
                twentyStandardFlatApplication.universalIdentifier,
            },
          );

        if (validateAndBuildResult.status === 'fail') {
          this.logger.error(
            `Failed to add Start/Stop Outreach commands:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
          );

          throw new Error(
            `Failed to add Start/Stop Outreach commands for workspace ${workspaceId}`,
          );
        }
      }
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
          SELECT w.id as "workflowId", wv.id as "versionId", wv.status, wv.trigger
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
        trigger: {
          type?: string;
          settings?: { fields?: string[]; filter?: unknown };
        } | null;
      }>;

      const sequencerWorkflowId = sequencerRows[0]?.workflowId ?? null;
      const draftVersion = sequencerRows.find((row) => row.status === 'DRAFT');
      const activeVersion = sequencerRows.find(
        (row) => row.status === 'ACTIVE',
      );
      const draftVersionId = draftVersion?.versionId ?? null;

      const activeNeedsCutover =
        isDefined(activeVersion) &&
        (activeVersion.trigger?.type === 'MANUAL' ||
          !(activeVersion.trigger?.settings?.fields ?? []).includes(
            'startOutreach',
          ));

      if (
        isNonEmptyString(sequencerWorkflowId) &&
        isNonEmptyString(draftVersionId) &&
        (activeNeedsCutover || !isDefined(activeVersion))
      ) {
        await forceActivateSequencerDraftViaSql({
          schemaName,
          entityManager: queryRunner.manager,
          workflowId: sequencerWorkflowId,
          versionId: draftVersionId,
        });
      } else if (
        isNonEmptyString(sequencerWorkflowId) &&
        isDefined(activeVersion) &&
        isDefined(draftVersion?.trigger?.settings) &&
        activeVersion.trigger?.type === 'DATABASE_EVENT'
      ) {
        // Keep ACTIVE version identity; refresh automated trigger from new draft settings.
        const draftSettings = draftVersion.trigger?.settings as {
          eventName?: string;
          fields?: string[];
          filter?: unknown;
        };

        if (isNonEmptyString(draftSettings?.eventName)) {
          await queryRunner.manager.query(
            `
              DELETE FROM ${schemaName}."workflowAutomatedTrigger"
              WHERE "workflowId" = $1
            `,
            [sequencerWorkflowId],
          );

          const settings: Record<string, unknown> = {
            eventName: draftSettings.eventName,
          };

          if (
            isDefined(draftSettings.fields) &&
            draftSettings.fields.length > 0
          ) {
            settings.fields = draftSettings.fields;
          }

          if (isDefined(draftSettings.filter)) {
            settings.filter = draftSettings.filter;
          }

          await queryRunner.manager.query(
            `
              UPDATE ${schemaName}."workflowVersion"
              SET trigger = $2::jsonb, "updatedAt" = NOW()
              WHERE id = $1
            `,
            [
              activeVersion.versionId,
              JSON.stringify({
                ...(activeVersion.trigger ?? {}),
                type: 'DATABASE_EVENT',
                settings,
              }),
            ],
          );

          await queryRunner.manager.query(
            `
              INSERT INTO ${schemaName}."workflowAutomatedTrigger"
                (id, "workflowId", type, settings, "createdAt", "updatedAt")
              VALUES ($1, $2, 'DATABASE_EVENT', $3::jsonb, NOW(), NOW())
            `,
            [randomUUID(), sequencerWorkflowId, JSON.stringify(settings)],
          );
        }
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
      'flatCommandMenuItemMaps',
    ]);

    this.logger.log(
      `Start/stop outreach gate complete for workspace ${workspaceId}`,
    );
  }
}
