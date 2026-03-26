import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';

/**
 * Creates default workspaceMemberProfile rows for new workspace members.
 * Lives in user-workspace (not workspace-modifications) to avoid importing
 * WorkspaceModificationsModule from UserWorkspaceModule — that caused a Nest
 * circular dependency: UserWorkspace → WorkspaceModifications → Auth → UserWorkspace.
 */
@Injectable()
export class WorkspaceMemberProfileProvisioningService {
  constructor(
    @InjectDataSource('metadata')
    private readonly metadataDataSource: DataSource,
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
  ) {}

  private async checkIfTableExists(
    schema: string,
    tableName: string,
  ): Promise<boolean> {
    if (!schema || !tableName) {
      return false;
    }

    try {
      const result = await this.metadataDataSource.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
        )`,
        [schema, tableName],
      );

      return Boolean(result[0]?.exists);
    } catch {
      return false;
    }
  }

  private async checkIfColumnExists(
    schema: string,
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    if (!schema || !tableName || !columnName) {
      return false;
    }

    try {
      const result = await this.metadataDataSource.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
        )`,
        [schema, tableName, columnName],
      );

      return Boolean(result[0]?.exists);
    } catch {
      return false;
    }
  }

  async resolveWorkspaceMemberProfileTableName(
    schema: string,
  ): Promise<'_workspaceMemberProfile' | 'workspaceMemberProfile' | null> {
    if (await this.checkIfTableExists(schema, '_workspaceMemberProfile')) {
      return '_workspaceMemberProfile';
    }
    if (await this.checkIfTableExists(schema, 'workspaceMemberProfile')) {
      return 'workspaceMemberProfile';
    }

    return null;
  }

  /**
   * Ensures a workspaceMemberProfile row exists for a new workspaceMember (Arx custom object).
   * Safe to call multiple times.
   */
  async ensureWorkspaceMemberProfileForNewMember(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<void> {
    const schema =
      this.workspaceDataSourceService.getSchemaName(workspaceId);
    const profileTable =
      await this.resolveWorkspaceMemberProfileTableName(schema);

    if (!profileTable) {
      return;
    }

    const hasTypeColumn = await this.checkIfColumnExists(
      schema,
      profileTable,
      'typeWorkspaceMember',
    );

    try {
      if (hasTypeColumn) {
        await this.workspaceDataSourceService.executeRawQuery(
          `INSERT INTO ${schema}."${profileTable}"
            ("id", "workspaceMemberId", "createdAt", "updatedAt", "typeWorkspaceMember")
           SELECT gen_random_uuid(), $1, NOW(), NOW(), 'recruiterType'
           WHERE NOT EXISTS (
             SELECT 1 FROM ${schema}."${profileTable}" p
             WHERE p."workspaceMemberId" = $1
           )`,
          [workspaceMemberId],
          workspaceId,
        );

        return;
      }

      await this.workspaceDataSourceService.executeRawQuery(
        `INSERT INTO ${schema}."${profileTable}"
          ("id", "workspaceMemberId", "createdAt", "updatedAt")
         SELECT gen_random_uuid(), $1, NOW(), NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM ${schema}."${profileTable}" p
           WHERE p."workspaceMemberId" = $1
         )`,
        [workspaceMemberId],
        workspaceId,
      );
    } catch (error) {
      console.error(
        `ensureWorkspaceMemberProfileForNewMember failed for member ${workspaceMemberId} workspace ${workspaceId}:`,
        error,
      );
    }
  }

  /**
   * Keeps workspaceMemberProfile in sync with workspaceMember (name, email, phone).
   * Ensures a profile row exists, then updates display fields. Safe to call on CREATED/UPDATED.
   */
  async syncWorkspaceMemberProfileFromWorkspaceMemberData(
    workspaceId: string,
    workspaceMemberId: string,
    member: {
      name?: { firstName?: string; lastName?: string } | null;
      userEmail?: string | null;
      phoneNumber?: string | null;
    },
  ): Promise<void> {
    await this.ensureWorkspaceMemberProfileForNewMember(
      workspaceId,
      workspaceMemberId,
    );

    const schema =
      this.workspaceDataSourceService.getSchemaName(workspaceId);
    const profileTable =
      await this.resolveWorkspaceMemberProfileTableName(schema);

    if (!profileTable) {
      return;
    }

    const firstName = member.name?.firstName ?? '';
    const lastName = member.name?.lastName ?? '';
    const displayName =
      [firstName, lastName].filter(Boolean).join(' ').trim() || 'Untitled';
    const email = member.userEmail ?? '';
    const phone = member.phoneNumber ?? '';

    const hasNameColumn = await this.checkIfColumnExists(
      schema,
      profileTable,
      'name',
    );
    const hasFirstNameColumn = await this.checkIfColumnExists(
      schema,
      profileTable,
      'firstName',
    );
    const hasLastNameColumn = await this.checkIfColumnExists(
      schema,
      profileTable,
      'lastName',
    );
    const hasEmailColumn = await this.checkIfColumnExists(
      schema,
      profileTable,
      'email',
    );
    const hasPhoneColumn = await this.checkIfColumnExists(
      schema,
      profileTable,
      'phoneNumber',
    );

    const setParts: string[] = ['"updatedAt" = NOW()'];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (hasNameColumn) {
      setParts.push(`"name" = $${paramIndex}`);
      params.push(displayName);
      paramIndex += 1;
    }
    if (hasFirstNameColumn) {
      setParts.push(`"firstName" = $${paramIndex}`);
      params.push(firstName);
      paramIndex += 1;
    }
    if (hasLastNameColumn) {
      setParts.push(`"lastName" = $${paramIndex}`);
      params.push(lastName);
      paramIndex += 1;
    }
    if (hasEmailColumn) {
      setParts.push(`"email" = $${paramIndex}`);
      params.push(email);
      paramIndex += 1;
    }
    if (hasPhoneColumn) {
      setParts.push(`"phoneNumber" = $${paramIndex}`);
      params.push(phone);
      paramIndex += 1;
    }

    if (setParts.length === 1) {
      return;
    }

    params.push(workspaceMemberId);

    try {
      await this.workspaceDataSourceService.executeRawQuery(
        `UPDATE ${schema}."${profileTable}"
         SET ${setParts.join(', ')}
         WHERE "workspaceMemberId" = $${paramIndex}`,
        params,
        workspaceId,
      );
    } catch (error) {
      console.error(
        `syncWorkspaceMemberProfileFromWorkspaceMemberData failed for member ${workspaceMemberId} workspace ${workspaceId}:`,
        error,
      );
    }
  }
}
