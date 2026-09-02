export const isRawJsonDatePathKey = (path: string): boolean =>
  path.endsWith('At') || path.endsWith('On');
