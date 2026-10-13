import { Injectable, Logger } from '@nestjs/common';

import { planStandardSkillSync } from 'src/database/commands/upgrade-version-command/common/plan-standard-skill-sync.util';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

// One reconciler for every standard skill row. It replaces a sync command per
// skill edit: the text itself is served from code (see SkillService), so the
// stored rows only need to exist and carry the current label and description.
@Injectable()
export class StandardSkillSyncService {
  private readonly logger = new Logger(StandardSkillSyncService.name);

  constructor(
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
  ) {}

  async syncWorkspace({
    workspaceId,
    isDryRun,
  }: {
    workspaceId: string;
    isDryRun: boolean;
  }): Promise<{ created: string[]; updated: string[] }> {
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

    const { skillsToCreate, skillsToUpdate } = planStandardSkillSync({
      existingFlatSkillMaps,
      standardFlatSkillMaps: standardAllFlatEntityMaps.flatSkillMaps,
    });
    const created = skillsToCreate.map((skill) => skill.name);
    const updated = skillsToUpdate.map((skill) => skill.name);

    if (created.length === 0 && updated.length === 0) {
      this.logger.log(
        `Standard skills already up to date for workspace ${workspaceId}`,
      );

      return { created, updated };
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Workspace ${workspaceId}: create=${created.join(',') || 'none'} update=${updated.join(',') || 'none'}`,
    );

    if (isDryRun) {
      return { created, updated };
    }

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          isSystemBuild: true,
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
        `Failed to sync standard skills:\n${JSON.stringify(validateAndBuildResult, null, 2)}`,
      );

      throw new Error(
        `Failed to sync standard skills for workspace ${workspaceId}`,
      );
    }

    return { created, updated };
  }
}
