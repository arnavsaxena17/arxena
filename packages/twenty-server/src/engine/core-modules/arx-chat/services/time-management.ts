import { CronExpression } from '@nestjs/schedule';

const TimeManagementLocal = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_5_SECONDS,
    crontTabToUpdateCandidatesChatControls: CronExpression.EVERY_MINUTE,
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 0.1,
    timeDifferentialinMinutesForCheckingCandidateIdsForLastHowManyHoursOfMessagesToFetchForToMakingUpdatesOnChatsForNextChatControls: 60,
    timeDifferentialInMinutesBeforeStartingNextStageMessaging: 1,
  },
};

const TimeManagementProd = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_MINUTE,
    crontTabToUpdateCandidatesChatControls: CronExpression.EVERY_30_MINUTES,
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 3,
    timeDifferentialinMinutesForCheckingCandidateIdsForLastHowManyHoursOfMessagesToFetchForToMakingUpdatesOnChatsForNextChatControls: 120,
    timeDifferentialInMinutesBeforeStartingNextStageMessaging: 180, // 6 hours for prod
  },
};

export const TimeManagement = process.env.ENV_NODE === 'production' 
  ? TimeManagementProd 
  : TimeManagementLocal;


  console.log('ENV_NODE:::', process.env.ENV_NODE);