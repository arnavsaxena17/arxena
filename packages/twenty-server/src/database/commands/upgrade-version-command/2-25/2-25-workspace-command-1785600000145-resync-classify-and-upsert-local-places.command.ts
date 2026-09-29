import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { PrefillLogicFunctionService } from 'src/engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service';
import { getOutreachLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-logic-functions.util';
import { getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

@RegisteredWorkspaceCommand('2.25.0', 1785600000145)
@Command({
  name: 'upgrade:2-25:resync-classify-and-upsert-local-places',
  description:
    'Ensure classify-and-upsert-local-places LF and seed Classify & Upsert Local Places workflow',
})
export class ResyncClassifyAndUpsertLocalPlacesCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly prefillLogicFunctionService: PrefillLogicFunctionService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Resyncing classify-and-upsert-local-places for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      return;
    }

    await this.prefillLogicFunctionService.ensureSeeded({
      workspaceId,
      definitions: [
        ...getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions(
          workspaceId,
        ),
        ...getOutreachLogicFunctionDefinitions(workspaceId),
      ],
    });

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
        onlyGraphNames: [
          SEEDED_OUTREACH_WORKFLOW.classifyAndUpsertLocalPlaces.name,
        ],
      });

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

    // Soft-delete obsolete QSR-named seed artifacts (renamed to local-places).
    await this.coreDataSource.query(
      `
        UPDATE core."logicFunction"
        SET "deletedAt" = NOW()
        WHERE "workspaceId" = $1
          AND name = 'classify-and-upsert-qsr-chains'
          AND "deletedAt" IS NULL
      `,
      [workspaceId],
    );

    await this.coreDataSource.query(
      `
        UPDATE core.agent
        SET "deletedAt" = NOW()
        WHERE "workspaceId" = $1
          AND name = 'gtm-qsr-chain-classifier'
          AND "deletedAt" IS NULL
      `,
      [workspaceId],
    );

    const schemaNameForCleanup = getWorkspaceSchemaName(workspaceId);

    await this.coreDataSource.query(
      `
        UPDATE "${schemaNameForCleanup}"."workflowVersion" wv
        SET "deletedAt" = NOW(), status = 'DEACTIVATED'
        FROM "${schemaNameForCleanup}".workflow w
        WHERE wv."workflowId" = w.id
          AND w.name = 'Classify & Upsert QSR Chains'
          AND w."deletedAt" IS NULL
          AND wv."deletedAt" IS NULL
      `,
    );

    await this.coreDataSource.query(
      `
        UPDATE "${schemaNameForCleanup}".workflow
        SET "deletedAt" = NOW()
        WHERE name = 'Classify & Upsert QSR Chains'
          AND "deletedAt" IS NULL
      `,
    );

    this.logger.log(
      `Resync classify-and-upsert-local-places complete for workspace ${workspaceId}`,
    );
  }
}
