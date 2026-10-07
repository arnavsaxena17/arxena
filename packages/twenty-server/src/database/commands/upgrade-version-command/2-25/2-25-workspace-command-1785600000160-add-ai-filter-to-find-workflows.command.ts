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
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';
import { prefillOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-workflows.util';

// Old display name -> new display name. Runs before the re-seed so the seed
// finds (and rewrites) the existing workflows instead of creating duplicates.
const WORKFLOW_RENAMES: ReadonlyArray<readonly [string, string]> = [
  ['Harvest — LinkedIn Companies', SEEDED_OUTREACH_WORKFLOW.harvest.name],
  [
    'Company Created → ICP People Search',
    SEEDED_OUTREACH_WORKFLOW.companySearch.name,
  ],
  [
    'Search and Upload People Profiles',
    SEEDED_OUTREACH_WORKFLOW.searchAndUploadPeopleProfiles.name,
  ],
  [
    'Outreach — Fetch & Save People Profiles',
    SEEDED_OUTREACH_WORKFLOW.fetchAndSaveProfiles.name,
  ],
];

const GRAPHS_TO_SEED = [
  SEEDED_OUTREACH_WORKFLOW.harvest.name,
  SEEDED_OUTREACH_WORKFLOW.companySearch.name,
  SEEDED_OUTREACH_WORKFLOW.searchAndUploadPeopleProfiles.name,
  SEEDED_OUTREACH_WORKFLOW.fetchAndSaveProfiles.name,
] as const;

@RegisteredWorkspaceCommand('2.25.0', 1785600000160)
@Command({
  name: 'upgrade:2-25:add-ai-filter-to-find-workflows',
  description:
    'Rename the four people/company workflows (Find companies, Find people by company, Find people by search, Add people) and re-seed them as webhook workflows with an AI filtering step before saving',
})
export class AddAiFilterToFindWorkflowsCommand extends ProvisionedWorkspaceCommandRunner {
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
      `${isDryRun ? '[DRY RUN] ' : ''}Adding AI filter to Harvest / ICP People Search / Search and Upload for workspace ${workspaceId}`,
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

      for (const [oldName, newName] of WORKFLOW_RENAMES) {
        await queryRunner.query(
          `UPDATE "${schemaName}"."workflow" SET "name" = $1 WHERE "name" = $2`,
          [newName, oldName],
        );
        await queryRunner.query(
          `UPDATE "core"."workflow" SET "name" = $1 WHERE "name" = $2 AND "workspaceId" = $3`,
          [newName, oldName, workspaceId],
        );
      }

      await prefillOutreachWorkflows({
        entityManager: queryRunner.manager,
        workspaceId,
        schemaName,
        applicationId: workspaceCustomFlatApplication.id,
        replaceExistingDrafts: true,
        onlyGraphNames: GRAPHS_TO_SEED,
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

    this.logger.log(
      `AI filter workflows re-seed complete for workspace ${workspaceId}`,
    );
  }
}
