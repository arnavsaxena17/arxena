import { randomUUID } from 'crypto';

import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { isNonEmptyString } from '@sniptt/guards';
import {
  buildCandidateFlagsUpdate,
  isCandidateFlagTrue,
  parseCandidateFlags,
  type CandidateWithFlags,
} from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';
import {
  DataSource,
  In,
  type EntityManager,
  type ObjectLiteral,
  type Repository,
} from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

const SEQUENCER_NAME = SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name;

const LEGACY_OUTREACH_FLAG_COLUMNS = ['startOutreach', 'stopOutreach'] as const;

type LegacyCandidateRow = ObjectLiteral & {
  id: string;
  outreachSequenceStage?: string | null;
  startOutreach?: boolean | null;
  stopOutreach?: boolean | null;
  candidateFlags?: unknown;
};

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
          SELECT "coreWorkflowVersionId"
          FROM ${schemaName}."workflowVersion"
          WHERE "workflowId" = $1
            AND status = 'DEACTIVATED'
            AND "coreWorkflowVersionId" IS NOT NULL
            AND "deletedAt" IS NULL
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
      DELETE FROM ${schemaName}."workflowAutomatedTrigger"
      WHERE "workflowId" = $1
    `,
    [workflowId],
  );

  const triggerSettings = version.trigger?.settings ?? {};
  const settings: Record<string, unknown> = {};

  if (isNonEmptyString(triggerSettings.eventName as string | undefined)) {
    settings.eventName = triggerSettings.eventName;
  }

  if (
    Array.isArray(triggerSettings.fields) &&
    triggerSettings.fields.length > 0
  ) {
    settings.fields = triggerSettings.fields;
  }

  if (isDefined(triggerSettings.filter)) {
    settings.filter = triggerSettings.filter;
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

@RegisteredWorkspaceCommand('2.25.0', 1785600000124)
@Command({
  name: 'upgrade:2-25:fold-start-stop-outreach-into-candidate-flags',
  description:
    'Fold Candidate startOutreach/stopOutreach columns into candidateFlags, drop legacy fields, cut over Sequencer trigger to candidateFlags',
})
export class FoldStartStopOutreachIntoCandidateFlagsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
    private readonly fieldMetadataService: FieldMetadataService,
    @InjectRepository(FieldMetadataEntity)
    private readonly fieldMetadataRepository: Repository<FieldMetadataEntity>,
    private readonly applicationService: ApplicationService,
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
    const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);
    const candidateTable = `${schema}."_candidate"`;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Folding start/stop outreach into candidateFlags for workspace ${workspaceId}`,
    );

    const hasStartOutreachColumn =
      await this.workspaceQueryService.checkIfColumnExists(
        schema,
        '_candidate',
        'startOutreach',
      );
    const hasStopOutreachColumn =
      await this.workspaceQueryService.checkIfColumnExists(
        schema,
        '_candidate',
        'stopOutreach',
      );

    let foldedFromColumns = 0;
    let backfilledFromStage = 0;

    if (hasStartOutreachColumn || hasStopOutreachColumn) {
      const selectColumns = [
        'id',
        '"outreachSequenceStage"',
        '"candidateFlags"',
        ...(hasStartOutreachColumn ? ['"startOutreach"'] : []),
        ...(hasStopOutreachColumn ? ['"stopOutreach"'] : []),
      ].join(', ');

      const rows = (await this.workspaceQueryService.executeWorkspaceRawQuery(
        `
          SELECT ${selectColumns}
          FROM ${candidateTable}
          WHERE "deletedAt" IS NULL
        `,
        [],
        workspaceId,
      )) as LegacyCandidateRow[];

      for (const row of rows) {
        const stage = row.outreachSequenceStage ?? '';
        const existingFlags = parseCandidateFlags(row.candidateFlags);
        const startFromColumn = hasStartOutreachColumn
          ? row.startOutreach === true
          : undefined;
        const stopFromColumn = hasStopOutreachColumn
          ? row.stopOutreach === true
          : undefined;

        const nextStart =
          startFromColumn !== undefined
            ? startFromColumn
            : (existingFlags?.startOutreach ?? false);
        const nextStop =
          stopFromColumn !== undefined
            ? stopFromColumn
            : (existingFlags?.stopOutreach ?? stage === 'STOPPED');

        const alreadyMatches =
          isCandidateFlagTrue(
            { candidateFlags: existingFlags },
            'startOutreach',
          ) === nextStart &&
          isCandidateFlagTrue(
            { candidateFlags: existingFlags },
            'stopOutreach',
          ) === nextStop;

        if (alreadyMatches) {
          continue;
        }

        foldedFromColumns += 1;

        if (isDryRun) {
          continue;
        }

        const { candidateFlags } = buildCandidateFlagsUpdate({
          existingFlags: row.candidateFlags,
          patch: {
            startOutreach: nextStart,
            stopOutreach: nextStop,
          },
        });

        await this.workspaceQueryService.executeWorkspaceRawQuery(
          `
            UPDATE ${candidateTable}
            SET "candidateFlags" = $2::jsonb
            WHERE id = $1
          `,
          [row.id, JSON.stringify(candidateFlags)],
          workspaceId,
        );
      }
    } else {
      // No legacy columns — still ensure mid-flight rows have flags set (idempotent).
      const authContext = buildSystemAuthContext(workspaceId);

      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const candidateRepository =
            await this.globalWorkspaceOrmManager.getRepository<
              ObjectLiteral & {
                id: string;
                outreachSequenceStage?: string | null;
                candidateFlags?: unknown;
              }
            >(workspaceId, 'candidate', {
              shouldBypassPermissionChecks: true,
            });

          const candidates = await candidateRepository.find({ take: 50_000 });

          for (const candidate of candidates) {
            const stage = candidate.outreachSequenceStage ?? '';
            const candidateWithFlags = {
              candidateFlags: candidate.candidateFlags,
            } as CandidateWithFlags;
            const hasStarted = isCandidateFlagTrue(
              candidateWithFlags,
              'startOutreach',
            );
            const hasStopped = isCandidateFlagTrue(
              candidateWithFlags,
              'stopOutreach',
            );

            if (!isNonEmptyString(stage) || stage === 'STOPPED') {
              const shouldStop = stage === 'STOPPED';

              if (hasStarted || hasStopped !== shouldStop) {
                backfilledFromStage += 1;

                if (!isDryRun) {
                  await candidateRepository.update(
                    candidate.id,
                    buildCandidateFlagsUpdate({
                      existingFlags: candidate.candidateFlags,
                      patch: {
                        startOutreach: false,
                        stopOutreach: shouldStop,
                      },
                    }) as never,
                  );
                }
              }
              continue;
            }

            if (hasStarted && !hasStopped) {
              continue;
            }

            backfilledFromStage += 1;

            if (!isDryRun) {
              await candidateRepository.update(
                candidate.id,
                buildCandidateFlagsUpdate({
                  existingFlags: candidate.candidateFlags,
                  patch: {
                    startOutreach: true,
                    stopOutreach: false,
                  },
                }) as never,
              );
            }
          }
        },
        authContext,
      );
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Workspace ${workspaceId}: foldedFromColumns=${foldedFromColumns}, backfilledFromStage=${backfilledFromStage}`,
    );

    const legacyFields = await this.fieldMetadataRepository.find({
      where: {
        workspaceId,
        name: In([...LEGACY_OUTREACH_FLAG_COLUMNS]),
      },
      relations: ['object'],
    });

    for (const field of legacyFields) {
      if (field.object?.nameSingular !== 'candidate') {
        continue;
      }

      this.logger.log(
        `${isDryRun ? '[DRY RUN] ' : ''}Removing candidate.${field.name} (${field.id})`,
      );

      if (isDryRun) {
        continue;
      }

      try {
        await this.fieldMetadataService.deleteOneField({
          deleteOneFieldInput: { id: field.id },
          workspaceId,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to delete candidate.${field.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

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
      const activeFields = activeVersion?.trigger?.settings?.fields ?? [];

      const activeNeedsCutover =
        isDefined(activeVersion) &&
        (activeVersion.trigger?.type === 'MANUAL' ||
          activeFields.includes('startOutreach') ||
          !activeFields.includes('candidateFlags'));

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
      'flatFieldMetadataMaps',
      'flatObjectMetadataMaps',
    ]);

    this.logger.log(
      `Folded start/stop outreach into candidateFlags for workspace ${workspaceId}`,
    );
  }
}
