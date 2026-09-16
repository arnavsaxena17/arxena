import { filterBySearchQuery } from '~/utils/filterBySearchQuery';

export type FilteredPermissionsResult<T> = {
  filteredPermissions: T[];
  filteredEnabledPermissions: T[];
};

export type ObjectPermissionGrantFlags = {
  canReadObjectRecords?: boolean | null;
  canUpdateObjectRecords?: boolean | null;
  canSoftDeleteObjectRecords?: boolean | null;
  canDestroyObjectRecords?: boolean | null;
};

// All-false rows are left behind after deleting the last CRUD grant; treat
// them as empty so the picker (not a blank "existing" list) is shown.
export const hasGrantedObjectPermission = (
  objectPermission: ObjectPermissionGrantFlags,
): boolean =>
  objectPermission.canReadObjectRecords === true ||
  objectPermission.canUpdateObjectRecords === true ||
  objectPermission.canSoftDeleteObjectRecords === true ||
  objectPermission.canDestroyObjectRecords === true;

export const hasAnyGrantedAgentPermission = ({
  objectPermissions,
  permissionFlagKeys,
}: {
  objectPermissions: ObjectPermissionGrantFlags[];
  permissionFlagKeys: string[];
}): boolean =>
  permissionFlagKeys.length > 0 ||
  objectPermissions.some(hasGrantedObjectPermission);

export const getFilteredPermissions = <
  T extends { key: string; name: string },
>({
  permissions,
  permissionFlagKeys,
  searchQuery,
}: {
  permissions: T[];
  permissionFlagKeys: string[];
  searchQuery: string;
}): FilteredPermissionsResult<T> => {
  const filteredPermissions = filterBySearchQuery<T>({
    items: permissions,
    searchQuery,
    getSearchableValues: (permission) => [permission.name],
  });

  const enabledPermissions = permissions.filter((permission) =>
    permissionFlagKeys.includes(permission.key),
  );

  const filteredEnabledPermissions = filterBySearchQuery<T>({
    items: enabledPermissions,
    searchQuery,
    getSearchableValues: (permission) => [permission.name],
  });

  return {
    filteredPermissions,
    filteredEnabledPermissions,
  };
};
