import { resolveNotifyOnPendingRecipients } from 'src/modules/workflow/workflow-executor/workflow-actions/form/utils/resolve-notify-on-pending-recipients.util';

describe('resolveNotifyOnPendingRecipients', () => {
  const profileStepId = 'b8e1d002-4a22-4c22-8c22-000000000002';
  const context = {
    [profileStepId]: {
      first: {
        phoneNumber: '+919892197720',
      },
    },
  };

  it('resolves the workspace member profile phone template', () => {
    const resolved = resolveNotifyOnPendingRecipients(
      {
        WHATSAPP_OFFICIAL: `{{${profileStepId}.first.phoneNumber}}`,
        WHATSAPP_UNIPILE: `{{${profileStepId}.first.phoneNumber}}`,
      },
      context,
    );

    expect(resolved).toEqual({
      WHATSAPP_OFFICIAL: '+919892197720',
      WHATSAPP_UNIPILE: '+919892197720',
      unipileAccountId: undefined,
    });
  });

  it('leaves literal phones unchanged', () => {
    const resolved = resolveNotifyOnPendingRecipients(
      { WHATSAPP_OFFICIAL: '+14155550123' },
      context,
    );

    expect(resolved.WHATSAPP_OFFICIAL).toBe('+14155550123');
  });
});
