import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, Repository } from 'typeorm';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { isDefined } from 'twenty-shared/utils';
import { v4 } from 'uuid';

import {
  LEGACY_COLUMN_RENAMES,
  LEGACY_COLUMN_RENAMES_BY_TABLE,
  LEGACY_CRM_LOAD_ORDER,
  LEGACY_TABLE_RENAMES,
  WORKSPACE_ARX_KEY_COLUMNS,
  WORKSPACE_MEMBER_ID_COLUMNS,
} from 'src/database/commands/workspace-import-legacy/workspace-import-legacy.constants';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context.type';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

type LegacyWorkspaceRow = {
  id: string;
  displayName: string;
  subdomain: string;
  inviteHash: string | null;
  logo: string | null;
  activationStatus: string;
};

type LegacyUserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string | null;
  canImpersonate: boolean;
  isEmailVerified: boolean;
  disabled: boolean;
  locale: string;
};

@Injectable()
export class WorkspaceImportLegacyService {
  private readonly logger = new Logger(WorkspaceImportLegacyService.name);

  constructor(
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly applicationService: ApplicationService,
    private readonly userWorkspaceService: UserWorkspaceService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async importFromSourceDatabaseUrl({
    sourceDatabaseUrl,
    workspaceIds,
    dryRun = false,
  }: {
    sourceDatabaseUrl: string;
    workspaceIds?: string[];
    dryRun?: boolean;
  }): Promise<void> {
    const sourceDataSource = new DataSource({
      type: 'postgres',
      url: sourceDatabaseUrl,
      logging: false,
    });

    await sourceDataSource.initialize();

    try {
      const legacyWorkspaces = await this.loadLegacyWorkspaces(
        sourceDataSource,
        workspaceIds,
      );

      this.logger.log(
        `Found ${legacyWorkspaces.length} legacy workspace(s) to import`,
      );

      for (const legacyWorkspace of legacyWorkspaces) {
        await this.importWorkspace({
          sourceDataSource,
          legacyWorkspace,
          dryRun,
        });
      }
    } finally {
      await sourceDataSource.destroy();
    }
  }

  private async loadLegacyWorkspaces(
    sourceDataSource: DataSource,
    workspaceIds?: string[],
  ): Promise<LegacyWorkspaceRow[]> {
    const rows = await sourceDataSource.query(
      `
        SELECT
          w.id,
          w."displayName",
          w.subdomain,
          w."inviteHash",
          w.logo,
          w."activationStatus"::text AS "activationStatus"
        FROM core.workspace w
        WHERE w."deletedAt" IS NULL
          AND w."activationStatus"::text IN ('ACTIVE', 'SUSPENDED', 'CREATED')
          ${
            isDefined(workspaceIds) && workspaceIds.length > 0
              ? `AND w.id = ANY($1)`
              : ''
          }
        ORDER BY w."createdAt" ASC
      `,
      isDefined(workspaceIds) && workspaceIds.length > 0
        ? [workspaceIds]
        : [],
    );

    return rows as LegacyWorkspaceRow[];
  }

  private async importWorkspace({
    sourceDataSource,
    legacyWorkspace,
    dryRun,
  }: {
    sourceDataSource: DataSource;
    legacyWorkspace: LegacyWorkspaceRow;
    dryRun: boolean;
  }): Promise<void> {
    const sourceSchema = getWorkspaceSchemaName(legacyWorkspace.id);
    const targetSchema = sourceSchema;

    this.logger.log(
      `Importing workspace ${legacyWorkspace.displayName} (${legacyWorkspace.id}) schema=${sourceSchema}`,
    );

    const existing = await this.workspaceRepository.findOne({
      where: { id: legacyWorkspace.id },
      withDeleted: true,
    });

    if (dryRun) {
      this.logger.log(
        `DRY RUN — would import ${legacyWorkspace.subdomain} from ${sourceSchema}`,
      );

      return;
    }

    if (
      isDefined(existing) &&
      !isDefined(existing.deletedAt) &&
      (existing.activationStatus === WorkspaceActivationStatus.ACTIVE ||
        existing.activationStatus === WorkspaceActivationStatus.CREATED)
    ) {
      this.logger.log(
        `Workspace ${legacyWorkspace.id} already activated — re-running CRM ETL only`,
      );

      const ownerUser = await this.ensureOwnerUser({
        sourceDataSource,
        workspaceId: legacyWorkspace.id,
      });

      await this.copyWorkspaceArxKeys({
        sourceDataSource,
        workspaceId: legacyWorkspace.id,
      });

      const memberIdMap = await this.buildWorkspaceMemberIdMap({
        sourceDataSource,
        sourceSchema,
        targetSchema,
        ownerUserId: ownerUser.id,
      });

      await this.clearPrefillData(targetSchema);

      await this.copyCrmTables({
        sourceDataSource,
        sourceSchema,
        targetSchema,
        memberIdMap,
      });

      this.logger.log(
        `Finished CRM re-import for workspace ${legacyWorkspace.subdomain}`,
      );

      return;
    }

    if (isDefined(existing?.deletedAt)) {
      await this.workspaceService.deleteWorkspace(legacyWorkspace.id);
    }

    if (isDefined(existing) && !isDefined(existing.deletedAt)) {
      this.logger.warn(
        `Workspace ${legacyWorkspace.id} exists in status ${existing.activationStatus} — skipping`,
      );

      return;
    }

    const ownerUser = await this.ensureOwnerUser({
      sourceDataSource,
      workspaceId: legacyWorkspace.id,
    });

    await this.createWorkspaceShell({
      legacyWorkspace,
      ownerUser,
    });

    const workspace = await this.workspaceRepository.findOneByOrFail({
      id: legacyWorkspace.id,
    });

    await this.workspaceService.activateWorkspace(
      ownerUser as AuthContextUser,
      workspace,
    );

    await this.copyWorkspaceArxKeys({
      sourceDataSource,
      workspaceId: legacyWorkspace.id,
    });

    const memberIdMap = await this.buildWorkspaceMemberIdMap({
      sourceDataSource,
      sourceSchema,
      targetSchema,
      ownerUserId: ownerUser.id,
    });

    await this.clearPrefillData(targetSchema);

    await this.copyCrmTables({
      sourceDataSource,
      sourceSchema,
      targetSchema,
      memberIdMap,
    });

    this.logger.log(
      `Finished importing workspace ${legacyWorkspace.subdomain}`,
    );
  }

  private async ensureOwnerUser({
    sourceDataSource,
    workspaceId,
  }: {
    sourceDataSource: DataSource;
    workspaceId: string;
  }): Promise<UserEntity> {
    const [legacyUserWorkspace] = await sourceDataSource.query(
      `
        SELECT uw."userId"
        FROM core."userWorkspace" uw
        WHERE uw."workspaceId" = $1
        ORDER BY uw."createdAt" ASC
        LIMIT 1
      `,
      [workspaceId],
    );

    if (!isDefined(legacyUserWorkspace?.userId)) {
      throw new Error(
        `No userWorkspace found for legacy workspace ${workspaceId}`,
      );
    }

    const [legacyUser] = (await sourceDataSource.query(
      `
        SELECT
          id,
          email,
          "firstName",
          "lastName",
          "passwordHash",
          "canImpersonate",
          "isEmailVerified",
          disabled,
          locale
        FROM core."user"
        WHERE id = $1
      `,
      [legacyUserWorkspace.userId],
    )) as LegacyUserRow[];

    if (!isDefined(legacyUser)) {
      throw new Error(`Legacy user ${legacyUserWorkspace.userId} not found`);
    }

    const existingByEmail = await this.userRepository.findOne({
      where: { email: legacyUser.email.toLowerCase() },
    });

    if (isDefined(existingByEmail)) {
      return existingByEmail;
    }

    const existingById = await this.userRepository.findOne({
      where: { id: legacyUser.id },
    });

    if (isDefined(existingById)) {
      return existingById;
    }

    const created = this.userRepository.create({
      id: legacyUser.id,
      email: legacyUser.email.toLowerCase(),
      firstName: legacyUser.firstName ?? '',
      lastName: legacyUser.lastName ?? '',
      passwordHash: legacyUser.passwordHash,
      canImpersonate: legacyUser.canImpersonate ?? false,
      canAccessFullAdminPanel: legacyUser.canImpersonate ?? false,
      isEmailVerified: legacyUser.isEmailVerified ?? true,
      disabled: legacyUser.disabled ?? false,
      locale: (legacyUser.locale as UserEntity['locale']) ?? 'en',
    });

    return this.userRepository.save(created);
  }

  private async createWorkspaceShell({
    legacyWorkspace,
    ownerUser,
  }: {
    legacyWorkspace: LegacyWorkspaceRow;
    ownerUser: UserEntity;
  }): Promise<void> {
    const workspaceCustomApplicationId = v4();
    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const workspaceToCreate = this.workspaceRepository.create({
        id: legacyWorkspace.id,
        subdomain: legacyWorkspace.subdomain,
        workspaceCustomApplicationId,
        displayName: legacyWorkspace.displayName,
        inviteHash: legacyWorkspace.inviteHash ?? v4(),
        logo: legacyWorkspace.logo ?? undefined,
        activationStatus: WorkspaceActivationStatus.PENDING_CREATION,
      });

      await queryRunner.manager.save(WorkspaceEntity, workspaceToCreate);

      await this.applicationService.createWorkspaceCustomApplication(
        {
          workspaceId: legacyWorkspace.id,
          applicationId: workspaceCustomApplicationId,
        },
        queryRunner,
      );

      await this.userWorkspaceService.create(
        {
          userId: ownerUser.id,
          workspaceId: legacyWorkspace.id,
          isExistingUser: true,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async copyWorkspaceArxKeys({
    sourceDataSource,
    workspaceId,
  }: {
    sourceDataSource: DataSource;
    workspaceId: string;
  }): Promise<void> {
    const quotedColumns = WORKSPACE_ARX_KEY_COLUMNS.map(
      (columnName) => `"${columnName}"`,
    ).join(', ');

    const [legacyWorkspaceKeys] = await sourceDataSource.query(
      `SELECT ${quotedColumns} FROM core.workspace WHERE id = $1`,
      [workspaceId],
    );

    if (!isDefined(legacyWorkspaceKeys)) {
      return;
    }

    const setClauses = WORKSPACE_ARX_KEY_COLUMNS.map(
      (columnName, index) => `"${columnName}" = $${index + 2}`,
    ).join(', ');

    const values = WORKSPACE_ARX_KEY_COLUMNS.map(
      (columnName) => legacyWorkspaceKeys[columnName] ?? null,
    );

    await this.coreDataSource.query(
      `UPDATE core.workspace SET ${setClauses} WHERE id = $1`,
      [workspaceId, ...values],
    );

    this.logger.log(`Copied ARX workspace key columns for ${workspaceId}`);
  }

  private async buildWorkspaceMemberIdMap({
    sourceDataSource,
    sourceSchema,
    targetSchema,
    ownerUserId,
  }: {
    sourceDataSource: DataSource;
    sourceSchema: string;
    targetSchema: string;
    ownerUserId: string;
  }): Promise<Map<string, string>> {
    const memberIdMap = new Map<string, string>();

    const legacyMembers = await sourceDataSource.query(
      `
        SELECT id, "userId"
        FROM "${sourceSchema}"."workspaceMember"
        WHERE "deletedAt" IS NULL
      `,
    );

    const targetMembers = await this.coreDataSource.query(
      `
        SELECT id, "userId"
        FROM "${targetSchema}"."workspaceMember"
        WHERE "deletedAt" IS NULL
      `,
    );

    const targetByUserId = new Map<string, string>(
      targetMembers.map((member: { id: string; userId: string }) => [
        member.userId,
        member.id,
      ]),
    );

    for (const legacyMember of legacyMembers as Array<{
      id: string;
      userId: string;
    }>) {
      const targetMemberId =
        targetByUserId.get(legacyMember.userId) ??
        targetByUserId.get(ownerUserId);

      if (isDefined(targetMemberId)) {
        memberIdMap.set(legacyMember.id, targetMemberId);
      }
    }

    this.logger.log(
      `Mapped ${memberIdMap.size} workspaceMember id(s) for ${targetSchema}`,
    );

    return memberIdMap;
  }

  private async clearPrefillData(targetSchema: string): Promise<void> {
    const tables = await this.listTables(this.coreDataSource, targetSchema);
    const tablesToClear = tables.filter(
      (tableName) => tableName !== 'workspaceMember',
    );

    if (tablesToClear.length === 0) {
      return;
    }

    const quoted = tablesToClear
      .map((tableName) => `"${targetSchema}"."${tableName}"`)
      .join(', ');

    await this.coreDataSource.query(
      `TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`,
    );
  }

  private async copyCrmTables({
    sourceDataSource,
    sourceSchema,
    targetSchema,
    memberIdMap,
  }: {
    sourceDataSource: DataSource;
    sourceSchema: string;
    targetSchema: string;
    memberIdMap: Map<string, string>;
  }): Promise<void> {
    const sourceTables = await this.listTables(sourceDataSource, sourceSchema);
    const targetTables = new Set(
      await this.listTables(this.coreDataSource, targetSchema),
    );

    const loadOrder = [
      ...LEGACY_CRM_LOAD_ORDER,
      ...sourceTables
        .map((tableName) => LEGACY_TABLE_RENAMES[tableName] ?? tableName)
        .filter(
          (tableName) =>
            !LEGACY_CRM_LOAD_ORDER.includes(tableName) &&
            tableName !== 'workspaceMember',
        ),
    ];

    await this.coreDataSource.query('SET session_replication_role = replica');

    try {
      for (const targetTableName of loadOrder) {
        if (!targetTables.has(targetTableName)) {
          continue;
        }

        const sourceTableName =
          Object.entries(LEGACY_TABLE_RENAMES).find(
            ([, targetName]) => targetName === targetTableName,
          )?.[0] ?? targetTableName;

        if (!sourceTables.includes(sourceTableName)) {
          continue;
        }

        const inserted = await this.copyTable({
          sourceDataSource,
          sourceSchema,
          sourceTableName,
          targetSchema,
          targetTableName,
          memberIdMap,
        });

        if (inserted > 0) {
          this.logger.log(
            `Copied ${inserted} row(s) ${sourceTableName} → ${targetTableName}`,
          );
        }
      }
    } finally {
      await this.coreDataSource.query(
        'SET session_replication_role = DEFAULT',
      );
    }
  }

  private async copyTable({
    sourceDataSource,
    sourceSchema,
    sourceTableName,
    targetSchema,
    targetTableName,
    memberIdMap,
  }: {
    sourceDataSource: DataSource;
    sourceSchema: string;
    sourceTableName: string;
    targetSchema: string;
    targetTableName: string;
    memberIdMap: Map<string, string>;
  }): Promise<number> {
    const sourceColumns = await this.listColumns(
      sourceDataSource,
      sourceSchema,
      sourceTableName,
    );
    const targetColumns = await this.listColumns(
      this.coreDataSource,
      targetSchema,
      targetTableName,
    );
    const targetColumnSet = new Set(targetColumns);
    const generatedColumns = await this.listGeneratedColumns(
      this.coreDataSource,
      targetSchema,
      targetTableName,
    );
    const jsonColumns = await this.listJsonColumns(
      this.coreDataSource,
      targetSchema,
      targetTableName,
    );
    const enumColumns = await this.listEnumColumns(
      this.coreDataSource,
      targetSchema,
      targetTableName,
    );

    const tableRenames = {
      ...LEGACY_COLUMN_RENAMES,
      ...(LEGACY_COLUMN_RENAMES_BY_TABLE[targetTableName] ?? {}),
    };

    const columnPairs: Array<{ source: string | null; target: string }> = [];

    for (const sourceColumn of sourceColumns) {
      const targetColumn = this.resolveTargetColumnName({
        sourceColumn,
        targetColumnSet,
        tableRenames,
      });

      if (
        !isDefined(targetColumn) ||
        generatedColumns.has(targetColumn)
      ) {
        continue;
      }

      columnPairs.push({ source: sourceColumn, target: targetColumn });
    }

    const pairedTargets = new Set(columnPairs.map((pair) => pair.target));

    for (const targetColumn of targetColumns) {
      if (
        pairedTargets.has(targetColumn) ||
        generatedColumns.has(targetColumn)
      ) {
        continue;
      }

      const defaultValue = this.defaultValueForMissingColumn(targetColumn);

      if (defaultValue === undefined) {
        continue;
      }

      columnPairs.push({ source: null, target: targetColumn });
    }

    if (columnPairs.length === 0) {
      return 0;
    }

    const sourceSelectColumns = columnPairs
      .filter((pair) => isDefined(pair.source))
      .map((pair) => `"${pair.source}"`);

    const rows =
      sourceSelectColumns.length === 0
        ? []
        : await sourceDataSource.query(
            `SELECT ${sourceSelectColumns.join(', ')} FROM "${sourceSchema}"."${sourceTableName}"`,
          );

    if (rows.length === 0) {
      return 0;
    }

    const queryRunner = this.coreDataSource.createQueryRunner();

    await queryRunner.connect();

    try {
      let insertedCount = 0;

      for (const row of rows) {
        const values = columnPairs.map((pair) => {
          const rawValue = isDefined(pair.source)
            ? row[pair.source]
            : this.defaultValueForMissingColumn(pair.target);

          let normalizedValue = this.normalizeValueForInsert({
            value: rawValue,
            targetColumn: pair.target,
            jsonColumns,
            enumColumns,
            memberIdMap,
          });

          if (
            pair.target === 'position' &&
            (normalizedValue === null || normalizedValue === undefined)
          ) {
            normalizedValue = 0;
          }

          return normalizedValue;
        });

        const placeholders = values
          .map((_, index) => `$${index + 1}`)
          .join(', ');
        const targetColumnList = columnPairs
          .map((pair) => `"${pair.target}"`)
          .join(', ');

        try {
          await queryRunner.query(
            `
              INSERT INTO "${targetSchema}"."${targetTableName}" (${targetColumnList})
              VALUES (${placeholders})
              ON CONFLICT DO NOTHING
            `,
            values,
          );
          insertedCount += 1;
        } catch (error) {
          this.logger.warn(
            `Skipped row in ${targetTableName}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      return insertedCount;
    } finally {
      await queryRunner.release();
    }
  }

  // Prefer explicit renames, then same name, then morph fooId → targetFooId
  private resolveTargetColumnName({
    sourceColumn,
    targetColumnSet,
    tableRenames,
  }: {
    sourceColumn: string;
    targetColumnSet: Set<string>;
    tableRenames: Record<string, string>;
  }): string | null {
    const renamedColumn = tableRenames[sourceColumn];

    if (isDefined(renamedColumn) && targetColumnSet.has(renamedColumn)) {
      return renamedColumn;
    }

    if (targetColumnSet.has(sourceColumn)) {
      return sourceColumn;
    }

    if (sourceColumn.endsWith('Id') && sourceColumn !== 'id') {
      const morphTargetColumn = `target${sourceColumn[0].toUpperCase()}${sourceColumn.slice(1)}`;

      if (targetColumnSet.has(morphTargetColumn)) {
        return morphTargetColumn;
      }
    }

    return null;
  }

  private defaultValueForMissingColumn(columnName: string): unknown {
    switch (columnName) {
      case 'updatedBySource':
      case 'createdBySource':
        return 'MANUAL';
      case 'updatedByName':
      case 'createdByName':
        return '';
      case 'updatedByContext':
      case 'createdByContext':
        return null;
      case 'updatedByWorkspaceMemberId':
        return null;
      case 'position':
        return 0;
      case 'fileCategory':
        return 'OTHER';
      default:
        return undefined;
    }
  }

  private async listTables(
    dataSource: DataSource,
    schemaName: string,
  ): Promise<string[]> {
    const rows = await dataSource.query(
      `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = $1
        ORDER BY tablename
      `,
      [schemaName],
    );

    return rows.map((row: { tablename: string }) => row.tablename);
  }

  private async listColumns(
    dataSource: DataSource,
    schemaName: string,
    tableName: string,
  ): Promise<string[]> {
    const rows = await dataSource.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `,
      [schemaName, tableName],
    );

    return rows.map((row: { column_name: string }) => row.column_name);
  }

  private async listEnumColumns(
    dataSource: DataSource,
    schemaName: string,
    tableName: string,
  ): Promise<Map<string, Set<string>>> {
    const rows = await dataSource.query(
      `
        SELECT
          column_name,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND data_type = 'USER-DEFINED'
      `,
      [schemaName, tableName],
    );

    const enumColumns = new Map<string, Set<string>>();

    for (const row of rows as Array<{ column_name: string; udt_name: string }>) {
      const labels = await dataSource.query(
        `
          SELECT e.enumlabel
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = $1 AND t.typname = $2
        `,
        [schemaName, row.udt_name],
      );

      enumColumns.set(
        row.column_name,
        new Set(labels.map((label: { enumlabel: string }) => label.enumlabel)),
      );
    }

    return enumColumns;
  }

  private normalizeEnumValue({
    value,
    allowedLabels,
  }: {
    value: unknown;
    allowedLabels: Set<string>;
  }): unknown {
    if (!isDefined(value)) {
      return value;
    }

    const stringValue = String(value);

    if (allowedLabels.has(stringValue)) {
      return stringValue;
    }

    const upperValue = stringValue.toUpperCase();

    if (allowedLabels.has(upperValue)) {
      return upperValue;
    }

    // TextDocument → TEXT_DOCUMENT, gpt4omini → GPT4OMINI
    const screamingSnakeValue = stringValue
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .toUpperCase();

    if (allowedLabels.has(screamingSnakeValue)) {
      return screamingSnakeValue;
    }

    const matchedLabel = [...allowedLabels].find(
      (label) =>
        label.toUpperCase() === upperValue ||
        label.toUpperCase() === screamingSnakeValue ||
        label.replace(/_/g, '').toUpperCase() === upperValue.replace(/_/g, ''),
    );

    return matchedLabel ?? null;
  }

  private async listJsonColumns(
    dataSource: DataSource,
    schemaName: string,
    tableName: string,
  ): Promise<Set<string>> {
    const rows = await dataSource.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND data_type IN ('json', 'jsonb')
      `,
      [schemaName, tableName],
    );

    return new Set(
      rows.map((row: { column_name: string }) => row.column_name),
    );
  }

  private normalizeValueForInsert({
    value,
    targetColumn,
    jsonColumns,
    enumColumns,
    memberIdMap,
  }: {
    value: unknown;
    targetColumn: string;
    jsonColumns: Set<string>;
    enumColumns: Map<string, Set<string>>;
    memberIdMap: Map<string, string>;
  }): unknown {
    let normalizedValue = value;

    if (
      WORKSPACE_MEMBER_ID_COLUMNS.includes(
        targetColumn as (typeof WORKSPACE_MEMBER_ID_COLUMNS)[number],
      ) &&
      isDefined(normalizedValue)
    ) {
      normalizedValue =
        memberIdMap.get(normalizedValue as string) ?? normalizedValue;
    }

    // Current unique indexes treat '' like a value; legacy allowed many blank emails
    if (
      (targetColumn === 'emailsPrimaryEmail' ||
        targetColumn.endsWith('PrimaryEmail') ||
        targetColumn.endsWith('PrimaryPhoneNumber')) &&
      normalizedValue === ''
    ) {
      normalizedValue = null;
    }

    const enumLabels = enumColumns.get(targetColumn);

    if (isDefined(enumLabels)) {
      normalizedValue = this.normalizeEnumValue({
        value: normalizedValue,
        allowedLabels: enumLabels,
      });
    }

    if (!jsonColumns.has(targetColumn)) {
      return normalizedValue;
    }

    if (normalizedValue === '' || normalizedValue === undefined) {
      return null;
    }

    if (
      typeof normalizedValue === 'object' &&
      normalizedValue !== null
    ) {
      return JSON.stringify(normalizedValue);
    }

    if (typeof normalizedValue === 'string') {
      try {
        JSON.parse(normalizedValue);

        return normalizedValue;
      } catch {
        return null;
      }
    }

    return normalizedValue;
  }

  private async listGeneratedColumns(
    dataSource: DataSource,
    schemaName: string,
    tableName: string,
  ): Promise<Set<string>> {
    const rows = await dataSource.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND is_generated = 'ALWAYS'
      `,
      [schemaName, tableName],
    );

    return new Set(
      rows.map((row: { column_name: string }) => row.column_name),
    );
  }
}
