import { StartVideoInterviewChatProcesses } from './candidate-engagement/chat-control-processes/start-video-interview-chat-processes';
import { TimeManagement } from './time-management';
import * as allDataObjects from './data-model-objects';

// chat-flow-config.ts
// chat-flow-config.ts

const baseTemplateConfig = {
  defaultTemplate: 'application03',
  messageSetup: (isFirstMessage: boolean, chatType: string) => ({
    whatsappTemplate: 'application03',
    requiresSystemPrompt: isFirstMessage,
    userContent: chatType,
  }),
};

const getRequiredChatControls = (currentOrder: number): string[] => {
  return Object.entries(chatFlowConfigObj)
    .filter(([, config]) => config.order > 0 && config.order <= currentOrder) // Get all controls up to current order
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([type]) => type);
};

const createIsEligibleForEngagement = (candidate: allDataObjects.CandidateNode, chatControlType: string, order: number) => {
  // First check base engagement rules
  if (!baseEngagementChecks(candidate, chatControlType)) {
    return false;
  }
  // Get all required chat controls in order
  const requiredControls = getRequiredChatControls(order);
  return requiredControls.every(controlType => {
    const controlProperty = controlType as keyof typeof candidate;
    return candidate[controlProperty];
  });
};

const baseFilters = {
  stopChat: { is: 'NULL' },
};

const baseEngagementChecks = (candidate: allDataObjects.CandidateNode, chatControlType: string) => {
  if (!candidate.engagementStatus || candidate.lastEngagementChatControl !== chatControlType) {
    console.log(`Candidate ${candidate.name} not eligible: wrong engagement status or chat control`);
    return false;
  }
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
};

const createChatFilters = (config: { type: string; filter: Record<string, any> }) => {
  const baseFilter = { ...config.filter };
  const activeFilter = {
    ...baseFilter,
    stopChat: { eq: false },
  };
  return [baseFilter, activeFilter];
};

const getPreviousChatControl = (currentOrder: number): string => {
  const orderedControls = Object.entries(chatFlowConfigObj)
    .filter(([, config]) => config.order > 0) // Only include active chat controls
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([type, config]) => ({ type, order: config.order }));

  const previousControl = orderedControls.find(control => control.order === currentOrder - 1);
  return previousControl?.type || '';
};

const createFilterLogic = (currentOrder: number, candidate: allDataObjects.CandidateNode) => {
  const previousControl = getPreviousChatControl(currentOrder);
  if (currentOrder === 1) {
    return candidate.startChat && candidate.whatsappMessages?.edges.length === 0;
  }
  return candidate.startChat && candidate.whatsappMessages?.edges.length > 0 && candidate[`${chatFlowConfigObj[previousControl].type}`] && candidate.lastEngagementChatControl === previousControl;
};

const createStatusUpdate = (order: number, type: string): allDataObjects.ChatFlowConfig['statusUpdate'] => {
  const baseStatusUpdate = {
    timeWindow: TimeManagement.timeDifferentials.timeDifferentialinHoursForCheckingCandidateIdsWithStatusOfConversationClosed,
    isWithinAllowedTime: () => {
      const hours = new Date().getHours();
      return hours >= 8 && hours < 21;
    },
    filter: {} as Record<string, any>,
    orderBy: [] as Array<Record<string, any>>,
  };
  // Different configurations based on chat type
  switch (type) {
    case 'startChat':
      const filter = {
        ...baseStatusUpdate,
        filter: { candConversationStatus: { in: ['CONVERSATION_CLOSED_TO_BE_CONTACTED', 'CANDIDATE_IS_KEEN_TO_CHAT'] }, startChat: { eq: true }, startVideoInterviewChat: { eq: false }, startMeetingSchedulingChat: { eq: false } },
        orderBy: [{ position: 'AscNullsFirst' }],
      };
      return filter;

    case 'startVideoInterviewChat':
      return {
        ...baseStatusUpdate,
        filter: { isVideoInterviewCompleted: { eq: true }, startMeetingSchedulingChat: { eq: false } },
      };

    default:
      return undefined;
  }
};

// Define the chat flow order
// const chatFlowOrder = ['startChat', 'startVideoInterviewChat', 'startMeetingSchedulingChat'] as const;
const chatFlowOrder = ['startChat', 'startVideoInterviewChat', 'startMeetingSchedulingChat'] as const;

// Create a type for the chat flow keys
type ChatFlowKey = (typeof chatFlowOrder)[number];

// Helper function to get order number (1-based index)
const getOrderNumber = (type: ChatFlowKey): number => chatFlowOrder.indexOf(type) + 1;

const createChatFlowConfig = (type: ChatFlowKey): allDataObjects.ChatFlowConfig => {
  const order = getOrderNumber(type);
  const baseConfig = {
    get order() {
      return order;
    },
    type,
    filterLogic: (candidate: allDataObjects.CandidateNode) => createFilterLogic(order, candidate),
    filter: { ...baseFilters, [type]: { eq: true } },
    get chatFilters() {
      return createChatFilters(this);
    },
    isEligibleForEngagement: (candidate: allDataObjects.CandidateNode) => createIsEligibleForEngagement(candidate, type, order),
    templateConfig: { ...baseTemplateConfig, messageSetup: (isFirstMessage: boolean) => baseTemplateConfig.messageSetup(isFirstMessage, type) },
    statusUpdate: createStatusUpdate(order, type),
  };

  // Add type-specific configurations
  switch (type) {
    case 'startChat':
      return { ...baseConfig, orderBy: [{ createdAt: 'DESC' }] };

    case 'startVideoInterviewChat':
      return {
        ...baseConfig,
        orderBy: [{ position: 'AscNullsFirst' }],
        preProcessing: async (candidates, candidateJob, chatControl, apiToken, workspaceQueryService) => {
          await new StartVideoInterviewChatProcesses(workspaceQueryService).setupVideoInterviewLinks(candidates, candidateJob, chatControl, apiToken);
        },
      };

    case 'startMeetingSchedulingChat':
      return { ...baseConfig, orderBy: [{ createdAt: 'DESC' }] };
  }
};

export const chatFlowConfigObj = Object.fromEntries(chatFlowOrder.map(type => [type, createChatFlowConfig(type)])) as Record<ChatFlowKey, allDataObjects.ChatFlowConfig>;
