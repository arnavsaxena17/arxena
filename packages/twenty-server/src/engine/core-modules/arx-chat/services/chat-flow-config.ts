// import * as allDataObjects from './data-model-objects';
import {
  CandidateNode,
  ChatControlsObjType,
  Jobs,
  PersonNode,
  chatControlType,
} from 'twenty-shared';

import { TimeManagement } from 'src/engine/core-modules/arx-chat/services/time-management';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import { VideoInterviewChatProcesses } from './candidate-engagement/chat-control-processes/start-video-interview-chat-processes';

export interface ChatFlowConfig {
  order: number;
  type: chatControlType;
  filterLogic: (candidate: CandidateNode) => boolean;
  preProcessing?: (
    candidates: PersonNode[],
    candidateJob: Jobs,
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
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

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
    if (candidate.engagementStatus === false) {
      console.log(
        `Candidate ${candidate.name} is not eligible for engagement due to engagementStatus being false. Current time: ${new Date().toISOString()}, Candidate Last updated: ${candidate.updatedAt}`,
      );

      return false;
    }

    const currentIndex = chatFlowOrder.indexOf(chatControlType);

    if (currentIndex > 0) {
      const previousStage = chatFlowOrder[currentIndex - 1];
      const previousStageCompleted = candidate[`${previousStage}Completed`];
      const currentStageStarted = candidate[chatControlType];
      const currentStageCompleted = candidate[`${chatControlType}Completed`];

      if (
        previousStageCompleted &&
        currentStageStarted &&
        !currentStageCompleted
      ) {
        return true;
      }
    }

    if (candidate.whatsappMessages?.edges?.length > 0) {
      const latestMessage = candidate.whatsappMessages.edges[0].node;
      const waitTime =
        TimeManagement.timeDifferentials
          .timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage;
      const cutoffTime = new Date(Date.now() - waitTime * 60 * 1000);

      if (new Date(latestMessage.createdAt) >= cutoffTime) {
        console.log(
          `Candidate ${candidate.name} messaged too recently for ${chatControlType}`,
        );

        return false;
      }
    }

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
    if (candidate.engagementStatus === false) {
      console.log("candidate", candidate);
      console.log(
        `Candidate ${candidate.name} is not eligible for engagement in ${chatControlType} due to engagementStatus being false. Current time: ${new Date().toISOString()}, Candidate Last updated: ${candidate.updatedAt}`,
      );
      return false;
    }
    const currentIndex = chatFlowOrder.indexOf(chatControlType);

    if (currentIndex === 0) {
      const currentStageStarted = candidate[chatControlType];
      const currentStageCompleted = candidate[`${chatControlType}Completed`];

      if (currentStageStarted && !currentStageCompleted) {
        return this.baseEngagementChecks(
          candidate,
          chatControlType,
          chatFlowOrder,
        );
      }
      return false;
    }
    if (currentIndex > 0) {
      // Get all previous stages in the flow
      const previousStages = chatFlowOrder.slice(0, currentIndex);
      // Check if ALL previous stages are completed
      const allPreviousStagesCompleted = previousStages.every(
        (stage) => candidate[`${stage}Completed`] === true,
      );
      console.log("allPreviousStagesCompleted", allPreviousStagesCompleted);
      const currentStageStarted = candidate[chatControlType];
      const currentStageCompleted = candidate[`${chatControlType}Completed`];

      // Check the waiting period since the last update
      if (candidate.updatedAt) {
        // Check if current time is after 11 PM IST
        const istTime = new Date(
          new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
        );

        if (istTime.getHours() >= 23 || istTime.getHours() < 7) {
          console.log(
            `Current time ${istTime.toLocaleString()} is between 11 PM and 7 AM IST, not messaging`,
          );

          return false;
        }
        const waitingPeriodInMinutes =
          TimeManagement.timeDifferentials
            .timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage;
        const waitTime = waitingPeriodInMinutes * 60 * 1000; // convert to milliseconds
        const cutoffTime = new Date(Date.now() - waitTime).toISOString();

        if (new Date(candidate.updatedAt).toISOString() > cutoffTime && candidate.whatsappMessages?.edges?.length === 1) {
          console.log(
            `Waiting period not elapsed for candidate ${candidate.name} for ${chatControlType}, and last chat control is ${candidate.lastEngagementChatControl} and waiting period is ${waitingPeriodInMinutes} minutes, last updated at ${candidate.updatedAt} and cutoff time is ${cutoffTime}`,
          );

          return false;
        } else {
          console.log(
            `Waiting period elapsed for candidate ${candidate.name} for ${chatControlType}`,
          );
        }
      } else {
        console.log(
          `Candidate ${candidate.name} does not have updatedAt field`,
        );
      }

      // Allow engagement if all previous stages are completed and current stage hasn't started
      if (
        allPreviousStagesCompleted &&
        (!currentStageStarted ||
          (currentStageStarted && !currentStageCompleted))
      ) {
        console.log("allPreviousStagesCompleted", allPreviousStagesCompleted);
        console.log("currentStageStarted", currentStageStarted);
        console.log("currentStageCompleted", currentStageCompleted);
        return this.baseEngagementChecks(
          candidate,
          chatControlType,
          chatFlowOrder,
        );
      }
    }

    return false;
  };

  private createFilterLogic(
    currentOrder: number,
    chatFlowOrder: chatControlType[],
  ) {
    return (candidate: CandidateNode) => {
      console.log("Creating filter logic for candidate", candidate.name);
      // console.log('candidate name', candidate);
      console.log(
        'candidate whtasapp messages lenght',
        candidate.whatsappMessages.edges.length,
      );
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
        const hours = new Date().getHours();

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
          candidateJob,
          chatControl,
          apiToken,
        ) => {
          await new VideoInterviewChatProcesses(
            this.workspaceQueryService,
          ).setupVideoInterviewLinks(
            candidates,
            candidateJob,
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
      'startVideoInterviewChat',
      'startMeetingSchedulingChat',
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
