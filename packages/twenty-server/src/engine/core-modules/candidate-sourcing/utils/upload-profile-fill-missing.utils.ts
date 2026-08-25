export const isUploadFieldEmpty = (value: unknown): boolean => {
  if (value == null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return false;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('primaryEmail' in obj) {
      return isUploadFieldEmpty(obj.primaryEmail);
    }
    if ('primaryPhoneNumber' in obj) {
      return isUploadFieldEmpty(obj.primaryPhoneNumber);
    }
    if ('primaryLinkUrl' in obj) {
      return isUploadFieldEmpty(obj.primaryLinkUrl);
    }
    if ('firstName' in obj || 'lastName' in obj) {
      return (
        isUploadFieldEmpty(obj.firstName) && isUploadFieldEmpty(obj.lastName)
      );
    }
    return Object.values(obj).every((entry) => isUploadFieldEmpty(entry));
  }
  return false;
};

const hasOwn = (record: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const assignIfMissing = (
  patch: Record<string, unknown>,
  existing: Record<string, unknown>,
  key: string,
  incomingValue: unknown,
): void => {
  if (!hasOwn(existing, key)) {
    return;
  }
  if (isUploadFieldEmpty(existing[key]) && !isUploadFieldEmpty(incomingValue)) {
    patch[key] = incomingValue;
  }
};

const mergeNameIfMissing = (
  existing: unknown,
  incoming: unknown,
): { firstName: string; lastName: string } | undefined => {
  const existingName =
    existing && typeof existing === 'object'
      ? (existing as { firstName?: string; lastName?: string })
      : undefined;
  const incomingName =
    incoming && typeof incoming === 'object'
      ? (incoming as { firstName?: string; lastName?: string })
      : undefined;
  const existingFirst = existingName?.firstName?.trim() ?? '';
  const existingLast = existingName?.lastName?.trim() ?? '';
  const incomingFirst = incomingName?.firstName?.trim() ?? '';
  const incomingLast = incomingName?.lastName?.trim() ?? '';
  const filledFirst = !existingFirst && incomingFirst !== '';
  const filledLast = !existingLast && incomingLast !== '';
  if (!filledFirst && !filledLast) {
    return undefined;
  }
  return {
    firstName: existingFirst || incomingFirst,
    lastName: existingLast || incomingLast,
  };
};

export const buildMissingPersonPatch = (
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> => {
  if (!existing) {
    return {};
  }
  const patch: Record<string, unknown> = {};

  if (hasOwn(existing, 'name')) {
    const mergedName = mergeNameIfMissing(existing.name, incoming.name);
    if (mergedName) {
      patch.name = mergedName;
    }
  }

  assignIfMissing(patch, existing, 'emails', incoming.emails);
  assignIfMissing(patch, existing, 'phones', incoming.phones);
  assignIfMissing(patch, existing, 'linkedinLink', incoming.linkedinLink);
  assignIfMissing(patch, existing, 'jobTitle', incoming.jobTitle);
  assignIfMissing(patch, existing, 'avatarUrl', incoming.avatarUrl);
  assignIfMissing(patch, existing, 'displayPicture', incoming.displayPicture);
  assignIfMissing(patch, existing, 'companyId', incoming.companyId);

  return patch;
};

export const buildMissingCandidatePatch = (
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> => {
  if (!existing) {
    return {};
  }
  const patch: Record<string, unknown> = {};

  assignIfMissing(patch, existing, 'name', incoming.name);
  assignIfMissing(patch, existing, 'email', incoming.email);
  assignIfMissing(patch, existing, 'phoneNumber', incoming.phoneNumber);
  assignIfMissing(patch, existing, 'linkedinUrl', incoming.linkedinUrl);
  assignIfMissing(
    patch,
    existing,
    'linkedinProfileId',
    incoming.linkedinProfileId,
  );
  assignIfMissing(patch, existing, 'hiringNaukriUrl', incoming.hiringNaukriUrl);
  assignIfMissing(patch, existing, 'resdexNaukriUrl', incoming.resdexNaukriUrl);
  assignIfMissing(patch, existing, 'jobTitle', incoming.jobTitle);
  assignIfMissing(patch, existing, 'jobCompanyName', incoming.jobCompanyName);
  assignIfMissing(patch, existing, 'displayPicture', incoming.displayPicture);
  assignIfMissing(patch, existing, 'avatarUrl', incoming.avatarUrl);
  assignIfMissing(patch, existing, 'peopleId', incoming.peopleId);

  return patch;
};
