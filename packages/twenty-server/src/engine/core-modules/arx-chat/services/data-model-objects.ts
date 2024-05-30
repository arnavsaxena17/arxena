import { ChainValues } from "@langchain/core/utils/types";
import {  BaseMessage } from "@langchain/core/messages";

// Define the possible roles in the chat
export type ChatRole = "system" | "user" | "tool";

// Interface for chat message without tool call
export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string; // Optional, only for tool messages
}

// Interface for chat message with tool call
export interface ToolChatMessage extends ChatMessage {
  tool_call_id: string;
  name: string; // Required for tool messages
}

// Type for chat history items
export type ChatHistoryItem = ChatMessage | ToolChatMessage;

export interface MessageNode {
  recruiterId: string;
  message: string;
  candidateId: string;
  jobsId: string;
  position: number;
  messageType : string;
  phoneTo: string;
  updatedAt: string;
  createdAt: string;
  id: string;
  name: string;
  phoneFrom: string;
  messageObj: any ;
}
export interface SendAttachment {
  filePath: string;
  phoneNumberTo: string;
  attachmentMessage: string;
}
export interface BaileysAttachmentObject{
  phoneNumberTo: string;
  fileData: {
    fileName: string;
    filePath: string;
    fileBuffer: string;
    mimetype: string;
  }

}


export interface attachmentMessageObj{
  phoneNumberTo: string;
  phoneNumberFrom: string;
  fullPath: string;
  fileData: {
    fileName: string;
    filePath: string;
    fileBuffer: string;
    mimetype: string;
  }

}
export interface FacebookWhatsappAttachmentChatRequestBody{
  phoneNumberFrom: string;
  phoneNumberTo: string;
  attachmentMessage: string;
  mediaFileName :string;
  mediaID : string;
}
export interface BaileysIncomingMessage{
  message: string,
  messageTimeStamp: string,
  phoneNumberFrom: string,
  fromName:string,
  phoneNumberTo: string,

}





export interface candidateChatMessageType { 
  executorResultObj: ChainValues;
  messageObj: ChatHistoryItem[];
  candidateProfile : CandidateNode;
  candidateFirstName: string;
  messages: { [x: string]: any; }[]; 
  phoneNumberFrom: string; 
  phoneNumberTo: string; 
  messageType : string;
}


export interface chatMessageType { 
  messages: { [x: string]: any; }[]; 
  phoneNumberFrom: string; 
  phoneNumberTo: string; 
  messageType : string;
}

export interface sendWhatsappTemplateMessageObjectType {
  template_name: string;
  recipient: string;
  recruiterName: string;
  candidateFirstName: string;
  recruiterJobTitle: string;
  recruiterCompanyName: string;
  recruiterCompanyDescription: string;
  jobPositionName: string;
  jobLocation: string;
}

export interface WhatsAppMessagesEdge {
  node: MessageNode;
}

export interface WhatsAppMessages {
  edges: WhatsAppMessagesEdge[];
}

export interface CandidateNode {
  name: string;
  id: string;
  engagementStatus: boolean;
  phoneNumber: string;
  email: string;
  input: string;
  startChat: boolean;
  whatsappMessages: WhatsAppMessages;
  jobs: Jobs;
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
  name : string;
  companyId: string;
  descriptionOneliner : string;
}

export interface Companies {
  name: string;
  companyId:string;
  descriptionOneliner: string;
}

export interface jobProfileType {
    name: any;
    jobLocation: string;
    id: string,
    recruiterId :string,
    company : companyInfoType
  }
  export interface Jobs {
    name: string;
    id: string;
    recruiterId: string;
    jobLocation: string;
    companies: Companies;
    whatsappMessages: WhatsAppMessages;
  }
  

export interface recruiterProfileType {
  job_title: any;
  job_company_name: any;
  company_description_oneliner: any;
  first_name: any;
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

export const jobProfile:jobProfileType = {
  name: 'Sales Manager',
  id: '5643d1e6-0415-4327-b871-918e7cd699d5',
  recruiterId : '20202020-0687-4c41-b707-ed1bfca972a7',
  company: {
    name: "Qonto",
    companyId : "1234",
    descriptionOneliner: "one of the india's largest waste management companies"
  },
  jobLocation: 'Mumbai'
}

export const recruiterProfile:recruiterProfileType = {
  name: 'Arnav Doe',
  first_name: 'Arnav',
  phone: "919326970534",
  email: 'arnav@arxena.com',
  input: "",
  status: "",
  job_title: "Director",
  job_company_name: "Arxena Inc",
  company_description_oneliner: "a US Based Recruitment Company"
}

export const emptyCandidateProfileObj: CandidateNode = {
  name: '',
  id: '',
  jobs: {
      name: '',
      id: '',
      recruiterId: '',
      companies: {
          name: '',
          companyId: '',
          descriptionOneliner: ''
        },
      jobLocation: '',
      whatsappMessages: {
        edges:[{node:
          {
            recruiterId: '',
            message: '',
            candidateId: '',
            jobsId: 'string',
            position: 0,
            messageType : '',
            phoneTo: '',
            updatedAt: '',
            createdAt: '',
            id: '',
            name: '',
            phoneFrom: '',
            messageObj: {}
          }
          
        }]
      }
  },
     
    engagementStatus: false,
    phoneNumber: '',
    email: '',
    input: '',
    startChat: false,
    whatsappMessages: {
      edges:[{node:
        {
          recruiterId: '',
          message: '',
          candidateId: '',
          jobsId: 'string',
          position: 0,
          messageType : '',
          phoneTo: '',
          updatedAt: '',
          createdAt: '',
          id: '',
          name: '',
          phoneFrom: '',
          messageObj: ''
        }
        
      }]
    }
}

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

export const candidateProfile:candidateProfileType = {
  first_name: 'Christoph',
  id: '12d2232a-e79b-41c8-b56c-c186abb7fdea',
  jobsId: '5643d1e6-0415-4327-b871-918e7cd699d5',
  status: 'string',
  job: jobProfile,
  phoneNumber: '+919820297156',
  email: 'christoph.calisto@linkedin.com',
  responsibleWorkspaceMemberId: '20202020-0687-4c41-b707-ed1bfca972a7',
  input: 'string', // Add the 'input' property
}


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
