import { Command } from 'nest-commander';
import { InjectRepository } from '@nestjs/typeorm';

import { type ObjectLiteral, type Repository } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { foldTimestampedIntoMessageObj } from 'src/engine/core-modules/outreach-command/utils/chat-message-turns.util';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { FieldMetadataEntity } from 'src/engine/metadata-modules/field-metadata/field-metadata.entity';
import { FieldMetadataService } from 'src/engine/metadata-modules/field-metadata/services/field-metadata.service';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

const FIELD_NAME = 'messageObjWithTimeStamp';

type ChatMessageRow = ObjectLiteral & {
  id: string;
  messageObj?: unknown;
  messageObjWithTimeStamp?: unknown;
};

@RegisteredWorkspaceCommand('2.25.0', 1785600000099)
@Command({
  name: 'upgrade:2-25:drop-chat-message-obj-with-time-stamp',
  description:
    'Fold chatMessage.messageObjWithTimeStamp into messageObj, then drop the duplicate field',
})
export class DropChatMessageObjWithTimeStampCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly workspaceQueryService: WorkspaceQueryService,
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
    const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);
    const chatMessageTable = `${schema}."_chatMessage"`;

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Folding ${FIELD_NAME} into messageObj for workspace ${workspaceId}`,
    );

    const hasTimestampColumn =
      await this.workspaceQueryService.checkIfColumnExists(
        schema,
        '_chatMessage',
        FIELD_NAME,
        { silent: true },
      );

    let scannedCount = 0;
    let updatedCount = 0;

    if (hasTimestampColumn) {
      const rows = (await this.workspaceQueryService.executeWorkspaceRawQuery(
        `
          SELECT id, "messageObj", "${FIELD_NAME}"
          FROM ${chatMessageTable}
          WHERE "deletedAt" IS NULL
            AND jsonb_typeof("${FIELD_NAME}") = 'array'
            AND jsonb_array_length("${FIELD_NAME}") > 0
        `,
        [],
        workspaceId,
      )) as ChatMessageRow[];

      scannedCount = rows.length;

      for (const row of rows) {
        const folded = foldTimestampedIntoMessageObj(
          row.messageObj,
          row.messageObjWithTimeStamp,
        );
        const currentJson = JSON.stringify(row.messageObj ?? []);
        const nextJson = JSON.stringify(folded);

        if (currentJson === nextJson) {
          continue;
        }

        updatedCount += 1;

        if (isDryRun) {
          continue;
        }

        await this.workspaceQueryService.executeWorkspaceRawQuery(
          `
            UPDATE ${chatMessageTable}
            SET "messageObj" = $2::jsonb
            WHERE id = $1
          `,
          [row.id, nextJson],
          workspaceId,
        );
      }
    } else {
      this.logger.log(
        `Workspace ${workspaceId}: ${FIELD_NAME} column already removed; skipping backfill`,
      );
    }

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Workspace ${workspaceId}: chatMessages scanned=${scannedCount}, messageObj backfilled=${updatedCount}`,
    );

    const fields = await this.fieldMetadataRepository.find({
      where: {
        workspaceId,
        name: FIELD_NAME,
      },
      relations: ['object'],
    });

    for (const field of fields) {
      if (field.object?.nameSingular !== 'chatMessage') {
        continue;
      }

      this.logger.log(
        `${isDryRun ? '[DRY RUN] ' : ''}Removing chatMessage.${FIELD_NAME} (${field.id})`,
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
          `Could not delete chatMessage.${FIELD_NAME}: ${
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
            `Could not deactivate chatMessage.${FIELD_NAME}: ${
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

    this.logger.log(
      `Synced Arxena standard application (chatMessage.${FIELD_NAME} removed) for workspace ${workspaceId}`,
    );
  }
}
