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

// Identity fields moved to Person — drop Candidate copies after backfill soak.
const CANDIDATE_IDENTITY_FIELDS_TO_DROP = [
  'email',
  'phoneNumber',
  'linkedinUrl',
  'linkedinProfileId',
  'jobTitle',
  'jobCompanyName',
  'locationName',
  'uniqueStringKey',
  'displayPicture',
  'avatarUrl',
  'hiringNaukriUrl',
  'resdexNaukriUrl',
  'linkedinProfile',
  'linkedinPosts',
  'outreachPreferredChannel',
] as const;

@RegisteredWorkspaceCommand('2.25.0', 1785600000123)
@Command({
  name: 'upgrade:2-25:drop-candidate-identity-fields',
  description:
    'Drop Candidate identity fields that now live on Person (after backfill)',
})
export class DropCandidateIdentityFieldsCommand extends ProvisionedWorkspaceCommandRunner {
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
      `${isDryRun ? '[DRY RUN] ' : ''}Dropping Candidate identity fields for workspace ${workspaceId}`,
    );

    const fields = await this.fieldMetadataRepository.find({
      where: {
        workspaceId,
        name: In([...CANDIDATE_IDENTITY_FIELDS_TO_DROP]),
      },
      relations: ['object'],
    });

    for (const field of fields) {
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

    if (!isDryRun) {
      await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
        { workspaceId },
      );
    }
  }
}
