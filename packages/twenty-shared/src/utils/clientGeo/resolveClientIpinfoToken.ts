export const resolveClientIpinfoToken = (): string | undefined => {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }

  const reactToken = process.env.REACT_APP_IPINFO_TOKEN?.trim();
  if (reactToken) {
    return reactToken;
  }

  const nextToken = process.env.NEXT_PUBLIC_IPINFO_TOKEN?.trim();
  if (nextToken) {
    return nextToken;
  }

  return undefined;
};
