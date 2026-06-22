export const resolveIpinfoToken = (): string | undefined => {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }

  const serverToken = process.env.IPINFO_TOKEN?.trim();
  if (serverToken) {
    return serverToken;
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
