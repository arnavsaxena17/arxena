import { Injectable, type Type } from '@nestjs/common';

import { type ObjectLiteral } from 'typeorm';

import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace.repository';
import { type RolePermissionConfig } from 'src/engine/twenty-orm/types/role-permission-config';

// Compatibility shim for ARX services that still call TwentyORMGlobalManager.
@Injectable()
export class TwentyORMGlobalManager {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async getRepositoryForWorkspace<T extends ObjectLiteral>(
    workspaceId: string,
    workspaceEntityOrObjectMetadataName: Type<T> | string,
    permissionOptions?: RolePermissionConfig,
  ): Promise<WorkspaceRepository<T>> {
    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      () =>
        this.globalWorkspaceOrmManager.getRepository<T>(
          workspaceId,
          workspaceEntityOrObjectMetadataName,
          permissionOptions,
        ),
      authContext,
    );
  }
}
