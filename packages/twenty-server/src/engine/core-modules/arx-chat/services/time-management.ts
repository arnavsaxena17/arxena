import { CronExpression } from '@nestjs/schedule';

const TimeManagementLocal = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_5_SECONDS,
    crontTabToMakeUpdatesForNewChats: CronExpression.EVERY_30_SECONDS,
    crontTabToUpdateCandidatesChatControls: CronExpression.EVERY_5_MINUTES,
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 0.33,
    timeDifferentialinMinutesForCheckingCandidateIdsForLastHowManyHoursOfMessagesToFetchForToMakingUpdatesOnChatsForNextChatControls: 60,
    timeDifferentialInMinutesBeforeStartingNextStageMessaging: 1,
  },
};

const TimeManagementProd = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_30_SECONDS,
    crontTabToMakeUpdatesForNewChats: CronExpression.EVERY_5_MINUTES,
    crontTabToUpdateCandidatesChatControls: CronExpression.EVERY_30_MINUTES,
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 3,
    timeDifferentialinMinutesForCheckingCandidateIdsForLastHowManyHoursOfMessagesToFetchForToMakingUpdatesOnChatsForNextChatControls: 60,
    timeDifferentialInMinutesBeforeStartingNextStageMessaging: 360, // 6 hours for prod
  },
};

export const TimeManagement = process.env.ENV_NODE === 'production' 
  ? TimeManagementProd 
  : TimeManagementLocal;
// export const TimeManagement = process.env.ENV_NODE === 'production' 
//   ? TimeManagementLocal 
//   : TimeManagementLocal;