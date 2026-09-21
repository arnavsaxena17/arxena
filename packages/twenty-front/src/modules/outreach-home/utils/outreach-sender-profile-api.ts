import { REACT_APP_SERVER_BASE_URL } from '~/config';

type OutreachSenderProfileApiErrorBody = {
  message?: string;
};

const readErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  const text = await response.text();

  try {
    const payload = JSON.parse(text) as OutreachSenderProfileApiErrorBody;
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    if (text.trim()) {
      return text;
    }
  }

  return fallback;
};

const requireAccessToken = (accessToken: string | undefined): string => {
  if (!accessToken) {
    throw new Error('You need to be signed in to manage the sender profile.');
  }

  return accessToken;
};

const requireBaseUrl = (): string => {
  const baseUrl = REACT_APP_SERVER_BASE_URL ?? '';

  if (!baseUrl) {
    throw new Error('Server URL is not configured.');
  }

  return baseUrl;
};

export type OutreachSenderProfileDraftResponse = {
  draft: Record<string, unknown>;
  linkedinProfileText: string;
  existingSenderProfile: Record<string, unknown> | null;
};

const DRAFT_POLL_INTERVAL_MS = 1_500;
const DRAFT_POLL_MAX_WAIT_MS = 3 * 60 * 1_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const pollOutreachSenderProfileDraft = async (input: {
  accessToken: string;
  baseUrl: string;
  draftJobId: string;
}): Promise<OutreachSenderProfileDraftResponse> => {
  const deadline = Date.now() + DRAFT_POLL_MAX_WAIT_MS;

  while (Date.now() < deadline) {
    const response = await fetch(
      `${input.baseUrl}/outreach-command/sender-profile/generate/${input.draftJobId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(
          response,
          'Failed to load sender profile draft status.',
        ),
      );
    }

    const payload = (await response.json()) as {
      status?: string;
      draft?: Record<string, unknown>;
      linkedinProfileText?: string;
      existingSenderProfile?: Record<string, unknown> | null;
      error?: string;
    };

    if (payload.status === 'ready') {
      if (!payload.draft || typeof payload.draft !== 'object') {
        throw new Error('Sender profile draft completed without a draft.');
      }

      return {
        draft: payload.draft,
        linkedinProfileText: payload.linkedinProfileText ?? '',
        existingSenderProfile: payload.existingSenderProfile ?? null,
      };
    }

    if (payload.status === 'failed') {
      throw new Error(
        typeof payload.error === 'string' && payload.error.trim()
          ? payload.error
          : 'Failed to generate sender profile.',
      );
    }

    await sleep(DRAFT_POLL_INTERVAL_MS);
  }

  throw new Error(
    'Sender profile generate timed out. Please try again in a moment.',
  );
};

export const fetchOutreachSenderProfilePrompt = async (input: {
  accessToken: string | undefined;
  senderNotes?: string;
  collateralText?: string;
}): Promise<{
  existingSenderProfile: Record<string, unknown> | null;
  linkedinUrl: string;
  linkedinUnipileAccountId: string | null;
  linkedinProfileText: string;
}> => {
  const accessToken = requireAccessToken(input.accessToken);
  const baseUrl = requireBaseUrl();

  const response = await fetch(
    `${baseUrl}/outreach-command/sender-profile/prompt`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        senderNotes: input.senderNotes,
        collateralText: input.collateralText,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to load sender profile.'),
    );
  }

  const payload = (await response.json()) as {
    existingSenderProfile?: Record<string, unknown> | null;
    linkedinUrl?: string;
    linkedinUnipileAccountId?: string | null;
    linkedinProfileText?: string;
  };

  return {
    existingSenderProfile: payload.existingSenderProfile ?? null,
    linkedinUrl: payload.linkedinUrl ?? '',
    linkedinUnipileAccountId: payload.linkedinUnipileAccountId ?? null,
    linkedinProfileText: payload.linkedinProfileText ?? '',
  };
};

export const updateOutreachSenderLinkedinUrl = async (input: {
  accessToken: string | undefined;
  linkedinUrl: string;
}): Promise<{ linkedinUrl: string }> => {
  const accessToken = requireAccessToken(input.accessToken);
  const baseUrl = requireBaseUrl();

  const response = await fetch(
    `${baseUrl}/outreach-command/sender-profile/linkedin-url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        linkedinUrl: input.linkedinUrl,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to save LinkedIn URL.'),
    );
  }

  return (await response.json()) as { linkedinUrl: string };
};

