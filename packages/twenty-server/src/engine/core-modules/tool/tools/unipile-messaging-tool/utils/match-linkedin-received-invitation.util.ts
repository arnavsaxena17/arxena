export type LinkedinReceivedInvitation = {
  id: string;
  inviter?: {
    inviter_name?: string;
    inviter_id?: string;
    inviter_public_identifier?: string;
    inviter_description?: string | null;
  };
  specifics?: {
    provider?: string;
    shared_secret?: string;
  };
};

export const findMatchingLinkedinReceivedInvitation = (
  items: LinkedinReceivedInvitation[],
  identifiers: string[],
): LinkedinReceivedInvitation | undefined => {
  const normalizedIdentifiers = [
    ...new Set(
      identifiers
        .map((identifier) => identifier.trim().toLowerCase())
        .filter((identifier) => identifier.length > 0),
    ),
  ];

  if (normalizedIdentifiers.length === 0) {
    return undefined;
  }

  const identifierSet = new Set(normalizedIdentifiers);

  return items.find((item) => {
    const inviterId = item.inviter?.inviter_id?.trim().toLowerCase() ?? '';
    const inviterPublicIdentifier =
      item.inviter?.inviter_public_identifier?.trim().toLowerCase() ?? '';

    return (
      (inviterId.length > 0 && identifierSet.has(inviterId)) ||
      (inviterPublicIdentifier.length > 0 &&
        identifierSet.has(inviterPublicIdentifier))
    );
  });
};
