// import * as allDataObjects from './data-model-objects';
import {
  CandidateNode,
  ChatControlsObjType,
  chatControlType
} from 'twenty-shared';

import { TimeManagement } from 'src/engine/core-modules/arx-chat/services/time-management';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { VideoInterviewChatProcesses } from './candidate-engagement/start-video-interview-chat-processes';

export interface ChatFlowConfig {
  order: number;
  type: chatControlType;
  filterLogic: (candidate: CandidateNode) => boolean;
  preProcessing?: (
    candidates: CandidateNode[],
    chatControl: ChatControlsObjType,
    apiToken: string,
    workspaceQueryService: WorkspaceQueryService,
  ) => Promise<void>;
  chatFilters: () => Array<Record<string, any>>;
  isEligibleForEngagement: (candidate: CandidateNode) => boolean;
  statusUpdate?: {
    isWithinAllowedTime: () => boolean;
    filter: Record<string, any>;
    orderBy?: Array<Record<string, any>>;
  };
  filter: Record<string, any>;
  orderBy: Array<Record<string, any>>;
  templateConfig: {
    defaultTemplate: string;
    messageSetup: (isFirstMessage: boolean) => {
      whatsappTemplate: string;
      requiresSystemPrompt: boolean;
      userContent: string;
    };
  };
}

export class ChatFlowConfigBuilder {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  baseTemplateConfig = {
    defaultTemplate: 'application03',
    messageSetup: (isFirstMessage: boolean, chatType: string) => ({
      whatsappTemplate: 'application03',
      requiresSystemPrompt: isFirstMessage,
      userContent: chatType,
    }),
  };

  private baseFilters = { stopChat: { eq: false } };

  private getOrderNumber(
    type: chatControlType,
    chatFlowOrder: chatControlType[],
  ): number {
    return chatFlowOrder.indexOf(type) + 1;
  }

  private getStagesByOrder(
    currentOrder: number,
    direction: 'before' | 'after',
    chatFlowOrder: chatControlType[],
  ): string[] {
    const stages = [...chatFlowOrder];
    const currentIndex = currentOrder - 1;

    return direction === 'before'
      ? stages.slice(0, currentIndex)
      : stages.slice(currentIndex + 1);
  }

