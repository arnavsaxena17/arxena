import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';

// Define the possible roles in the chat
export type ChatRole = 'system' | 'user' | 'tool' | 'assistant';


export interface ChatFlowConfig {
  order: number;
  type: chatControlType;
  filterLogic: (candidate: CandidateNode) => boolean;
  preProcessing?: (
    candidates: PersonNode[],
    candidateJob: Jobs,
    chatControl: chatControls,
    apiToken: string,
    workspaceQueryService: WorkspaceQueryService
  ) => Promise<void>;
  get chatFilters(): Array<Record<string, any>>;  // Changed to getter
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



export const statusesArray = ['SCREENING', "INTERESTED", "NOT_INTERESTED", "NOT_FIT",'CV_SENT',"CV_RECEIVED",'RECRUITER_INTERVIEW','CLIENT_INTERVIEW','NEGOTIATION'] as const;

export type WhatsappMessageType = "messages" | "media"
export interface ChatControlNode {
  chatControlType: string;
  nextNodes: string[];
  conditions?: {
    nextNode: string;
    evaluator: (candidate: CandidateNode) => boolean;
  }[];
}




export const allStatusesArray: [string, ...string[]] = [
  "ONLY_ADDED_NO_CONVERSATION",
  "CONVERSATION_STARTED_HAS_NOT_RESPONDED",
  "SHARED_JD_HAS_NOT_RESPONDED",
  "CANDIDATE_REFUSES_TO_RELOCATE",
  "CANDIDATE_IS_KEEN_TO_CHAT",
  "CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT",
  "CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION",
  "CONVERSATION_CLOSED_TO_BE_CONTACTED",
  "CANDIDATE_SALARY_OUT_OF_RANGE",
  "CANDIDATE_DECLINED_OPPORTUNITY",
];

export type allStatuses = typeof allStatusesArray[number];
export type statuses = typeof statusesArray[number];


export type chatControlType = "startChat" | "allStartedAndStoppedChats" | "startVideoInterviewChat" | "startMeetingSchedulingChat";
export interface chatControls {
  chatControlType: chatControlType;
  chatMessageTemplate?: string;
}



// Interface for chat message without tool call
export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  name?: string; 
}

// Interface for chat message with tool call
export interface ToolChatMessage {
  tool_call_id: string;
  name: string; // Required for tool messages
  role: ChatRole;
  content: string;
}

// Type for chat history items
export type ChatHistoryItem = ChatMessage | ToolChatMessage;

export interface AnswerMessageObj {
  questionsId: string;
  name: string;
  position: string;
  candidateId: string;
}

export interface MessageNode {
  recruiterId: string;
  message: string;
  candidateId: string;
  jobsId: string;
  position: number;
  messageType: string;
  phoneTo: string;
  updatedAt: string;
  createdAt: string;
  id: string;
  name: string;
  phoneFrom: string;
  messageObj: any;
}
export interface SendAttachment {
  filePath: string;
  phoneNumberTo: string;
  attachmentMessage: string;
}
export interface BaileysAttachmentObject {
  phoneNumberTo: string;
  fileData: {
    fileName: string;
    filePath: string;
    fileBuffer: string;
    mimetype: string;
  };
}

export interface FacebookWhatsappAttachmentChatRequestBody {
  phoneNumberFrom: string;
  phoneNumberTo: string;
  attachmentText: string;
  mediaFileName: string;
  mediaID: string;
}
export interface BaileysIncomingMessage {
  message: string;
  messageTimeStamp: string;
  phoneNumberFrom: string;
  fromName: string;
  phoneNumberTo: string;
  baileysMessageId: string;
}

export interface whatappUpdateMessageObjType {
  // executorResultObj: ChainValues;
  messageObj: ChatHistoryItem[];
  candidateProfile: CandidateNode;
  candidateFirstName: string;
  messages: { [x: string]: any }[];
  phoneNumberFrom: string;
  phoneNumberTo: string;
  whatsappMessageType: string | "";
  messageType: string;
  lastEngagementChatControl?:chatControlType;
  videoInterviewLink?: string;
  whatsappDeliveryStatus?: string;
  whatsappMessageId?: string;
  type?: string;
  databaseFilePath?: string;
}

export interface chatMessageType {
  messages: { [x: string]: any }[];
  phoneNumberFrom: string;
  phoneNumberTo: string;
  messageType: string;
}

export interface sendWhatsappTemplateMessageObjectType {
  template_name: string;
  recipient: string;
  recruiterName: string;
  candidateFirstName: string;
  recruiterJobTitle: string;
  recruiterCompanyName: string;
  candidateSource:string;
  recruiterCompanyDescription: string;
  jobPositionName: string;
  jobLocation: string;
}
export interface sendWhatsappUtilityMessageObjectType {
  discussionDate?: string | "";
  nextStep?: string | "";
  availableDate?: string | "";
  template_name: string | "";
  recipient: string | "";

