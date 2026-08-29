import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const regenerateOutreachWorkspaceProfile = async (input: {
  accessToken: string | undefined;
  userEmail?: string | null;
  workspaceDisplayName?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
}): Promise<void> => {
  if (!input.accessToken) {
    throw new Error('You need to be signed in to regenerate the workspace profile.');
  }

  const baseUrl = REACT_APP_SERVER_BASE_URL ?? '';

  if (!baseUrl) {
    throw new Error('Server URL is not configured.');
  }

  const response = await fetch(
    `${baseUrl}/outreach-command/workspace-profile/regenerate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.accessToken}`,
      },
      body: JSON.stringify({
        userEmail: input.userEmail ?? undefined,
        workspaceDisplayName: input.workspaceDisplayName ?? undefined,
        userFirstName: input.userFirstName ?? undefined,
        userLastName: input.userLastName ?? undefined,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    let message = 'Failed to regenerate workspace profile.';

    try {
      const payload = JSON.parse(text) as { message?: string };
      if (typeof payload.message === 'string' && payload.message.trim()) {
        message = payload.message;
      }
    } catch {
      if (text.trim()) {
        message = text;
      }
    }

    throw new Error(message);
  }
};
