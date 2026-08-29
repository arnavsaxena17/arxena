import { Command } from 'nest-commander';
import { InjectRepository } from '@nestjs/typeorm';
import { isDefined } from 'twenty-shared/utils';

import { In, type Repository } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { STANDARD_SKILL } from 'src/engine/workspace-manager/twenty-standard-application/constants/standard-skill.constant';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const GTM_ICP_BLURB_FIELDS = [
  'icpBlurb',
  'companySearchBlurb',
  'peopleSearchBlurb',
] as const;

const OBJECTS_WITH_ICP_SEGMENT_TO_DROP = new Set([
  'workspaceProfile',
  'project',
]);

const OBJECTS_WITH_BLURB_FIELDS_TO_DROP = new Set([
  'workspaceProfile',
  'project',
]);

@RegisteredWorkspaceCommand('2.25.0', 1785600000049)
@Command({
  name: 'upgrade:2-25:drop-gtm-icp-blurb-fields',
  description:
    'Drop unused GTM ICP segment/blurb fields from workspaceProfile and Project; keep icpSpec only',
})
export class DropGtmIcpBlurbFieldsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    @InjectRepository(FieldMetadataEntity)
    private readonly fieldMetadataRepository: Repository<FieldMetadataEntity>,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Dropping GTM ICP blurb/segment fields for workspace ${workspaceId}`,
    );

    const fields = await this.fieldMetadataRepository.find({
      where: {
        workspaceId,
        name: In(['icpSegment', ...GTM_ICP_BLURB_FIELDS]),
      },
      relations: ['object'],
    });

    for (const field of fields) {
      const objectName = field.object?.nameSingular;

      if (!isDefined(objectName)) {
        continue;
      }

      const shouldDropSegment =
        field.name === 'icpSegment' &&
        OBJECTS_WITH_ICP_SEGMENT_TO_DROP.has(objectName);
      const shouldDropBlurb =
        GTM_ICP_BLURB_FIELDS.includes(
          field.name as (typeof GTM_ICP_BLURB_FIELDS)[number],
        ) && OBJECTS_WITH_BLURB_FIELDS_TO_DROP.has(objectName);

      if (!shouldDropSegment && !shouldDropBlurb) {
        continue;
      }

      this.logger.log(
        `${isDryRun ? '[DRY RUN] ' : ''}Removing ${objectName}.${field.name} (${field.id})`,
      );

      if (isDryRun) {
        continue;
      }

      try {
        await this.fieldMetadataService.deleteOneField({
          deleteOneFieldInput: { id: field.id },
          workspaceId,
          isSystemBuild: true,
        });
      } catch (error) {
        this.logger.warn(
          `Could not delete ${objectName}.${field.name}: ${
            error instanceof Error ? error.message : String(error)
          }. Deactivating instead.`,
        );

        try {
          await this.fieldMetadataService.updateOneField({
            updateFieldInput: {
              id: field.id,
              isActive: false,
            },
            workspaceId,
            isSystemBuild: true,
          });
        } catch (updateError) {
          this.logger.warn(
            `Could not deactivate ${objectName}.${field.name}: ${
              updateError instanceof Error
                ? updateError.message
                : String(updateError)
            }`,
          );
        }
      }
    }

    if (isDryRun) {
      return;
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    await this.syncIcpOnboardingSkill(workspaceId);
  }

  private async syncIcpOnboardingSkill(workspaceId: string): Promise<void> {
    const universalIdentifier =
      STANDARD_SKILL.setup.universalIdentifier;
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
    const standardSkill =
      standardAllFlatEntityMaps.flatSkillMaps.byUniversalIdentifier[
        universalIdentifier
      ];

    if (!isDefined(standardSkill)) {
      return;
    }

    const existingSkill =
      existingFlatSkillMaps.byUniversalIdentifier[universalIdentifier];

    if (
      isDefined(existingSkill) &&
      existingSkill.content === standardSkill.content &&
      existingSkill.description === standardSkill.description &&
      existingSkill.label === standardSkill.label
    ) {
      return;
    }

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunLegacyWorkspaceMigration(
        {
          allFlatEntityOperationByMetadataName: {
            skill: {
              flatEntityToCreate: isDefined(existingSkill)
                ? []
                : [standardSkill],
              flatEntityToDelete: [],
              flatEntityToUpdate: isDefined(existingSkill)
                ? [
                    {
                      ...existingSkill,
                      content: standardSkill.content,
                      description: standardSkill.description,
                      label: standardSkill.label,
                    },
                  ]
                : [],
            },
          },
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new Error(
        `Failed to sync gtm-icp-onboarding skill for workspace ${workspaceId}`,
      );
    }
  }
}
