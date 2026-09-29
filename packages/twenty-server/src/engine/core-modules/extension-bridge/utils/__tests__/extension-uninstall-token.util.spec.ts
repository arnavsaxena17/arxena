import {
  createExtensionUninstallToken,
  readExtensionUninstallToken,
} from 'src/engine/core-modules/extension-bridge/utils/extension-uninstall-token.util';

const APP_SECRET = 'test-app-secret';

describe('extension uninstall token', () => {
  it('round-trips a signed member token', () => {
    const token = createExtensionUninstallToken({
      workspaceId: 'workspace-1',
      workspaceMemberId: 'member-1',
      appSecret: APP_SECRET,
      nowMs: 1_000,
    });

    expect(
      readExtensionUninstallToken({
        token,
        appSecret: APP_SECRET,
        nowMs: 1_000,
      }),
    ).toEqual({
      workspaceId: 'workspace-1',
      workspaceMemberId: 'member-1',
      exp: 1_000 + 30 * 24 * 60 * 60 * 1000,
    });
  });

  it('rejects a token signed with a different secret or past its expiry', () => {
    const token = createExtensionUninstallToken({
      workspaceId: 'workspace-1',
      workspaceMemberId: 'member-1',
      appSecret: APP_SECRET,
      nowMs: 1_000,
    });

    expect(
      readExtensionUninstallToken({
        token,
        appSecret: 'other-secret',
        nowMs: 1_000,
      }),
    ).toBeNull();

    expect(
      readExtensionUninstallToken({
        token,
        appSecret: APP_SECRET,
        nowMs: 1_000 + 31 * 24 * 60 * 60 * 1000,
      }),
    ).toBeNull();
  });
});
