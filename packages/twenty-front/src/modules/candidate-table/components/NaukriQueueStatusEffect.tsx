import { useNaukriQueueStatus } from '@/candidate-table/hooks/useNaukriQueueStatus';

/**
 * DataTable-scoped mount point for the Naukri upload queue status. Renders nothing;
 * it subscribes to extension queue updates and drives the live status snackbar so
 * the progress/stop UI only appears while the candidate table is on screen.
 */
export const NaukriQueueStatusEffect = () => {
  useNaukriQueueStatus();

  return null;
};
