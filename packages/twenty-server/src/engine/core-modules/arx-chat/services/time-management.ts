import { CronExpression } from '@nestjs/schedule';

const TimeManagementLocal = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_5_SECONDS,
    crontTabToUpdateCandidatesChatControls: CronExpression.EVERY_MINUTE,
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 0.33,
    timeDifferentialinMinutesForCheckingCandidateIdsForLastHowManyHoursOfMessagesToFetchForToMakingUpdatesOnChatsForNextChatControls: 60,
    timeDifferentialInMinutesBeforeStartingNextStageMessaging: 5,
  },
};

const TimeManagementProd = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_30_SECONDS,
    crontTabToUpdateCandidatesChatControls: CronExpression.EVERY_30_MINUTES,
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 3,
    timeDifferentialinMinutesForCheckingCandidateIdsForLastHowManyHoursOfMessagesToFetchForToMakingUpdatesOnChatsForNextChatControls: 120,
    timeDifferentialInMinutesBeforeStartingNextStageMessaging: 360, // 6 hours for prod
  },
};

export const TimeManagement = process.env.ENV_NODE === 'production' 
  ? TimeManagementProd 
  : TimeManagementLocal;
