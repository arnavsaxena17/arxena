import { InjectRepository } from '@nestjs/typeorm';

import assert from 'assert';

import { TypeOrmQueryService } from '@ptc-org/nestjs-query-typeorm';
import { isWorkspaceActiveOrSuspended } from 'twenty-shared';
import { Repository } from 'typeorm';

import { TypeORMService } from 'src/database/typeorm/typeorm.service';
import { DatabaseEventAction } from 'src/engine/api/graphql/graphql-query-runner/enums/database-event-action';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { User } from 'src/engine/core-modules/user/user.entity';
import { userValidator } from 'src/engine/core-modules/user/user.validate';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceService } from 'src/engine/metadata-modules/data-source/data-source.service';
import { ObjectMetadataEntity } from 'src/engine/metadata-modules/object-metadata/object-metadata.entity';
import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';
import { WorkspaceEventEmitter } from 'src/engine/workspace-event-emitter/workspace-event-emitter';
import { WorkspaceMemberWorkspaceEntity } from 'src/modules/workspace-member/standard-objects/workspace-member.workspace-entity';

// eslint-disable-next-line @nx/workspace-inject-workspace-repository
export class UserService extends TypeOrmQueryService<User> {
  constructor(
    @InjectRepository(User, 'core')
    private readonly userRepository: Repository<User>,
    @InjectRepository(ObjectMetadataEntity, 'metadata')
    private readonly objectMetadataRepository: Repository<ObjectMetadataEntity>,
    private readonly dataSourceService: DataSourceService,
    private readonly typeORMService: TypeORMService,
    private readonly workspaceEventEmitter: WorkspaceEventEmitter,
    private readonly workspaceService: WorkspaceService,
    private readonly twentyORMGlobalManager: TwentyORMGlobalManager,
  ) {
    super(userRepository);
  }

  async loadWorkspaceMember(user: User, workspace: Workspace) {
    if (!isWorkspaceActiveOrSuspended(workspace)) {
      return null;
    }

    const workspaceMemberRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace<WorkspaceMemberWorkspaceEntity>(
        workspace.id,
        'workspaceMember',
      );

    return await workspaceMemberRepository.findOne({
      where: {
        userId: user.id,
      },
    });
  }

  async loadWorkspaceMembers(workspace: Workspace) {
    if (!isWorkspaceActiveOrSuspended(workspace)) {
      return [];
    }

    const workspaceMemberRepository =
      await this.twentyORMGlobalManager.getRepositoryForWorkspace<WorkspaceMemberWorkspaceEntity>(
        workspace.id,
        'workspaceMember',
      );

    return workspaceMemberRepository.find();
  }

  private async deleteUserFromWorkspace({
    userId,
    workspaceId,
  }: {
    userId: string;
    workspaceId: string;
  }) {
    console.log('Deleting user from workspace');
    const dataSourceMetadata =
      await this.dataSourceService.getLastDataSourceMetadataFromWorkspaceIdOrFail(
        workspaceId,
      );
    console.log('Got data source metadata');
    const workspaceDataSource =
      await this.typeORMService.connectToDataSource(dataSourceMetadata);
    console.log('Connected to data source');
    console.log('Getting workspace members::', dataSourceMetadata.schema);
    const workspaceMembers = await workspaceDataSource?.query(
      `SELECT * FROM ${dataSourceMetadata.schema}."workspaceMember"`,
    );
    console.log('Got workspace members');
    const workspaceMember = workspaceMembers.filter(
      (member: WorkspaceMemberWorkspaceEntity) => member.userId === userId,
    )?.[0];
    console.log('Got workspace member');
    assert(workspaceMember, 'WorkspaceMember not found');
    console.log('Workspace member found');

    await workspaceDataSource?.query(
      `DELETE FROM ${dataSourceMetadata.schema}."attachment"`,
    );
    console.log('Deleted attachments');

    await workspaceDataSource?.query(
      `DELETE FROM ${dataSourceMetadata.schema}."workspaceMember" WHERE "userId" = '${userId}'`,
    );
    console.log('Deleted workspace member');
    const objectMetadata = await this.objectMetadataRepository.findOneOrFail({
      where: {
        nameSingular: 'workspaceMember',
        workspaceId,
      },
    });
    console.log('Got object metadata');
    if (workspaceMembers.length === 1) {
      console.log('Deleting workspace');
      await this.workspaceService.deleteWorkspace(workspaceId);
      console.log('Workspace deleted');
      return;
    }
    console.log('Emitting database batch event');
    this.workspaceEventEmitter.emitDatabaseBatchEvent({
      objectMetadataNameSingular: 'workspaceMember',
      action: DatabaseEventAction.DELETED,
      events: [
        {
          recordId: workspaceMember.id,
          objectMetadata,
          properties: {
            before: workspaceMember,
          },
        },
      ],
      workspaceId,
    });
    console.log('Emitted database batch event');
  }

  async deleteUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
      relations: ['workspaces'],
    });

    userValidator.assertIsDefinedOrThrow(user);

    await Promise.all(
      user.workspaces.map(this.deleteUserFromWorkspace.bind(this)),
    );

    return user;
  }

  async hasUserAccessToWorkspaceOrThrow(userId: string, workspaceId: string) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        workspaces: {
          workspaceId,
        },
      },
      relations: ['workspaces'],
    });

    userValidator.assertIsDefinedOrThrow(
      user,
      new AuthException(
        'User does not have access to this workspace',
        AuthExceptionCode.FORBIDDEN_EXCEPTION,
      ),
    );
  }

  async getUserByEmail(email: string) {
    const user = await this.userRepository.findOne({
      where: {
        email,
      },
    });

    userValidator.assertIsDefinedOrThrow(user);

    return user;
  }

  async markEmailAsVerified(userId: string) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
      },
    });

    userValidator.assertIsDefinedOrThrow(user);

    user.isEmailVerified = true;

    return await this.userRepository.save(user);
  }
}
