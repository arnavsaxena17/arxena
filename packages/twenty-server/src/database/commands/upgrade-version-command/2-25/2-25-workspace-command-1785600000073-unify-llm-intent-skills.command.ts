import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import {
  RETIRED_STANDARD_SKILL_UNIVERSAL_IDENTIFIERS,
  STANDARD_SKILL,
} from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-skill.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const INTENT_SKILL_UNIVERSAL_IDENTIFIERS = [
  STANDARD_SKILL.setup.universalIdentifier,
  STANDARD_SKILL.search.universalIdentifier,
  STANDARD_SKILL.outreach.universalIdentifier,
  STANDARD_SKILL['workflow-building'].universalIdentifier,
  STANDARD_SKILL.research.universalIdentifier,
] as const;

@RegisteredWorkspaceCommand('2.25.0', 1785600000073)
@Command({
  name: 'upgrade:2-25:unify-llm-intent-skills',
  description:
    'Rename GTM skills to setup/search/outreach, sync recipes, delete merged skills',
})
export class UnifyLlmIntentSkillsCommand extends ProvisionedWorkspaceCommandRunner {
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
      `${isDryRun ? '[DRY RUN] ' : ''}Unifying LLM intent skills for workspace ${workspaceId}`,
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
    const skillsToDelete = [];

    for (const universalIdentifier of INTENT_SKILL_UNIVERSAL_IDENTIFIERS) {
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
        existingSkill.name === standardSkill.name &&
        existingSkill.content === standardSkill.content &&
        existingSkill.description === standardSkill.description &&
        existingSkill.label === standardSkill.label &&
        existingSkill.isActive === standardSkill.isActive
      ) {
        continue;
      }

      skillsToUpdate.push({
        ...existingSkill,
        name: standardSkill.name,
        label: standardSkill.label,
        description: standardSkill.description,
        content: standardSkill.content,
        isActive: standardSkill.isActive,
      });
    }

    for (const universalIdentifier of Object.values(
      RETIRED_STANDARD_SKILL_UNIVERSAL_IDENTIFIERS,
    )) {
      const existingSkill =
        existingFlatSkillMaps.byUniversalIdentifier[universalIdentifier];

      if (isDefined(existingSkill)) {
        skillsToDelete.push(existingSkill);
      }
    }

    if (
      skillsToCreate.length === 0 &&
      skillsToUpdate.length === 0 &&
      skillsToDelete.length === 0
    ) {
      this.logger.log(
        `LLM intent skills already up to date for workspace ${workspaceId}`,
      );

      return;
    }

    this.logger.log(
      `Workspace ${workspaceId}: create=${skillsToCreate.map((skill) => skill.name).join(',') || 'none'} update=${skillsToUpdate.map((skill) => skill.name).join(',') || 'none'} delete=${skillsToDelete.map((skill) => skill.name).join(',') || 'none'}`,
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
              flatEntityToDelete: skillsToDelete,
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
        `Failed to unify LLM intent skills:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );

      throw new Error(
        `Failed to unify LLM intent skills for workspace ${workspaceId}`,
      );
    }

    this.logger.log(
      `Unified LLM intent skills for workspace ${workspaceId}`,
    );
  }
}
