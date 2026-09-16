import { isDefined } from 'twenty-shared/utils';

// rolesPermissions expands system objects to full CRUD when unset.
// AI tool catalogs must not inherit that UI default — only blanket role
// grants or an explicit objectPermission row should advertise tools.
export const shouldAdvertiseDatabaseCrudToolsForObject = ({
  objectMetadataId,
  role,
  explicitObjectPermissionObjectMetadataIds,
}: {
  objectMetadataId: string;
  role:
    | {
        canReadAllObjectRecords: boolean;
        canUpdateAllObjectRecords: boolean;
        canSoftDeleteAllObjectRecords: boolean;
        canDestroyAllObjectRecords: boolean;
      }
    | undefined;
  explicitObjectPermissionObjectMetadataIds: Set<string>;
}): boolean => {
  if (
    isDefined(role) &&
    (role.canReadAllObjectRecords ||
      role.canUpdateAllObjectRecords ||
      role.canSoftDeleteAllObjectRecords ||
      role.canDestroyAllObjectRecords)
  ) {
    return true;
  }

  return explicitObjectPermissionObjectMetadataIds.has(objectMetadataId);
};
