import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { StartVideoInterviewChatProcesses } from './candidate-engagement/chat-control-processes/start-video-interview-chat-processes';
import { FilterCandidates } from './candidate-engagement/filter-candidates';
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
      }
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

export const chatFlowConfigObj: Record<string, allDataObjects.ChatFlowConfig> = {
  startChat: {
    order: 1,
    type: 'startChat',
    filterLogic: candidate => createFilterLogic(1, candidate),
    filter: { ...baseFilters, startChat: { eq: true } },
    orderBy: [{ createdAt: 'DESC' }],
    get chatFilters() { return createChatFilters(this); },
    isEligibleForEngagement: candidate => createIsEligibleForEngagement(candidate, 'startChat', 1),
    templateConfig: { ...baseTemplateConfig, messageSetup: isFirstMessage => baseTemplateConfig.messageSetup(isFirstMessage, 'startChat') },
    statusUpdate: createStatusUpdate(1, 'startChat'),
  },
  startVideoInterviewChat: {
    order: 2,
    type: 'startVideoInterviewChat',
    filterLogic: candidate => createFilterLogic(2, candidate),
    preProcessing: async (candidates, candidateJob, chatControl, apiToken, workspaceQueryService) => {
      await new StartVideoInterviewChatProcesses(workspaceQueryService).setupVideoInterviewLinks(candidates, candidateJob, chatControl, apiToken);
    },
    filter: { ...baseFilters, startVideoInterviewChat: { eq: true } },
    orderBy: [{ position: 'AscNullsFirst' }],
    get chatFilters() { return createChatFilters(this); },
    isEligibleForEngagement: candidate => createIsEligibleForEngagement(candidate, 'startVideoInterviewChat', 2),
    statusUpdate: createStatusUpdate(2, 'startVideoInterviewChat'),
    templateConfig: { ...baseTemplateConfig, messageSetup: isFirstMessage => baseTemplateConfig.messageSetup(isFirstMessage, 'startVideoInterviewChat') },
  },
  startMeetingSchedulingChat: {
    order: 3,
    type: 'startMeetingSchedulingChat',
    filterLogic: candidate => createFilterLogic(3, candidate),
    filter: { ...baseFilters, startMeetingSchedulingChat: { eq: true } },
    orderBy: [{ createdAt: 'DESC' }],
    get chatFilters() { return createChatFilters(this); },
    isEligibleForEngagement: candidate => createIsEligibleForEngagement(candidate, 'startMeetingSchedulingChat', 3),
    statusUpdate: createStatusUpdate(3, 'startMeetingSchedulingChat'),
    templateConfig: { ...baseTemplateConfig, messageSetup: isFirstMessage => baseTemplateConfig.messageSetup(isFirstMessage, 'startMeetingSchedulingChat') },
  },
};
