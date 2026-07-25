export const toSlug = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, '-');
