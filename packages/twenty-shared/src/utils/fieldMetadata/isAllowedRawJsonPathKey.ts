const RAW_JSON_PATH_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export const isAllowedRawJsonPathKey = (path: string): boolean =>
  RAW_JSON_PATH_KEY_PATTERN.test(path);
