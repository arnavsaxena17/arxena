import { Command } from 'nest-commander';
import { InjectRepository } from '@nestjs/typeorm';

import { In, type Repository } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

const FIELDS_TO_DROP: Array<{
  objectName: 'candidate' | 'project';
  fieldName: string;
}> = [
  { objectName: 'candidate', fieldName: 'projectIds' },
  { objectName: 'candidate', fieldName: 'followUpIndex' },
  { objectName: 'project', fieldName: 'projectIds' },
];

@RegisteredWorkspaceCommand('2.25.0', 1785600000029)
@Command({
  name: 'upgrade:2-25:gtm-outreach-message-fields',
  description:
    'Drop Candidate/Project projectIds and Candidate followUpIndex; sync Message channel fields',
})
export class OutreachMessageFieldsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    @InjectRepository(FieldMetadataEntity)
    private readonly fieldMetadataRepository: Repository<FieldMetadataEntity>,
    private readonly fieldMetadataService: FieldMetadataService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}GTM outreach field cleanup for workspace ${workspaceId}`,
    );

    const fields = await this.fieldMetadataRepository.find({
      where: {
        workspaceId,
        name: In(['projectIds', 'followUpIndex']),
      },
      relations: ['object'],
    });

    for (const field of fields) {
      const objectName = field.object?.nameSingular;
      const shouldDrop = FIELDS_TO_DROP.some(
        (target) =>
          target.objectName === objectName && target.fieldName === field.name,
      );

      if (!shouldDrop) {
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
  }
}
