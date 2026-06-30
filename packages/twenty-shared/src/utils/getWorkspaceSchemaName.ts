const uuidToBase36 = (uuid: string): string => {
  let devId = false;
  let normalizedUuid = uuid;

  if (normalizedUuid.startsWith('twenty-')) {
    devId = true;
    normalizedUuid = normalizedUuid.replace('twenty-', '');
  }

  const hexString = normalizedUuid.replace(/-/g, '');
  const base10Number = BigInt(`0x${hexString}`);
  const base36String = base10Number.toString(36);

  return `${devId ? 'twenty_' : ''}${base36String}`;
};

export const getWorkspaceSchemaName = (workspaceId: string): string => {
  return `workspace_${uuidToBase36(workspaceId)}`;
};
