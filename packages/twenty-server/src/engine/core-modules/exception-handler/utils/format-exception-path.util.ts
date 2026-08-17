export const formatExceptionPath = (path: unknown): string => {
  if (Array.isArray(path)) {
    return path
      .map((value) => (typeof value === 'number' ? '$index' : String(value)))
      .join(' > ');
  }

  if (typeof path === 'string') {
    return path;
  }

  return '';
};