  baseEngagementChecks = (
    candidate: CandidateNode,
    chatControlType: chatControlType,
    chatFlowOrder: chatControlType[],
  ) => {
    console.log("These are the base engagement checks for candidate::", candidate.name, "for chatControlType::", chatControlType, "for chatFlowOrder::", chatFlowOrder);
    
    if (!candidate) {
      console.log("Candidate:: Unknown is not eligible for engagement because candidate is null");
      return false;
    }
    
    // Add debug logging for candidate properties
    console.log("Candidate properties for", candidate.name, ":", {
      jobs: candidate.jobs,
      isActive: candidate.jobs?.isActive,
      startChat: candidate.startChat,
      startChatCompleted: candidate.startChatCompleted,
      chatCount: candidate.chatCount,
      updatedAt: candidate.updatedAt
    });
    
    const isActive = candidate.jobs?.isActive;
    if (!isActive) {
      console.log("Candidate::", candidate.name, "is not eligible for engagement because jobs?.isActive is false");
      return false;
    }
    
    const order = this.getOrderNumber(chatControlType, chatFlowOrder);
    const previousStages = this.getStagesByOrder(order, 'before', chatFlowOrder);
    const nextStages = this.getStagesByOrder(order, 'after', chatFlowOrder);

    const hasCompletedPreviousStages =
      previousStages.length === 0 ||
      previousStages.every((stage) => candidate[`${stage}Completed`]);
    if (!hasCompletedPreviousStages) {
      console.log("Candidate::", candidate.name, "is not eligible for engagement because hasCompletedPreviousStages is false");
      return false;
    }
    
    const hasStartedNextStages = nextStages.some(
      (stage) => candidate[stage] === true,
    );
    if (hasStartedNextStages) {
      console.log("Candidate::", candidate.name, "is not eligible for engagement because hasStartedNextStages is true");
      return false;
    }
    
    const isCurrentStageStarted = candidate[chatControlType] === true;
    if (!isCurrentStageStarted) {
      console.log("Candidate::", candidate.name, "is not eligible for engagement because isCurrentStageStarted is false");
      return false;
    }
    
    const isCurrentStageCompleted =
      candidate[`${chatControlType}Completed`] === true;
    if (isCurrentStageCompleted) {
      console.log("Candidate::", candidate.name, "is not eligible for engagement because isCurrentStageCompleted is true");
      return false;
    }
    
    // Skip time check if this is the first message after startChat
    const isFirstMessageAfterStartChat = 
      chatControlType === 'startChat' && 
      candidate.chatCount === 1;
    console.log("isFirstMessageAfterStartChat::", isFirstMessageAfterStartChat);
    
    if (!isFirstMessageAfterStartChat) {
      const lastMessageTime = new Date(candidate.updatedAt).getTime();
      const currentTime = new Date().getTime();
      const timeDifferential =
        TimeManagement.timeDifferentials
          .timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage *
        60 *
        1000;
      const timeDifference = currentTime - lastMessageTime;
      const hasEnoughTimePassedSinceLastMessage = timeDifference > timeDifferential;
      
      console.log("Time calculation details for", candidate.name, ":", {
        lastMessageTime: new Date(lastMessageTime).toISOString(),
        currentTime: new Date(currentTime).toISOString(),
        timeDifferentialMinutes: TimeManagement.timeDifferentials.timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage,
        timeDifferentialMs: timeDifferential,
        timeDifferenceMs: timeDifference,
        timeDifferenceMinutes: timeDifference / (60 * 1000),
        hasEnoughTimePassedSinceLastMessage
      });
      
      if (!hasEnoughTimePassedSinceLastMessage) {
        console.log("Candidate::", candidate.name, "is not eligible for engagement because hasEnoughTimePassedSinceLastMessage is false");
        return false;
      }
    }
    
    console.log("Candidate::", candidate.name, "is eligible for engagement - all checks passed");
    return true;
  };

  // getMostRecentMessageFromMessagesList(messagesList: MessageNode[]) {
  //   let mostRecentMessageArr: ChatHistoryItem[] = [];

  //   if (messagesList) {
  //     messagesList.sort(
  //       (a, b) =>
  //         new Date(b?.createdAt).getTime() - new Date(a?.createdAt).getTime(),
  //     );
  //     mostRecentMessageArr = messagesList[0]?.messageObj;
  //   }

  //   return mostRecentMessageArr;
  // }