  candidateSource:string;
  recruiterName: string | "";
  recruiterFirstName: string | "";
  candidateFirstName: string | "";
  recruiterJobTitle: string | "";
  recruiterCompanyName: string | "";
  recruiterCompanyDescription: string | "";
  descriptionOneliner:string | "";
  companyName: string | "";
  jobPositionName: string | "";
  videoInterviewLink: string;
  jobCode: string | "";
  jobLocation: string | "";
}

export interface WhatsAppMessagesEdge {
  node: MessageNode;
}

export interface WhatsAppMessages {
  edges: WhatsAppMessagesEdge[];
}


export interface Candidate {
  stopChat: any;
  startVideoInterviewChat: any;
  startChatCompleted: any;
  updatedAt: string | number | Date;
  candConversationStatus: string;
  startMeetingSchedulingChat: any;
  videoInterview?: videoInterview;
  id: string;
  name: string;
  startChat: boolean;
  jobs: Jobs;
  people: {
    id: string;
    name: {
      firstName: string;
      lastName: string;
    };
  };
}


export interface videoInterview {
  edges: videoInterviewEdge[];
}

export interface videoInterviewEdge {
  node: videoInterviewNode;
}

export interface videoInterviewNode {
  updatedAt: string | number | Date;
  id: string;
  interviewLink: InterviewLink;
  interviewCompleted: boolean;
  interviewStarted: boolean;
}

export interface InterviewLink {
  url: string;
}

export interface CandidateNode {
  updatedAt: string | number | Date;
  videoInterview: videoInterview;
  whatsappProvider?: string | "application03";
  name: string;
  id: string;
  engagementStatus: boolean;
  startVideoInterviewChat: boolean;
  startMeetingSchedulingChat: boolean;
  lastEngagementChatControl: chatControlType;
  phoneNumber: string;
  email: string;
  input: string;
  candConversationStatus?:string;
  startChat: boolean;
  stopChat: boolean;
  status:string;
  whatsappMessages: WhatsAppMessages;
  emailMessages: EmailMessages;
  jobs: Jobs;
  candidateReminders: Reminders;
  person? : PersonNode
}

// export interface ArxJobs {
//   name: string;
//   id: string;
//   recruiterId: string;
//   // companies: Companies;
//   jobLocation: string;
//   // whatsappMessages: WhatsAppMessages;
// }

export interface Reminders {
  edges: ReminderEdge[];
}

export interface ReminderEdge {
  node: ReminderObject;
}

export interface ReminderObject {
  remindCandidateAtTimestamp: string;
  remindCandidateDuration: string;
  isReminderActive: boolean;
  name: string;
  id: string;
}

export interface EmailMessages {
  edges: EmailMessagesEdge[];
}

export interface EmailMessagesEdge {
  node: EmailMessageNode;
}

export interface EmailMessageNode {
  id: string;
  email: string;
  text: string;
  subject: string;
  recruiterId: string;
  candidateId: string;
  jobsId: string;
  // messageType: string;
  messageThreadId: string;
  receivedAt: string;
  updatedAt: string;
  createdAt: string;
}

export interface CandidatesEdge {
  node: CandidateNode;
}

export interface Candidates {
  edges: CandidatesEdge[];
}

export interface Name {
  firstName: string;
  lastName: string;
}

export interface PersonNode {
  phone: string;
  email: string;
  jobTitle: string;
  id: string;
  position: number;
  uniqueStringKey: string;
  name: Name;
  candidates: Candidates;
}

export interface PersonEdge {
  node: PersonNode;
}

export interface People {
  edges: PersonEdge[];
}

export interface RootObject {
  people: People;
}

export interface ChatRequestBody {
  phoneNumberFrom: string;
  phoneNumberTo: string;
  messages: string; // Adjust the type according to the structure of 'messages'
}

export interface companyInfoType {
  name: string;
  companyId: string;
  descriptionOneliner: string;
}

export interface company {
  domainName: any;
  name: string;
  companyId: string;
  descriptionOneliner: string;
}

export interface jobProfileType {
  name: any;
  jobLocation: string;
  id: string;
  recruiterId: string;
  company: companyInfoType;
}
export interface Jobs {
  chatFlowOrder?: chatControlType[]; // Array defining the order for this job
  name: string;
  id: string;
  recruiterId: string;
  jobLocation: string;
  jobCode:string;
  company: company;
  createdAt?: string;
  interviewSchedule?: any;
  isActive: boolean;
  whatsappMessages: WhatsAppMessages;
}

export interface recruiterProfileType {
  job_title: any;
  job_company_name: any;
  company_description_oneliner: any;
  first_name: any;
  last_name: any;
  status: string;
  name: string;
  email: string;
  phone: string;
  input: string; // Add the 'input' property
}

interface Entry {
  id: string;
  changes: any[];
}

export interface WhatsAppBusinessAccount {
  object: 'whatsapp_business_account';
  entry: Entry[];
}

