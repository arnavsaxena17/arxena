export const isRawJsonNumericPathKey = (path: string): boolean =>
  path === 'v' ||
  path.startsWith('days') ||
  path.startsWith('people') ||
  path.startsWith('max') ||
  path.endsWith('Score');
