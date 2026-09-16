import {
  hasAnyGrantedAgentPermission,
  hasGrantedObjectPermission,
} from '../workflowAiAgentPermissions.utils';

describe('hasGrantedObjectPermission', () => {
  it('should return false when every CRUD flag is false', () => {
    expect(
      hasGrantedObjectPermission({
        canReadObjectRecords: false,
        canUpdateObjectRecords: false,
        canSoftDeleteObjectRecords: false,
        canDestroyObjectRecords: false,
      }),
    ).toBe(false);
  });

  it('should return true when any CRUD flag is true', () => {
    expect(
      hasGrantedObjectPermission({
        canReadObjectRecords: false,
        canUpdateObjectRecords: true,
        canSoftDeleteObjectRecords: false,
        canDestroyObjectRecords: false,
      }),
    ).toBe(true);
  });
});

describe('hasAnyGrantedAgentPermission', () => {
  it('should ignore all-false object permission rows', () => {
    expect(
      hasAnyGrantedAgentPermission({
        objectPermissions: [
          {
            canReadObjectRecords: false,
            canUpdateObjectRecords: false,
            canSoftDeleteObjectRecords: false,
            canDestroyObjectRecords: false,
          },
        ],
        permissionFlagKeys: [],
      }),
    ).toBe(false);
  });

  it('should return true when a tool permission flag remains', () => {
    expect(
      hasAnyGrantedAgentPermission({
        objectPermissions: [],
        permissionFlagKeys: ['HTTP_REQUEST_TOOL'],
      }),
    ).toBe(true);
  });
});
