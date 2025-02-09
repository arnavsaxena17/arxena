import { StartVideoInterviewChatProcesses } from './candidate-engagement/chat-control-processes/start-video-interview-chat-processes';
import { TimeManagement } from './time-management';
import * as allDataObjects from './data-model-objects';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

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

  private getOrderNumber(type: allDataObjects.chatControlType, chatFlowOrder: allDataObjects.chatControlType[]): number {
    return chatFlowOrder.indexOf(type) + 1;
  }

  getNextStageInFlow(currentStage: string, chatFlowOrder: string[]): string | null {
    const currentIndex = chatFlowOrder.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex === chatFlowOrder.length - 1) {
      return null;
    }
    return chatFlowOrder[currentIndex + 1];
  }

  isStageComplete(candidate: any, stage: string): boolean {
    const completedField = `${stage}Completed`;
    return candidate[completedField] === true;
  }

  isReadyForNextStage(candidate: any, currentStage: string, chatFlowOrder: string[]): boolean {
    const currentIndex = chatFlowOrder.indexOf(currentStage);
    const previousStage = currentIndex > 0 ? chatFlowOrder[currentIndex - 1] : null;

    // If this is a continuation of current stage
    if (candidate[currentStage] && !candidate[`${currentStage}Completed`]) {
        // Just check if previous stage is completed if it exists
        return !previousStage || candidate[`${previousStage}Completed`];
    }

    // For progressing to next stage
    if (previousStage && !candidate[`${previousStage}Completed`]) {
        return false;
    }

    return true;
}

private getStagesByOrder(currentOrder: number, direction: 'before' | 'after', chatFlowOrder: allDataObjects.chatControlType[]): string[] {
    const stages = [...chatFlowOrder];
    const currentIndex = currentOrder - 1;

    return direction === 'before' ? stages.slice(0, currentIndex) : stages.slice(currentIndex + 1);
  }

  baseEngagementChecks = (candidate: allDataObjects.CandidateNode, chatControlType: allDataObjects.chatControlType, chatFlowOrder: allDataObjects.chatControlType[]) => {
    // Allow engagement if stage is started but not completed
    if (candidate[chatControlType] === true && 
        (candidate[`${chatControlType}Completed`] === false || candidate[`${chatControlType}Completed`] === null)) {
        
        // For non-first stages, check if previous stage is completed
        const currentIndex = chatFlowOrder.indexOf(chatControlType);
        if (currentIndex > 0) {
            const previousStage = chatFlowOrder[currentIndex - 1];
            if (!candidate[`${previousStage}Completed`]) {
                return false;
            }
        }
        
        // Time check
        if (candidate.whatsappMessages?.edges?.length > 0) {
            const latestMessage = candidate.whatsappMessages.edges[0].node;
            const waitTime = TimeManagement.timeDifferentials.timeDifferentialinMinutesToCheckTimeDifferentialBetweenlastMessage;
            const cutoffTime = new Date(Date.now() - waitTime * 60 * 1000);
            if (new Date(latestMessage.createdAt) >= cutoffTime) {
                console.log(`Candidate ${candidate.name} messaged too recently for ${chatControlType}`);
                return false;
            }
        }
        
        return true;
    }

    return false;
};

createIsEligibleForEngagement = (candidate: allDataObjects.CandidateNode, chatControlType: allDataObjects.chatControlType, order: number, chatFlowOrder) => {
  const currentIndex = chatFlowOrder.indexOf(chatControlType);
  if (currentIndex > 0) {
      const previousStage = chatFlowOrder[currentIndex - 1];
      const previousStageCompleted = candidate[`${previousStage}Completed`];
      const currentStageStarted = candidate[chatControlType];
      const currentStageCompleted = candidate[`${chatControlType}Completed`];
      
      // Allow engagement if:
      // 1. Previous stage is completed AND current stage is started but not completed
      if (previousStageCompleted && currentStageStarted && !currentStageCompleted) {
          return this.baseEngagementChecks(candidate, chatControlType, chatFlowOrder);
      }
  }

  return false;
};

