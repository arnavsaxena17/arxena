export const normalizeBuiltWithDomain = (input: string): string => {
  const trimmed = input.trim().toLowerCase();

  if (!trimmed) {
    throw new Error('Domain is required');
  }

  const withoutProtocol = trimmed.replace(/^https?:\/\//, '');
  const withoutPath = withoutProtocol.split('/')[0] ?? withoutProtocol;
  const withoutWww = withoutPath.replace(/^www\./, '');

  if (!withoutWww.includes('.')) {
    throw new Error(`Invalid domain: ${input}`);
  }

  return withoutWww;
};