export const fetchOutreachSenderLinkedinProfile = async (input: {
  accessToken: string | undefined;
  linkedinUrl: string;
}): Promise<{
  linkedinUrl: string;
  linkedinProfileText: string;
  linkedinProfile: Record<string, unknown>;
}> => {
  const accessToken = requireAccessToken(input.accessToken);
  const baseUrl = requireBaseUrl();

  const response = await fetch(
    `${baseUrl}/outreach-command/sender-profile/fetch-linkedin`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        linkedinUrl: input.linkedinUrl,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to fetch LinkedIn profile.'),
    );
  }

  return (await response.json()) as {
    linkedinUrl: string;
    linkedinProfileText: string;
    linkedinProfile: Record<string, unknown>;
  };
};

export const generateOutreachSenderProfile = async (input: {
  accessToken: string | undefined;
  senderNotes?: string;
  collateralText?: string;
  linkedinProfileText?: string;
}): Promise<OutreachSenderProfileDraftResponse> => {
  const accessToken = requireAccessToken(input.accessToken);
  const baseUrl = requireBaseUrl();

  const response = await fetch(
    `${baseUrl}/outreach-command/sender-profile/generate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        senderNotes: input.senderNotes,
        collateralText: input.collateralText,
        linkedinProfileText: input.linkedinProfileText,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to generate sender profile.'),
    );
  }

  const payload = (await response.json()) as { draftJobId?: string };

  if (!payload.draftJobId?.trim()) {
    throw new Error('Failed to start sender profile generate.');
  }

  return pollOutreachSenderProfileDraft({
    accessToken,
    baseUrl,
    draftJobId: payload.draftJobId,
  });
};

export const saveOutreachSenderProfile = async (input: {
  accessToken: string | undefined;
  senderProfile: Record<string, unknown>;
  senderNotes?: string;
  collateralText?: string;
  linkedinProfileText?: string;
}): Promise<{ outreachSenderProfile: Record<string, unknown> }> => {
  const accessToken = requireAccessToken(input.accessToken);
  const baseUrl = requireBaseUrl();

  const response = await fetch(`${baseUrl}/outreach-command/sender-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      senderProfile: input.senderProfile,
      senderNotes: input.senderNotes,
      collateralText: input.collateralText,
      linkedinProfileText: input.linkedinProfileText,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to save sender profile.'),
    );
  }

  return (await response.json()) as {
    outreachSenderProfile: Record<string, unknown>;
  };
};

export const extractOutreachSenderCollateral = async (input: {
  accessToken: string | undefined;
  fileName: string;
  fileBase64: string;
}): Promise<{ collateralText: string }> => {
  const accessToken = requireAccessToken(input.accessToken);
  const baseUrl = requireBaseUrl();

  const response = await fetch(
    `${baseUrl}/outreach-command/sender-profile/extract-collateral`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        fileName: input.fileName,
        fileBase64: input.fileBase64,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to extract collateral text.'),
    );
  }

  return (await response.json()) as { collateralText: string };
};

export const appendOutreachSenderCollateralFile = async (input: {
  accessToken: string | undefined;
  fileId: string;
  fileName: string;
  mimeType?: string;
}): Promise<{ outreachSenderProfile: Record<string, unknown> }> => {
  const accessToken = requireAccessToken(input.accessToken);
  const baseUrl = requireBaseUrl();

  const response = await fetch(
    `${baseUrl}/outreach-command/sender-profile/collateral-files`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        fileId: input.fileId,
        fileName: input.fileName,
        mimeType: input.mimeType,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to save collateral file.'),
    );
  }

  return (await response.json()) as {
    outreachSenderProfile: Record<string, unknown>;
  };
};

export const removeOutreachSenderCollateralFile = async (input: {
  accessToken: string | undefined;
  fileId: string;
}): Promise<{ outreachSenderProfile: Record<string, unknown> }> => {
  const accessToken = requireAccessToken(input.accessToken);
  const baseUrl = requireBaseUrl();

  const response = await fetch(
    `${baseUrl}/outreach-command/sender-profile/collateral-files/remove`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        fileId: input.fileId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, 'Failed to remove collateral file.'),
    );
  }

  return (await response.json()) as {
    outreachSenderProfile: Record<string, unknown>;
  };
};

export { summarizeSenderProfileDraft as summarizeOutreachSenderProfile } from '@/outreach-home/utils/outreach-sender-profile-draft.util';
