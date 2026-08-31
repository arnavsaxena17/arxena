import type { CandidateFlags } from './candidateFlags';

export type CandidateEngagementNode = {
  id: string;
  name: string;
  company: string;
  jobTitle: string;
  projects: {
    id: string;
    name: string;
    chatFlowOrder?: string[];
    chatQuestions?: string[];
  };
  people: {
    id: string;
  };
  chatMessages?: {
    edges: Array<{
      node: {
        id: string;
        createdAt: string;
        messageObj: any;
      };
    }>;
  };
  candidateFlags?: CandidateFlags | null;
  updatedAt: string;
  whatsappProvider?: string;
  messagingChannel?: string;
};
