import { AppPath } from '@/types/AppPath';

const normalizePostAuthLanding = (raw: string | undefined): AppPath => {
  const value = raw?.trim().toLowerCase();
  if (value === 'jobs' || value === 'job') {
    return AppPath.Jobs;
  }
  return AppPath.OrgChart;
};

/**
 * Landing route after sign-in / onboarding when redirecting to the main app.
 * Set `REACT_APP_POST_AUTH_LANDING` to `org-chart` for org-chart first; omit or `jobs` for jobs (default).
 */
export const getPostAuthLandingAppPath = (): AppPath => {
  const fromWindow =
    typeof window !== 'undefined'
      ? window._env_?.REACT_APP_POST_AUTH_LANDING
      : undefined;
  const fromProcess =
    typeof process !== 'undefined'
      ? process.env.REACT_APP_POST_AUTH_LANDING
      : undefined;
  return normalizePostAuthLanding(fromWindow ?? fromProcess);
};
