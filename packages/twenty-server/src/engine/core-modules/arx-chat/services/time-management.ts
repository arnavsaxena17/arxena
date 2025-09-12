import { CronExpression } from '@nestjs/schedule';

const TimeManagementLocal = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_MINUTE,
    crontTabToUpdateCandidatesChatControls: CronExpression.EVERY_MINUTE,
    crontTabToFetchLinkedinSockMessages: CronExpression.EVERY_MINUTE,
    crontTabToExecuteWorkspaceMemberCleanup: CronExpression.EVERY_DAY_AT_MIDNIGHT,
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 0.1,
    timeDifferentialinMinutesForCheckingCandidateIdsForLastHowManyHoursOfMessagesToFetchForToMakingUpdatesOnChatsForNextChatControls: 60,
    timeDifferentialInMinutesBeforeStartingNextStageMessaging: 1,
  },
  workspaceSpreading: {
    // Number of workspaces to process per cron run
    workspacesPerRun: 3,
    // Maximum number of concurrent workspaces being processed
    maxConcurrentWorkspaces: 2,
    // Delay between batches in milliseconds
    batchDelayMs: 1000,
  },
  queueSettings: {
    // Queue concurrency for candidate engagement processing
    candidateEngagementConcurrency: 2,
    // Delay between queue jobs in milliseconds
    queueJobDelayMs: 500,
    // Maximum retries for failed jobs
    maxRetries: 3,
  },
};

const TimeManagementProd = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: '*/2 * * * *',
    crontTabToUpdateCandidatesChatControls: CronExpression.EVERY_30_MINUTES,
    crontTabToFetchLinkedinSockMessages: CronExpression.EVERY_10_MINUTES,
    crontTabToExecuteWorkspaceMemberCleanup: CronExpression.EVERY_DAY_AT_MIDNIGHT,
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 3,
    timeDifferentialinMinutesForCheckingCandidateIdsForLastHowManyHoursOfMessagesToFetchForToMakingUpdatesOnChatsForNextChatControls: 120,
    timeDifferentialInMinutesBeforeStartingNextStageMessaging: 180, // 6 hours for prod
  },
  workspaceSpreading: {
    // Process fewer workspaces per run in production to reduce load
    workspacesPerRun: 2,
    // Keep max concurrent workspaces low in production
    maxConcurrentWorkspaces: 1,
    // Longer delay between batches in production
    batchDelayMs: 2000,
  },
  queueSettings: {
    // Lower concurrency in production to prevent database overload
    candidateEngagementConcurrency: 1,
    // Longer delay between queue jobs in production
    queueJobDelayMs: 1000,
    // More retries in production for reliability
    maxRetries: 5,
  },
};

export const TimeManagement =
  process.env.ENV_NODE === 'production'
    ? TimeManagementProd
    : TimeManagementLocal;

console.log('ENV_NODE:::', process.env.ENV_NODE);
