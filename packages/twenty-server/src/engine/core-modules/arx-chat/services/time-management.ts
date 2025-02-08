import { CronExpression } from '@nestjs/schedule';

const TimeManagementLocal = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_5_SECONDS,
    crontTabToMakeUpdatesForNewChats: CronExpression.EVERY_30_SECONDS,
    crontTabToUpdateRecentCandidatesChatControls: CronExpression.EVERY_10_SECONDS,
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 0.33,
    timeDifferentialinMinutesForCheckingCandidateIdsToMakeUpdatesOnChatsForNextChatControls: 60,
    timeDifferentialinHoursForCheckingCandidateIdsWithStatusOfConversationClosed: 2,
    timeDifferentialinHoursForCheckingCandidateIdsWithVideoInterviewCompleted: 2,
  },
};

const TimeManagementProd = {
  crontabs: {
    crontTabToExecuteCandidateEngagement: CronExpression.EVERY_30_SECONDS,
    crontTabToMakeUpdatesForNewChats: CronExpression.EVERY_5_MINUTES,
    crontTabToUpdateRecentCandidatesChatControls: CronExpression.EVERY_10_SECONDS,
  },
  timeDifferentials: {
    timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage: 4,
    timeDifferentialinMinutesForCheckingCandidateIdsToMakeUpdatesOnChatsForNextChatControls: 30,
    timeDifferentialinHoursForCheckingCandidateIdsWithStatusOfConversationClosed: 3,
    timeDifferentialinHoursForCheckingCandidateIdsWithVideoInterviewCompleted: 6,
  },
};

// export const TimeManagement = process.env.ENV_NODE === 'production' 
//   ? TimeManagementProd 
//   : TimeManagementLocal;
export const TimeManagement = process.env.ENV_NODE === 'production' 
  ? TimeManagementLocal 
  : TimeManagementLocal;