import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { renameBuyerTitlesKeyInIcpSpecJson } from 'src/engine/core-modules/outreach-command/utils/outreach-icp-spec.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { STANDARD_SKILL } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-skill.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { PrefillLogicFunctionService } from 'src/engine/workspace-manager/standard-objects-prefill-data/services/prefill-logic-function.service';
import { getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-workflow-code-step-logic-functions.util';
import { getOutreachLogicFunctionDefinitions } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-outreach-logic-functions.util';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const SKILL_UNIVERSAL_IDENTIFIERS_TO_SYNC = [
  STANDARD_SKILL.setup.universalIdentifier,
  STANDARD_SKILL.outreach.universalIdentifier,
] as const;

const ICP_SPEC_TABLES = [
  '_workspaceProfile',
  '_gtmWorkspaceProfile',
  '_project',
] as const;

type IcpSpecRow = {
  id: string;
  icpSpec: string | null;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000079)
@Command({
  name: 'upgrade:2-25:rename-icp-spec-buyer-titles-to-target-titles',
  description:
    'Rename icpSpec buyerTitles → targetTitles on workspaceProfile, gtmWorkspaceProfile, and Project; refresh setup/outreach skills and search logic functions',
})
export class RenameIcpSpecBuyerTitlesToTargetTitlesCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly prefillLogicFunctionService: PrefillLogicFunctionService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;
    const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Renaming icpSpec buyerTitles → targetTitles for workspace ${workspaceId}`,
    );

    let updatedRows = 0;

    for (const tableName of ICP_SPEC_TABLES) {
      updatedRows += await this.migrateIcpSpecTable({
        schema,
        tableName,
        workspaceId,
        isDryRun,
      });
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Workspace ${workspaceId}: ${updatedRows} icpSpec row(s) would be or were updated`,
    );

    if (isDryRun) {
      return;
    }

    await this.syncSkills(workspaceId);
    await this.prefillLogicFunctionService.ensureSeeded({
      workspaceId,
      definitions: [
        ...getCreateCompanyWhenAddingNewPersonCodeStepLogicFunctionDefinitions(
          workspaceId,
        ),
        ...getOutreachLogicFunctionDefinitions(workspaceId),
      ],
    });
  }

  private async migrateIcpSpecTable({
    schema,
    tableName,
    workspaceId,
    isDryRun,
  }: {
    schema: string;
    tableName: (typeof ICP_SPEC_TABLES)[number];
    workspaceId: string;
    isDryRun: boolean;
  }): Promise<number> {
    const tableExists = await this.workspaceQueryService.checkIfTableExists(
      schema,
      tableName,
    );

    if (!tableExists) {
      return 0;
    }

    const columnExists = await this.workspaceQueryService.checkIfColumnExists(
      schema,
      tableName,
      'icpSpec',
      { silent: true },
    );

    if (!columnExists) {
      return 0;
    }

    const rows = (await this.workspaceQueryService.executeWorkspaceRawQuery(
      `
        SELECT id, "icpSpec"
        FROM ${schema}."${tableName}"
        WHERE "deletedAt" IS NULL
          AND "icpSpec" IS NOT NULL
          AND "icpSpec" LIKE '%buyerTitles%'
      `,
      [],
      workspaceId,
    )) as IcpSpecRow[];

    let updatedCount = 0;

    for (const row of rows ?? []) {
      if (typeof row.icpSpec !== 'string' || row.icpSpec.trim().length === 0) {
        continue;
      }

      const { next, changed } = renameBuyerTitlesKeyInIcpSpecJson(row.icpSpec);

      if (!changed) {
        continue;
      }

      updatedCount += 1;

      if (isDryRun) {
        continue;
      }

      await this.workspaceQueryService.executeWorkspaceRawQuery(
        `UPDATE ${schema}."${tableName}" SET "icpSpec" = $2 WHERE id = $1`,
        [row.id, next],
        workspaceId,
      );
    }

    if (updatedCount > 0) {
      this.logger.log(
        `${isDryRun ? '[DRY RUN] ' : ''}Workspace ${workspaceId}: ${updatedCount} row(s) in ${tableName}`,
      );
    }

    return updatedCount;
  }

  private async syncSkills(workspaceId: string): Promise<void> {
    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { flatSkillMaps: existingFlatSkillMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatSkillMaps',
      ]);

    const { allFlatEntityMaps: standardAllFlatEntityMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        now: new Date().toISOString(),
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const skillsToCreate = [];
    const skillsToUpdate = [];

    for (const universalIdentifier of SKILL_UNIVERSAL_IDENTIFIERS_TO_SYNC) {
      const standardSkill =
        standardAllFlatEntityMaps.flatSkillMaps.byUniversalIdentifier[
          universalIdentifier
        ];

      if (!isDefined(standardSkill)) {
        continue;
      }

      const existingSkill =
        existingFlatSkillMaps.byUniversalIdentifier[universalIdentifier];

      if (!isDefined(existingSkill)) {
        skillsToCreate.push(standardSkill);
        continue;
      }

      if (
        existingSkill.content === standardSkill.content &&
        existingSkill.description === standardSkill.description &&
        existingSkill.label === standardSkill.label
      ) {
        continue;
      }

      skillsToUpdate.push({
        ...existingSkill,
        content: standardSkill.content,
        description: standardSkill.description,
        label: standardSkill.label,
      });
    }

    if (skillsToCreate.length === 0 && skillsToUpdate.length === 0) {
      this.logger.log(
        `Setup/outreach skills already up to date for workspace ${workspaceId}`,
      );

      return;
    }

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            skill: {
              flatEntityToCreate: skillsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: skillsToUpdate,
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new Error(
        `Failed to sync setup/outreach skills after icpSpec rename for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Synced setup/outreach skills after icpSpec rename for workspace ${workspaceId}`,
    );
  }
}
