/** Strip surrounding double quotes from LLM output so the name is shown plainly. */
export const stripThreadNameQuotes = (name: string): string => {
  const trimmed = name.trim();
  if (
    trimmed.length >= 2 &&
    trimmed.startsWith('"') &&
    trimmed.endsWith('"')
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};
