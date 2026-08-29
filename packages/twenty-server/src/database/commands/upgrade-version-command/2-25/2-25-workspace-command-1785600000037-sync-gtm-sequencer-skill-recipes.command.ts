import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import {
  RETIRED_STANDARD_SKILL_UNIVERSAL_IDENTIFIERS,
  STANDARD_SKILL,
} from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-skill.constant';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const SKILL_UNIVERSAL_IDENTIFIERS_TO_SYNC = [
  STANDARD_SKILL['workflow-building'].universalIdentifier,
  STANDARD_SKILL.outreach.universalIdentifier,
  STANDARD_SKILL.search.universalIdentifier,
  RETIRED_STANDARD_SKILL_UNIVERSAL_IDENTIFIERS.searchPeople,
  STANDARD_SKILL['dashboard-building'].universalIdentifier,
  STANDARD_SKILL.setup.universalIdentifier,
] as const;

@RegisteredWorkspaceCommand('2.25.0', 1785600000037)
@Command({
  name: 'upgrade:2-25:sync-gtm-sequencer-skill-recipes',
  description:
    'Sync GTM sequencer skill recipes (harvest CRON, linkedinFollowUpCount, people-tab vs enroll)',
})
export class SyncOutreachSequencerSkillRecipesCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Syncing GTM sequencer skill recipes for workspace ${workspaceId}`,
    );

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
        `GTM sequencer skill recipes already up to date for workspace ${workspaceId}`,
      );

      return;
    }

    this.logger.log(
      `Workspace ${workspaceId}: create=${skillsToCreate.map((skill) => skill.name).join(',') || 'none'} update=${skillsToUpdate.map((skill) => skill.name).join(',') || 'none'}`,
    );

    if (isDryRun) {
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
      this.logger.error(
        `Failed to sync GTM sequencer skill recipes:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );

      throw new Error(
        `Failed to sync GTM sequencer skill recipes for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Synced GTM sequencer skill recipes for workspace ${workspaceId}`,
    );
  }
}