export const jobProfile: jobProfileType = {
  name: 'Sales Manager',
  id: '5643d1e6-0415-4327-b871-918e7cd699d5',
  recruiterId: '20202020-0687-4c41-b707-ed1bfca972a7',
  company: {
    name: 'Qonto',
    companyId: '1234',
    descriptionOneliner: "one of the india's largest waste management companies",
  },
  jobLocation: 'Mumbai',
};

export const recruiterProfile: recruiterProfileType = {
  name: 'Arnav Saxena',
  first_name: 'Arnav',
  last_name: 'Saxena',
  phone: '919326970534',
  email: 'arnav@arxena.com',
  input: '',
  status: '',
  job_title: 'Director',
  job_company_name: 'Arxena Inc',
  company_description_oneliner: 'a Global Recruitment Company',
};

export const emptyCandidateProfileObj: CandidateNode = {
  name: '',
  id: '',
  whatsappProvider: '',
  jobs: {
    name: '',
    id: '',
    isActive: false,
    recruiterId: '',
    company: {
      name: '',
      companyId: '',
      domainName: '',
      descriptionOneliner: '',
    },
    jobLocation: '',
    jobCode: "",
    whatsappMessages: {
      edges: [
        {
          node: {
            recruiterId: '',
            message: '',
            candidateId: '',
            jobsId: 'string',
            position: 0,
            messageType: '',
            phoneTo: '',
            updatedAt: '',
            createdAt: '',
            id: '',
            name: '',
            phoneFrom: '',
            messageObj: [],
          },
        },
      ],
    },
  },
  videoInterview: {
    edges: [
      {
        node: {
          id: '',
          interviewLink: {
            url: '',
          },
          updatedAt: '',
          interviewCompleted: false,
          interviewStarted: false
        },
      },
    ],
  },
  candidateReminders: {
    edges: [
      {
        node: {
          remindCandidateAtTimestamp: '',
          remindCandidateDuration: '',
          isReminderActive: false,
          name: '',
          id: '',
        },
      },
    ],
  },
  status: '',
  engagementStatus: false,
  phoneNumber: '',
  email: '',
  input: '',
  startChat: false,
  candConversationStatus: '',
  startMeetingSchedulingChat: false,
  lastEngagementChatControl: 'startChat' as chatControlType,
  startVideoInterviewChat: false,
  stopChat: false,
  whatsappMessages: {
    edges: [
      {
        node: {
          recruiterId: '',
          message: '',
          candidateId: '',
          jobsId: 'string',
          position: 0,
          messageType: '',
          phoneTo: '',
          updatedAt: '',
          createdAt: '',
          id: '',
          name: '',
          phoneFrom: '',
          messageObj: [],
        },
      },
    ],
  },
  emailMessages: {
    edges: [
      {
        node: {
          id: '',
          email: '',
          text: '',
          subject: '',
          recruiterId: '',
          candidateId: '',
          jobsId: '',
          messageThreadId: '',
          receivedAt: '',
          updatedAt: '',
          createdAt: '',
        },
      },
    ],
  },
  updatedAt: ''
};

export interface Attachment {
  __typename: string;
  whatsappMessageId: string | null;
  authorId: string | null;
  candidateId: string | null;
  fullPath: string;
  personId: string | null;
  name: string;
  opportunityId: string | null;
  cvsSentId: string | null;
  updatedAt: string;
  createdAt: string;
  jobId: string | null;
  type: string;
  companyId: string | null;
  screeningId: string | null;
  clientInterviewId: string | null;
  id: string;
  recruiterInterviewId: string | null;
  activityId: string | null;
  offerId: string | null;
  questionId: string | null;
  answerId: string | null;
}

export const candidateProfile: candidateProfileType = {
  first_name: 'Christoph',
  id: '12d2232a-e79b-41c8-b56c-c186abb7fdea',
  jobsId: '5643d1e6-0415-4327-b871-918e7cd699d5',
  status: 'string',
  job: jobProfile,
  phoneNumber: '+919820297156',
  email: 'christoph.calisto@linkedin.com',
  responsibleWorkspaceMemberId: '20202020-0687-4c41-b707-ed1bfca972a7',
  input: 'string', // Add the 'input' property
};

export interface candidateProfileType {
  first_name: any;
  id: string;
  jobsId: string;
  status: string;
  job: jobProfileType;
  phoneNumber: string;
  email: string;
  responsibleWorkspaceMemberId: string;
  input: string; // Add the 'input' property
}

export interface OpenAIArxSingleStepClient {
  personNode: PersonNode;
  openAIclient: OpenAI;
  anthropic: Anthropic;
}

export interface OpenAIArxMultiStepClient {
  personNode: PersonNode;
  openAIclient: OpenAI;
  anthropic: Anthropic;
}

export interface AttachmentMessageObject {
  phoneNumberTo: string;
  phoneNumberFrom: string;
  fullPath: string;
  fileData: {
    fileName: string;
    filePath: string;
    fileBuffer?: string;
    mimetype: string;
  };
}
