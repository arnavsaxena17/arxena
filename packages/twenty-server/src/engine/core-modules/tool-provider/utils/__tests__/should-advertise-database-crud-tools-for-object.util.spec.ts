import { shouldAdvertiseDatabaseCrudToolsForObject } from 'src/engine/core-modules/tool-provider/utils/should-advertise-database-crud-tools-for-object.util';

describe('shouldAdvertiseDatabaseCrudToolsForObject', () => {
  const objectMetadataId = 'object-1';

  it('returns true when the role has a blanket object-records grant', () => {
    expect(
      shouldAdvertiseDatabaseCrudToolsForObject({
        objectMetadataId,
        role: {
          canReadAllObjectRecords: true,
          canUpdateAllObjectRecords: false,
          canSoftDeleteAllObjectRecords: false,
          canDestroyAllObjectRecords: false,
        },
        explicitObjectPermissionObjectMetadataIds: new Set(),
      }),
    ).toBe(true);
  });

  it('returns true when the object has an explicit objectPermission row', () => {
    expect(
      shouldAdvertiseDatabaseCrudToolsForObject({
        objectMetadataId,
        role: {
          canReadAllObjectRecords: false,
          canUpdateAllObjectRecords: false,
          canSoftDeleteAllObjectRecords: false,
          canDestroyAllObjectRecords: false,
        },
        explicitObjectPermissionObjectMetadataIds: new Set([objectMetadataId]),
      }),
    ).toBe(true);
  });

  it('returns false for system-default access with no blanket grant and no explicit row', () => {
    expect(
      shouldAdvertiseDatabaseCrudToolsForObject({
        objectMetadataId,
        role: {
          canReadAllObjectRecords: false,
          canUpdateAllObjectRecords: false,
          canSoftDeleteAllObjectRecords: false,
          canDestroyAllObjectRecords: false,
        },
        explicitObjectPermissionObjectMetadataIds: new Set(['other-object']),
      }),
    ).toBe(false);
  });

  it('returns false when the role is missing and there is no explicit row', () => {
    expect(
      shouldAdvertiseDatabaseCrudToolsForObject({
        objectMetadataId,
        role: undefined,
        explicitObjectPermissionObjectMetadataIds: new Set(),
      }),
    ).toBe(false);
  });
});
