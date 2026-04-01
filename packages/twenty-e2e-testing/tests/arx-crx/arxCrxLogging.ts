import { createE2eSuiteLogger } from '../../lib/e2eLogging';

/** ARX Chrome extension E2E — `[arx-crx-e2e]` log lines (grep-friendly). */
export const { logStage, logStageFailure, StageTracker } =
  createE2eSuiteLogger('arx-crx-e2e');
