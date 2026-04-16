import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isDefined } from 'twenty-shared';
import { Repository } from 'typeorm';

import { ADMIN_ROLE_LABEL } from 'src/engine/metadata-modules/permissions/constants/admin-role-label.constants';
import { MEMBER_ROLE_LABEL } from 'src/engine/metadata-modules/permissions/constants/member-role-label.constants';
import {
  PermissionsException,
  PermissionsExceptionCode,
  PermissionsExceptionMessage,
} from 'src/engine/metadata-modules/permissions/permissions.exception';
import { CreateRoleInput } from 'src/engine/metadata-modules/role/dtos/create-role.input';
import { UpdateRoleInput } from 'src/engine/metadata-modules/role/dtos/update-role.input';
import { RoleEntity } from 'src/engine/metadata-modules/role/role.entity';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(RoleEntity, 'metadata')
    private readonly roleRepository: Repository<RoleEntity>,
    private readonly userRoleService: UserRoleService,
  ) {}

  public async getWorkspaceRoles(workspaceId: string): Promise<RoleEntity[]> {
    return this.roleRepository.find({
      where: {
        workspaceId,
      },
      relations: ['userWorkspaceRoles'],
    });
  }

  public async createRole({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: CreateRoleInput;
  }): Promise<RoleEntity> {
    const trimmedLabel = input.label.trim();

    if (trimmedLabel.length === 0) {
      throw new PermissionsException(
        'Role label is required',
        PermissionsExceptionCode.PERMISSION_DENIED,
      );
    }

    const existingWithLabel = await this.roleRepository.findOne({
      where: {
        workspaceId,
        label: trimmedLabel,
      },
    });

    if (isDefined(existingWithLabel)) {
      throw new PermissionsException(
        PermissionsExceptionMessage.ROLE_LABEL_ALREADY_EXISTS,
        PermissionsExceptionCode.ROLE_LABEL_ALREADY_EXISTS,
      );
    }

    return this.roleRepository.save({
      label: trimmedLabel,
      description: input.description?.trim() ?? '',
      canUpdateAllSettings: false,
      canReadAllObjectRecords: true,
      canUpdateAllObjectRecords: true,
      canSoftDeleteAllObjectRecords: true,
      canDestroyAllObjectRecords: true,
      isEditable: true,
      workspaceId,
    });
  }

  public async updateRole({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: UpdateRoleInput;
  }): Promise<RoleEntity> {
    const role = await this.roleRepository.findOne({
      where: {
        id: input.id,
        workspaceId,
      },
    });

    if (!isDefined(role)) {
      throw new PermissionsException(
        PermissionsExceptionMessage.ROLE_NOT_FOUND,
        PermissionsExceptionCode.ROLE_NOT_FOUND,
      );
    }

    if (!role.isEditable) {
      throw new PermissionsException(
        PermissionsExceptionMessage.CANNOT_MODIFY_SYSTEM_ROLE,
        PermissionsExceptionCode.CANNOT_MODIFY_SYSTEM_ROLE,
      );
    }

    if (isDefined(input.label)) {
      const trimmed = input.label.trim();
      if (trimmed.length === 0) {
        throw new PermissionsException(
          'Role label cannot be empty',
          PermissionsExceptionCode.PERMISSION_DENIED,
        );
      }

      const duplicate = await this.roleRepository.findOne({
        where: {
          workspaceId,
          label: trimmed,
        },
      });

      if (isDefined(duplicate) && duplicate.id !== role.id) {
        throw new PermissionsException(
          PermissionsExceptionMessage.ROLE_LABEL_ALREADY_EXISTS,
          PermissionsExceptionCode.ROLE_LABEL_ALREADY_EXISTS,
        );
      }

      role.label = trimmed;
    }

    if (isDefined(input.description)) {
      role.description = input.description;
    }

    if (isDefined(input.canUpdateAllSettings)) {
      role.canUpdateAllSettings = input.canUpdateAllSettings;
    }

    if (isDefined(input.canReadAllObjectRecords)) {
      role.canReadAllObjectRecords = input.canReadAllObjectRecords;
    }

    if (isDefined(input.canUpdateAllObjectRecords)) {
      role.canUpdateAllObjectRecords = input.canUpdateAllObjectRecords;
    }

    if (isDefined(input.canSoftDeleteAllObjectRecords)) {
      role.canSoftDeleteAllObjectRecords = input.canSoftDeleteAllObjectRecords;
    }

    if (isDefined(input.canDestroyAllObjectRecords)) {
      role.canDestroyAllObjectRecords = input.canDestroyAllObjectRecords;
    }

    return this.roleRepository.save(role);
  }

  public async deleteRole({
    roleId,
    workspaceId,
  }: {
    roleId: string;
    workspaceId: string;
  }): Promise<RoleEntity> {
    const role = await this.roleRepository.findOne({
      where: {
        id: roleId,
        workspaceId,
      },
    });

    if (!isDefined(role)) {
      throw new PermissionsException(
        PermissionsExceptionMessage.ROLE_NOT_FOUND,
        PermissionsExceptionCode.ROLE_NOT_FOUND,
      );
    }

    if (!role.isEditable) {
      throw new PermissionsException(
        PermissionsExceptionMessage.CANNOT_MODIFY_SYSTEM_ROLE,
        PermissionsExceptionCode.CANNOT_MODIFY_SYSTEM_ROLE,
      );
    }

    const memberRole = await this.roleRepository.findOne({
      where: {
        workspaceId,
        label: MEMBER_ROLE_LABEL,
      },
    });

    if (!isDefined(memberRole)) {
      throw new PermissionsException(
        PermissionsExceptionMessage.MEMBER_ROLE_NOT_FOUND,
        PermissionsExceptionCode.MEMBER_ROLE_NOT_FOUND,
      );
    }

    const userWorkspaceIds =
      await this.userRoleService.getUserWorkspaceIdsAssignedToRole(
        roleId,
        workspaceId,
      );

    for (const userWorkspaceId of userWorkspaceIds) {
      await this.userRoleService.assignRoleToUserWorkspace({
        userWorkspaceId,
        workspaceId,
        roleId: memberRole.id,
      });
    }

    await this.roleRepository.delete({ id: roleId, workspaceId });

    return role;
  }

  public async createAdminRole({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<RoleEntity> {
    return this.roleRepository.save({
      label: ADMIN_ROLE_LABEL,
      description: 'Admin role',
      canUpdateAllSettings: true,
      canReadAllObjectRecords: true,
      canUpdateAllObjectRecords: true,
      canSoftDeleteAllObjectRecords: true,
      canDestroyAllObjectRecords: true,
      isEditable: false,
      workspaceId,
    });
  }

  public async createMemberRole({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<RoleEntity> {
    return this.roleRepository.save({
      label: MEMBER_ROLE_LABEL,
      description: 'Member role',
      canUpdateAllSettings: false,
      canReadAllObjectRecords: true,
      canUpdateAllObjectRecords: true,
      canSoftDeleteAllObjectRecords: true,
      canDestroyAllObjectRecords: true,
      isEditable: false,
      workspaceId,
    });
  }

  // Only used for dev seeding and testing
  public async createGuestRole({
    workspaceId,
  }: {
    workspaceId: string;
  }): Promise<RoleEntity> {
    return this.roleRepository.save({
      label: 'Guest',
      description: 'Guest role',
      canUpdateAllSettings: false,
      canReadAllObjectRecords: true,
      canUpdateAllObjectRecords: false,
      canSoftDeleteAllObjectRecords: false,
      canDestroyAllObjectRecords: false,
      isEditable: false,
      workspaceId,
    });
  }
}
