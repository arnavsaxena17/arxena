import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { isDefined } from 'twenty-shared/utils';

import { In, type Repository, DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';
import { prefillGtmOutreachWorkflows } from 'src/engine/workspace-manager/standard-objects-prefill-data/utils/prefill-gtm-outreach-workflows.util';

const FIELDS_TO_DROP_BY_OBJECT: Record<string, readonly string[]> = {
  person: [
    'oooUntil',
    'bounceCount',
    'notInterestedAt',
    'unsubscribedAt',
    'linkedinConnectionDegree',
  ],
  candidate: [
    'pendingMessageBody',
    'stoppedReason',
    'enrichedAt',
    'linkedinProfileSnapshot',
    'connectionDegree',
    'personaPriorityScore',
    'connectionStatus',
  ],
  company: ['daysSinceLastTouch', 'gtmStatus'],
};

const ALL_FIELD_NAMES = [
  ...new Set(Object.values(FIELDS_TO_DROP_BY_OBJECT).flat()),
];

@RegisteredWorkspaceCommand('2.25.0', 1785600000050)
@Command({
  name: 'upgrade:2-25:drop-gtm-vanity-fields',
  description:
    'Drop unused GTM vanity/duplicate fields; collapse connectionStatus into outreachSequenceStage CONNECTION_IGNORED',
})
export class DropGtmVanityFieldsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    @InjectRepository(FieldMetadataEntity)
    private readonly fieldMetadataRepository: Repository<FieldMetadataEntity>,
    private readonly fieldMetadataService: FieldMetadataService,
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
      `${isDryRun ? '[DRY RUN] ' : ''}Dropping GTM vanity fields for workspace ${workspaceId}`,
    );

    const fields = await this.fieldMetadataRepository.find({
      where: {
        workspaceId,
        name: In(ALL_FIELD_NAMES),
      },
      relations: ['object'],
    });

    for (const field of fields) {
      const objectName = field.object?.nameSingular;

      if (!isDefined(objectName)) {
        continue;
      }

      const names = FIELDS_TO_DROP_BY_OBJECT[objectName];

      if (!names?.includes(field.name)) {
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

    const schemaName = getWorkspaceSchemaName(workspaceId);
    const { workspaceCustomFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );
    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();
      await prefillGtmOutreachWorkflows({
        entityManager: queryRunner.manager,
        workspaceId,
        schemaName,
        applicationId: workspaceCustomFlatApplication.id,
        replaceExistingDrafts: true,
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
  }
}