private createFilterLogic(currentOrder: number, chatFlowOrder: allDataObjects.chatControlType[]) {
  return (candidate: allDataObjects.CandidateNode) => {
      // Get current stage info

      console.log("`createFilterLogic` called with currentOrder: ", currentOrder, " and chatFlowOrder: ", chatFlowOrder);
      console.log("`candidate: ", candidate, " and chatFlowOrder: ", chatFlowOrder);
      const currentStage = chatFlowOrder[currentOrder - 1];
      console.log("`currentStage: ", currentStage);
      const previousStage = currentOrder > 1 ? chatFlowOrder[currentOrder - 2] : null;

      // First stage logic
      if (currentOrder === 1) {
          return candidate.startChat && candidate.whatsappMessages?.edges.length === 0;
      }
      console.log("candidate[currentStage::", candidate[currentStage]);
      console.log("candidate[`${currentStage}Completed`]::", candidate[`${currentStage}Completed`]);
      console.log("candidate[`${currentStage}Completed`]::", candidate[`${currentStage}Completed`]);
      console.log("candidate[`${previousStage}Completed`][currentStage::", candidate[`${previousStage}Completed`]);
      // For continuing existing stage
      if (candidate[currentStage] && 
          (candidate[`${currentStage}Completed`] === false || candidate[`${currentStage}Completed`] === null) &&
          candidate[`${previousStage}Completed`] === true) {
          
          // Add debug logging
          console.log(`Candidate ${candidate.id} eligible for ${currentStage} continuation because:
              - Current stage (${currentStage}) started: ${candidate[currentStage]}
              - Current stage not completed: ${candidate[`${currentStage}Completed`]}
              - Previous stage (${previousStage}) completed: ${candidate[`${previousStage}Completed`]}`);
          
          return true;
      }

      return false;
  };
}


  private createChatFilters(
    config: { 
        type: allDataObjects.chatControlType; 
        filter: Record<string, any> 
    }, 
    chatFlowOrder: allDataObjects.chatControlType[]
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
              [`${config.type}Completed`]: { eq: false }
          },
          // For candidates who have started but not completed (with null)
          {
              stopChat: { eq: false },
              [`${previousStage}Completed`]: { eq: true },
              [config.type]: { eq: true },
              [`${config.type}Completed`]: { is: 'NULL' }
          },
          // For candidates who haven't started
          {
              stopChat: { eq: false },
              [`${previousStage}Completed`]: { eq: true },
              [config.type]: { eq: false }
          }
        ];
    }

    return [
        { 
            stopChat: { eq: false }, 
            [config.type]: { eq: true } 
        }
    ];
}



  createStatusUpdate = (order: number, type: string, chatFlowOrder): allDataObjects.ChatFlowConfig['statusUpdate'] => {
    const baseStatusUpdate = {
      timeWindow: TimeManagement.timeDifferentials.timeDifferentialinHoursForCheckingCandidateIdsWithStatusOfConversationClosed,
      isWithinAllowedTime: () => {
        const hours = new Date().getHours();
        return hours >= 8 && hours < 21;
      },
      filter: {} as Record<string, any>,
      orderBy: [] as Array<Record<string, any>>,
    };

    // Get previous stage name
    const currentIndex = chatFlowOrder.indexOf(type);
    const previousStage = currentIndex > 0 ? chatFlowOrder[currentIndex - 1] : null;

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
    const futureStageFilters = Object.fromEntries(futureStages.map(stage => [stage, { eq: false }]));

    if (type === 'startChat') {
      return {
        ...baseStatusUpdate,
        filter: {
          candConversationStatus: {
            in: ['CONVERSATION_CLOSED_TO_BE_CONTACTED', 'CANDIDATE_IS_KEEN_TO_CHAT'],
          },
          startChat: { eq: true },
          ...futureStageFilters,
        },
        orderBy: [{ position: 'AscNullsFirst' }],
      };
    }

    const previousStages = this.getStagesByOrder(order, 'before', chatFlowOrder);
    const previousStageFilters = Object.fromEntries(previousStages.map(stage => [`${stage}Completed`, { eq: true }]));

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
    type: allDataObjects.chatControlType, 
    order: number, 
    chatFlowOrder: allDataObjects.chatControlType[]
): allDataObjects.ChatFlowConfig {
    const self = this;
    const filter = { ...this.baseFilters, [type]: { eq: true } };

    return {
        order,
        type,
        filterLogic: this.createFilterLogic(order, chatFlowOrder),
        filter,
        get chatFilters() {
            // Use the config object's properties, not self's
            return self.createChatFilters({
                type: type,  // Use the type parameter
                filter: filter  // Use the filter we created above
            }, chatFlowOrder);
        },

    isEligibleForEngagement: candidate => this.createIsEligibleForEngagement(candidate, type, order, chatFlowOrder),
      templateConfig: {
        ...this.baseTemplateConfig,
        messageSetup: (isFirstMessage: boolean) => this.baseTemplateConfig.messageSetup(isFirstMessage, type),
      },
      statusUpdate: this.createStatusUpdate(order, type, chatFlowOrder),
      orderBy: [{ createdAt: 'DESC' }],
    };
  }

  specificConfigs: Record<allDataObjects.chatControlType, (baseConfig: allDataObjects.ChatFlowConfig) => allDataObjects.ChatFlowConfig> = {
    startChat: baseConfig => ({
      ...baseConfig,
    }),

    startVideoInterviewChat: baseConfig => ({
      ...baseConfig,
      preProcessing: async (candidates, candidateJob, chatControl, apiToken, workspaceQueryService) => {
        await new StartVideoInterviewChatProcesses(workspaceQueryService).setupVideoInterviewLinks(candidates, candidateJob, chatControl, apiToken);
      },
    }),
    startMeetingSchedulingChat: baseConfig => ({
      ...baseConfig,
    }),
    allStartedAndStoppedChats: baseConfig => baseConfig,
  };

  private applySpecificConfig(type: allDataObjects.chatControlType, baseConfig: allDataObjects.ChatFlowConfig): allDataObjects.ChatFlowConfig {
    const specificConfigs: Record<allDataObjects.chatControlType, (baseConfig: allDataObjects.ChatFlowConfig) => allDataObjects.ChatFlowConfig> = {
      startChat: config => ({ ...config }),
      startVideoInterviewChat: config => ({
        ...config,
        preProcessing: async (candidates, candidateJob, chatControl, apiToken) => {
          await new StartVideoInterviewChatProcesses(this.workspaceQueryService).setupVideoInterviewLinks(candidates, candidateJob, chatControl, apiToken);
        },
      }),
      startMeetingSchedulingChat: config => ({ ...config }),
      allStartedAndStoppedChats: config => config,
    };

    return specificConfigs[type](baseConfig);
  }

  public getDefaultChatFlowOrder(): allDataObjects.chatControlType[] {
    return ['startChat', 'startVideoInterviewChat', 'startMeetingSchedulingChat'] as const;
  }

  public buildChatFlowConfig(chatFlowOrder?: allDataObjects.chatControlType[]): Record<allDataObjects.chatControlType, allDataObjects.ChatFlowConfig> {
    const order = chatFlowOrder || this.getDefaultChatFlowOrder();
    return Object.fromEntries(
      order.map(type => {
        const orderNum = this.getOrderNumber(type, order);
        const baseConfig = this.createBaseChatFlowConfig(type, orderNum, order);
        return [type, this.applySpecificConfig(type, baseConfig)];
      }),
    ) as Record<allDataObjects.chatControlType, allDataObjects.ChatFlowConfig>;
  }
}
