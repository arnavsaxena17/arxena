import { ParsedJD } from '../types/ParsedJD';

// Default questions for chat and video sections
const DEFAULT_CHAT_QUESTIONS = [
  'What is your current and expected CTC?',
  'Who do you report to, which functions report to you?',
];

const DEFAULT_VIDEO_QUESTIONS = [
  'Please tell us about yourself',
  'Why are you interested in working with us?',
];

type CreateDefaultParsedJDInput = Partial<ParsedJD>;

export const createDefaultParsedJD = (input: CreateDefaultParsedJDInput = {}): ParsedJD => {
  return {
    name: input.name || '',
    description: input.description || '',
    jobCode: input.jobCode || '',
    jobLocation: input.jobLocation || '',
    salaryBracket: input.salaryBracket || '',
    isActive: input.isActive ?? true,
    specificCriteria: input.specificCriteria || '',
    pathPosition: input.pathPosition || '',
    companyName: input.companyName || '',
    companyId: input.companyId || '',
    companyDetails: input.companyDetails || '',
    id: input.id,
    chatFlow: {
      order: {
        initialChat: input.chatFlow?.order?.initialChat ?? true,
        videoInterview: input.chatFlow?.order?.videoInterview ?? false,
        meetingScheduling: input.chatFlow?.order?.meetingScheduling ?? false,
      },
      questions: input.chatFlow?.questions?.length ? input.chatFlow.questions : DEFAULT_CHAT_QUESTIONS,
    },
    videoInterview: {
      questions: input.videoInterview?.questions?.length ? input.videoInterview.questions : DEFAULT_VIDEO_QUESTIONS,
    },
    meetingScheduling: {
      meetingType: input.meetingScheduling?.meetingType || 'online',
      availableDates: input.meetingScheduling?.availableDates || [],
    },
  };
};



export const blankParsedJD: ParsedJD = {
  name: '',
  description: '',
  jobCode: '',
  jobLocation: '',
  salaryBracket: '',
  isActive: true,
  specificCriteria: '',
  pathPosition: '',
  companyName: '',
  companyId: '',
  companyDetails: '',
  id: undefined,
  chatFlow: {
    order: {
      initialChat: true,
      videoInterview: false,
      meetingScheduling: false,
    },
    questions: [
      'What is your current and expected CTC?',
      'Who do you report to, which functions report to you?',
    ],
  },
  videoInterview: {
    questions: [
      'Please tell us about yourself',
      'Why are you interested in working with us?',
    ],
  },
  meetingScheduling: {
    meetingType: 'online',
    availableDates: [],
  },
}; 