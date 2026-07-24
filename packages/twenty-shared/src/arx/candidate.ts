export type CandidateEngagementNode = {
  id: string;
  name: string;
  company: string;
  jobTitle: string;
  jobs: {
    id: string;
    name: string;
    chatFlowOrder?: string[];
    chatQuestions?: string[];
  };
  people: {
    id: string;
  };
  whatsappMessages?: {
    edges: Array<{
      node: {
        id: string;
        createdAt: string;
        messageObj: any;
      };
    }>;
  };
  lastEngagementChatControl?: string;
  updatedAt: string;
  whatsappProvider?: string;
  messagingChannel?: string;
  startChat?: boolean;
  stopChat?: boolean;
  startChatCompleted?: boolean;
  startVideoInterviewChat?: boolean;
  startVideoInterviewChatCompleted?: boolean;
  startMeetingSchedulingChat?: boolean;
  startMeetingSchedulingChatCompleted?: boolean;
}; 