  createIsEligibleForEngagement = (
    candidate: CandidateNode,
    chatControlType: chatControlType,
    order: number,
    chatFlowOrder,
  ) => {
    console.log("These are the eligibility checks for candidate::", candidate.name, "for chatControlType::", chatControlType, "for order::", order, "for chatFlowOrder::", chatFlowOrder);
    
    // Add debug logging for candidate properties at the start
    console.log("Candidate properties at start for", candidate.name, ":", {
      engagementStatus: candidate.engagementStatus,
      startChat: candidate.startChat,
      startChatCompleted: candidate.startChatCompleted,
      chatCount: candidate.chatCount,
      updatedAt: candidate.updatedAt,
      jobs: candidate.jobs
    });
    
    if (candidate.engagementStatus === false) {
      console.log("Candidate::", candidate.name, "is not eligible for engagement because engagementStatus is false");
      return false;
    }
    console.log("Candidate::", candidate.name, "is eligible for engagement because engagementStatus is true");
    const currentIndex = chatFlowOrder.indexOf(chatControlType);

    if (currentIndex === 0) {
      console.log("This is the currentIndex for candidate::", candidate.name, "is::", currentIndex);
      const currentStageStarted = candidate[chatControlType];
      console.log("This is the currentStageStarted for candidate::", candidate.name, "is::", currentStageStarted);
      const currentStageCompleted = candidate[`${chatControlType}Completed`];
      console.log("This is the currentStageCompleted for candidate::", candidate.name, "is::", currentStageCompleted);
      if (currentStageStarted && !currentStageCompleted) {
        console.log("Candidate::", candidate.name, "is eligible for engagement because currentStageStarted is true and currentStageCompleted is false");
        const isEligibleForEngagement = this.baseEngagementChecks(
          candidate,
          chatControlType,
          chatFlowOrder,
        )
        console.log("isEligibleForEngagement for candidate::", candidate.name, "is::", isEligibleForEngagement);
        return isEligibleForEngagement;
      }
      return false;
    }
    else{
      console.log("This is the currentIndex and it is not 0 for candidate::", candidate.name, "is::", currentIndex);
      console.log("This is the chatFlowOrder for candidate::", candidate.name, "is::", chatFlowOrder);
    }
    if (currentIndex > 0) {
      console.log("This is the currentIndex and it is greater than 0 for candidate::", candidate.name, "is::", currentIndex);
      // Get all previous stages in the flow
      const previousStages = chatFlowOrder.slice(0, currentIndex);
      console.log("This is the previousStages for candidate::", candidate.name, "is::", previousStages);
      // Check if ALL previous stages are completed
      const allPreviousStagesCompleted = previousStages?.every(
        (stage) => candidate[`${stage}Completed`] === true,
      );
      console.log("allPreviousStagesCompleted for candidate::", candidate.name, "is::", allPreviousStagesCompleted);
      const currentStageStarted = candidate[chatControlType];
      console.log("This is the currentStageStarted for candidate::", candidate.name, "is::", currentStageStarted);
      const currentStageCompleted = candidate[`${chatControlType}Completed`];
      console.log("This is the currentStageCompleted for candidate::", candidate.name, "is::", currentStageCompleted);
      if (candidate.updatedAt) {
        console.log("candidate.updatedAt for candidate::", candidate.name, "is::", candidate.updatedAt);
        const istTime = new Date(
          new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
        );
        console.log("istTime for candidate::", candidate.name, "is::", istTime);
        if (istTime.getHours() >= 23 || istTime.getHours() < 7) {
          console.log(
            `Current time ${istTime.toLocaleString()} is between 11 PM and 7 AM IST, not messaging`,
          );
          console.log("Candidate::", candidate.name, "is not eligible for engagement because current time is between 11 PM and 7 AM IST");
          return false;
        }
        console.log("Candidate::", candidate.name, "is eligible for engagement because current time is not between 11 PM and 7 AM IST");
        const waitingPeriodInMinutes =
          TimeManagement.timeDifferentials
            .timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage;
        console.log("waitingPeriodInMinutes for candidate::", candidate.name, "is::", waitingPeriodInMinutes);
        const waitTime = waitingPeriodInMinutes * 60 * 1000; // convert to milliseconds
        console.log("waitTime for candidate::", candidate.name, "is::", waitTime);
        const cutoffTime = new Date(Date.now() - waitTime).toISOString();
        console.log("cutoffTime for candidate::", candidate.name, "is::", cutoffTime);
        
        const candidateUpdatedAtISO = new Date(candidate.updatedAt).toISOString();
        const timeComparison = candidateUpdatedAtISO > cutoffTime;
        const hasMultipleMessages = candidate.whatsappMessages?.edges?.length !== 1;
        
        console.log("Time comparison details for", candidate.name, ":", {
          candidateUpdatedAt: candidate.updatedAt,
          candidateUpdatedAtISO,
          cutoffTime,
          timeComparison,
          hasMultipleMessages,
          whatsappMessagesCount: candidate.whatsappMessages?.edges?.length
        });
        
        if (timeComparison && hasMultipleMessages) {
          console.log(
            `Waiting period not elapsed for candidate ${candidate.name} for ${chatControlType}, and last chat control is ${candidate.lastEngagementChatControl} and waiting period is ${waitingPeriodInMinutes} minutes, last updated at ${candidate.updatedAt} and cutoff time is ${cutoffTime}`,
          );
          console.log("Candidate::", candidate.name, "is not eligible for engagement because waiting period not elapsed");
          return false;
        } else {
          console.log(
            `Waiting period elapsed for candidate ${candidate.name} for ${chatControlType}`,
          );
          console.log("Candidate::", candidate.name, "is eligible for engagement because waiting period elapsed");
        }
      } else {
        console.log(
          `Candidate ${candidate.name} does not have updatedAt field`,
        );
        console.log("Candidate::", candidate.name, "is not eligible for engagement because candidate does not have updatedAt field");
      }
      if (
        allPreviousStagesCompleted &&
        (!currentStageStarted ||
          (currentStageStarted && !currentStageCompleted))
      ) {
        console.log("allPreviousStagesCompleted for candidate::", candidate.name, "is::", allPreviousStagesCompleted);
        console.log("currentStageStarted for candidate::", candidate.name, "is::", currentStageStarted);
        console.log("currentStageCompleted for candidate::", candidate.name, "is::", currentStageCompleted);
        const isEligibleForEngagement = this.baseEngagementChecks(
          candidate,
          chatControlType,
          chatFlowOrder,
        );
        console.log("isEligibleForEngagement for candidate::", candidate.name, "is::", isEligibleForEngagement);
        return isEligibleForEngagement;
      }
    }

    return false;
  };

