import { InjectDataSource } from '@nestjs/typeorm';
import { Command } from 'nest-commander';
import { DataSource } from 'typeorm';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { ArxenaStandardApplicationService } from 'src/engine/workspace-manager/arxena-standard-metadata/services/arxena-standard-application.service';

type FieldRename = {
  objectName: string;
  from: string;
  to: string;
  label: string;
};

const FIELD_RENAMES: FieldRename[] = [
  {
    objectName: 'company',
    from: 'gtmRunKey',
    to: 'projectIds',
    label: 'Project Ids',
  },
  {
    objectName: 'company',
    from: 'gtmFunnelStage',
    to: 'outreachFunnelStage',
    label: 'Funnel Stage',
  },
  {
    objectName: 'opportunity',
    from: 'gtmRunKey',
    to: 'projectId',
    label: 'Project Id',
  },
  {
    objectName: 'opportunity',
    from: 'sourcedFromGtm',
    to: 'sourcedFromOutreach',
    label: 'Sourced From Outreach',
  },
  {
    objectName: 'calendarEvent',
    from: 'gtmSourced',
    to: 'outreachSourced',
    label: 'Outreach Sourced',
  },
];

@RegisteredWorkspaceCommand('2.25.0', 1785600000075)
@Command({
  name: 'upgrade:2-25:rename-gtm-fields-to-outreach',
  description:
    'Rename gtmRunKey/gtmFunnelStage/sourcedFromGtm/gtmSourced fields to outreach/project names and sync Arxena standard metadata',
})
export class RenameGtmFieldsToOutreachCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly arxenaStandardApplicationService: ArxenaStandardApplicationService,
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
    const schemaName = getWorkspaceSchemaName(workspaceId);

    this.logger.log(
      `${isDryRun ? '[DRY RUN] ' : ''}Renaming GTM fields to outreach/project names for workspace ${workspaceId}`,
    );

    if (isDryRun) {
      for (const rename of FIELD_RENAMES) {
        this.logger.log(
          `Would rename ${rename.objectName}.${rename.from} → ${rename.to}`,
        );
      }

      return;
    }

    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      await queryRunner.startTransaction();

      for (const rename of FIELD_RENAMES) {
        await queryRunner.manager.query(
          `
            UPDATE core."fieldMetadata" fm
            SET name = $3, label = $4
            FROM core."objectMetadata" om
            WHERE fm."objectMetadataId" = om.id
              AND om."workspaceId" = $1
              AND om."nameSingular" = $2
              AND fm.name = $5
          `,
          [
            workspaceId,
            rename.objectName,
            rename.to,
            rename.label,
            rename.from,
          ],
        );

        const tableName = `_${rename.objectName}`;
        const columns = (await queryRunner.manager.query(
          `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = $1
              AND table_name = $2
              AND column_name = $3
          `,
          [schemaName, tableName, rename.from],
        )) as Array<{ column_name: string }>;

        if (columns.length > 0) {
          await queryRunner.manager.query(
            `
              ALTER TABLE ${schemaName}."${tableName}"
              RENAME COLUMN "${rename.from}" TO "${rename.to}"
            `,
          );
          this.logger.log(
            `Renamed column ${schemaName}.${tableName}.${rename.from} → ${rename.to}`,
          );
        }
      }

      const projectRenames = (await queryRunner.manager.query(
        `
          UPDATE ${schemaName}."_project"
          SET name = regexp_replace(name, '^GTM Project', 'Outreach Project'),
              "updatedAt" = NOW()
          WHERE name LIKE 'GTM Project%'
            AND "deletedAt" IS NULL
          RETURNING id
        `,
      )) as Array<{ id: string }>;

      const projectRunRenames = (await queryRunner.manager.query(
        `
          UPDATE ${schemaName}."_project"
          SET name = regexp_replace(name, '^GTM Run', 'Outreach Project'),
              "updatedAt" = NOW()
          WHERE name LIKE 'GTM Run%'
            AND "deletedAt" IS NULL
          RETURNING id
        `,
      )) as Array<{ id: string }>;

      this.logger.log(
        `Renamed ${projectRenames.length + projectRunRenames.length} project name prefix(es)`,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.arxenaStandardApplicationService.synchronizeArxenaStandardApplicationOrThrow(
      { workspaceId },
    );

    await this.workspaceCacheService.invalidateAndRecompute(workspaceId, [
      'flatObjectMetadataMaps',
      'flatFieldMetadataMaps',
    ]);

    this.logger.log(
      `Rename GTM fields to outreach complete for workspace ${workspaceId}`,
    );
  }
}
