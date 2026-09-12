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

export const draftOutreachSenderProfile = async (input: {
  accessToken: string | undefined;
  senderNotes?: string;
  collateralText?: string;
  linkedinProfileText?: string;
}): Promise<OutreachSenderProfileDraftResponse> => {
  const accessToken = requireAccessToken(input.accessToken);
  const baseUrl = requireBaseUrl();

  const response = await fetch(
    `${baseUrl}/outreach-command/sender-profile/draft`,
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
      await readErrorMessage(response, 'Failed to draft sender profile.'),
    );
  }

  return (await response.json()) as OutreachSenderProfileDraftResponse;
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

export const summarizeOutreachSenderProfile = (
  profile: Record<string, unknown> | null | undefined,
): string | null => {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const identity =
    profile.identity && typeof profile.identity === 'object'
      ? (profile.identity as Record<string, unknown>)
      : null;
  const offer =
    profile.offer && typeof profile.offer === 'object'
      ? (profile.offer as Record<string, unknown>)
      : null;

  const fullName =
    typeof identity?.full_name === 'string' ? identity.full_name.trim() : '';
  const productName =
    typeof offer?.product_name === 'string' ? offer.product_name.trim() : '';

  if (fullName && productName) {
    return `${fullName} · ${productName}`;
  }

  return fullName || productName || null;
};
