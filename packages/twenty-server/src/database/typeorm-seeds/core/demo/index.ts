import { DataSource } from 'typeorm';

import { deleteFeatureFlags } from 'src/database/typeorm-seeds/core/demo/feature-flags';
import {
  deleteUserWorkspaces,
  seedUserWorkspaces,
} from 'src/database/typeorm-seeds/core/demo/user-workspaces';
import {
  deleteUsersByWorkspace,
  seedUsers,
} from 'src/database/typeorm-seeds/core/demo/users';
import {
  deleteWorkspaces,
  seedWorkspaces,
} from 'src/database/typeorm-seeds/core/demo/workspaces';

export const seedCoreSchema = async (
  workspaceDataSource: DataSource,
  workspaceId: string,
) => {
  const schemaName = 'core';

  await seedWorkspaces(workspaceDataSource, schemaName, workspaceId);
  await seedUsers(workspaceDataSource, schemaName);
  await seedUserWorkspaces(workspaceDataSource, schemaName, workspaceId);
};

export const deleteCoreSchema = async (
  workspaceDataSource: DataSource,
  workspaceId: string,
) => {
  const schemaName = 'core';
  console.log('Deleting core schema');

  await deleteUserWorkspaces(workspaceDataSource, schemaName, workspaceId);
  console.log('Deleted user workspaces');
  await deleteUsersByWorkspace(workspaceDataSource, schemaName, workspaceId);
  console.log('Deleted users by workspace');
  await deleteFeatureFlags(workspaceDataSource, schemaName, workspaceId);
  console.log('Deleted feature flags');
  // deleteWorkspaces should be last
  await deleteWorkspaces(workspaceDataSource, schemaName, workspaceId);
  console.log('Deleted workspaces');
};
