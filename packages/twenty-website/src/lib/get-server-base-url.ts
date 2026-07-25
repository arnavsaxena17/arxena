/** NestJS base URL for server-side API calls from twenty-website (not the browser). */
export const getServerBaseUrl = (): string => {
  const url =
    process.env.SERVER_BASE_URL ??
    (process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'http://127.0.0.1:3000');

  return url.replace(/\/$/, '');
};