  private createFilterLogic(
    currentOrder: number,
    chatFlowOrder: chatControlType[],
  ) {
    return (candidate: CandidateNode) => {

      if (currentOrder === 1) {
        return (
          candidate.startChat && candidate.whatsappMessages?.edges.length === 0
        );
      }

      const previousStages = this.getStagesByOrder(
        currentOrder,
        'before',
        chatFlowOrder,
      );
      const previousStage = previousStages[previousStages.length - 1];
      const baseConditions =
        candidate.startChat &&
        candidate.whatsappMessages?.edges.length > 0 &&
        candidate.lastEngagementChatControl === previousStage;
      const hasCompletedPreviousStages = previousStages.every(
        (stage) => candidate[stage as keyof typeof candidate],
      );

      return baseConditions && hasCompletedPreviousStages;
    };
  }

  private createChatFilters(
    config: {
      type: chatControlType;
      filter: Record<string, any>;
    },
    chatFlowOrder: chatControlType[],
  ) {
    const currentIndex = chatFlowOrder.indexOf(config.type);

    if (currentIndex > 0) {
      const previousStage = chatFlowOrder[currentIndex - 1];

      return [
        // First filter: Check for completed previous stage
        {
          stopChat: { eq: false },
          [`${previousStage}Completed`]: { eq: true },
          [config.type]: { eq: true },
          [`${config.type}Completed`]: { eq: false },
        },
        // For candidates who have started but not completed (with null)
        {
          stopChat: { eq: false },
          [`${previousStage}Completed`]: { eq: true },
          [config.type]: { eq: true },
          [`${config.type}Completed`]: { is: 'NULL' },
        },
        // For candidates who haven't started
        {
          stopChat: { eq: false },
          [`${previousStage}Completed`]: { eq: true },
          [config.type]: { eq: false },
        },
      ];
    }

    return [{ stopChat: { eq: false }, [config.type]: { eq: true } }];
  }

