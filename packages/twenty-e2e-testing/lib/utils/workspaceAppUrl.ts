/**
 * `origin` (scheme + host + port) for a full page URL.
 * After onboarding, the app resolves to the workspace tenant subdomain (e.g.
 * `http://<workspace>.app.localhost:3001`); use this instead of the generic
 * `app.localhost` entry URL for authenticated flows and teardown.
 */
export const getWorkspaceAppOriginFromPageUrl = (pageUrl: string): string => {
  return new URL(pageUrl).origin;
};