  createStatusUpdate = (
    order: number,
    type: chatControlType,
    chatFlowOrder: chatControlType[],
  ): ChatFlowConfig['statusUpdate'] => {
    const baseStatusUpdate = {
      isWithinAllowedTime: () => {
        console.log("isWithinAllowedTime");
        const hours = new Date().getHours();
        console.log("hours", hours);
        console.log("isWithinAllowedTime:: hours >= 8 && hours < 21 hours::", hours," :: ", hours >= 8 && hours < 21);
        return hours >= 8 && hours < 21;
      },
      filter: {} as Record<string, any>,
      orderBy: [] as Array<Record<string, any>>,
    };
    // Get previous stage name
    const currentIndex = chatFlowOrder.indexOf(type);
    const previousStage =
      currentIndex > 0 ? chatFlowOrder[currentIndex - 1] : null;

    if (previousStage) {
      return {
        ...baseStatusUpdate,
        filter: {
          [`${previousStage}Completed`]: { eq: true },
          [type]: { eq: false },
        },
      };
    }
    const futureStages = this.getStagesByOrder(order, 'after', chatFlowOrder);
    const futureStageFilters = Object.fromEntries(
      futureStages.map((stage) => [stage, { eq: false }]),
    );

    if (type === 'startChat') {
      return {
        ...baseStatusUpdate,
        filter: {
          candConversationStatus: {
            in: ['CONVERSATION_CLOSED_TO_BE_CONTACTED'],
          },
          startChat: { eq: true },
          ...futureStageFilters,
        },
        orderBy: [{ position: 'AscNullsFirst' }],
      };
    }
    const previousStages = this.getStagesByOrder(
      order,
      'before',
      chatFlowOrder,
    );
    const previousStageFilters = Object.fromEntries(
      previousStages.map((stage) => [`${stage}Completed`, { eq: true }]),
    );

    return {
      ...baseStatusUpdate,
      filter: {
        ...previousStageFilters,
        ...futureStageFilters,
        [type]: { eq: false },
      },
    };
  };

  private createBaseChatFlowConfig(
    type: chatControlType,
    order: number,
    chatFlowOrder: chatControlType[],
  ): ChatFlowConfig {
    const filter = { ...this.baseFilters, [type]: { eq: true } };

    return {
      order,
      type,
      filterLogic: this.createFilterLogic(order, chatFlowOrder),
      filter,
      chatFilters: () =>
        this.createChatFilters({ type, filter }, chatFlowOrder),
      isEligibleForEngagement: (candidate) =>
        this.createIsEligibleForEngagement(
          candidate,
          type,
          order,
          chatFlowOrder,
        ),
      templateConfig: {
        ...this.baseTemplateConfig,
        messageSetup: (isFirstMessage: boolean) =>
          this.baseTemplateConfig.messageSetup(isFirstMessage, type),
      },
      statusUpdate: this.createStatusUpdate(order, type, chatFlowOrder),
      orderBy: [{ createdAt: 'DESC' }],
    };
  }

  private applySpecificConfig(
    type: chatControlType,
    baseConfig: ChatFlowConfig,
  ): ChatFlowConfig {
    const specificConfigs: Record<
      chatControlType,
      (baseConfig: ChatFlowConfig) => ChatFlowConfig
    > = {
      startChat: (config) => ({ ...config }),
      startVideoInterviewChat: (config) => ({
        ...config,
        preProcessing: async (
          candidates, 
          chatControl,
          apiToken,
        ) => {
          await new VideoInterviewChatProcesses(
            this.workspaceQueryService,
            this.staticGraphQLService,
          ).setupVideoInterviewLinks(
            candidates,
            chatControl,
            apiToken,
          );
        },
      }),
      startMeetingSchedulingChat: (config) => ({ ...config }),
      allStartedAndStoppedChats: (config) => config,
    };

    return specificConfigs[type](baseConfig);
  }

  public getDefaultChatFlowOrder(): chatControlType[] {
    return [
      'startChat',
      // 'startVideoInterviewChat',
      // 'startMeetingSchedulingChat',
    ] as const;
  }

  public buildChatFlowConfig(
    chatFlowOrder?: chatControlType[],
  ): Record<chatControlType, ChatFlowConfig> {
    const order = chatFlowOrder || this.getDefaultChatFlowOrder();

    return Object.fromEntries(
      order.map((type) => {
        const orderNum = this.getOrderNumber(type, order);
        const baseConfig = this.createBaseChatFlowConfig(type, orderNum, order);

        return [type, this.applySpecificConfig(type, baseConfig)];
      }),
    ) as Record<chatControlType, ChatFlowConfig>;
  }
}
