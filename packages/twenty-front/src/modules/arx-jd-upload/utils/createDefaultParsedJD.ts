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

export const createDefaultParsedJD = (
  partialData: Partial<ParsedJD> = {},
): ParsedJD => {
  return {
    name: partialData.name || '',
    description: partialData.description || '',
    jobCode: partialData.jobCode || '',
    jobLocation: partialData.jobLocation || '',
    salaryBracket: partialData.salaryBracket || '',
    isActive: partialData.isActive !== undefined ? partialData.isActive : true,
    specificCriteria: partialData.specificCriteria || '',
    pathPosition: partialData.pathPosition || '',
    companyName: partialData.companyName,
    companyId: partialData.companyId,
    chatFlow: {
      order: {
        initialChat: true,
        videoInterview: partialData.chatFlow?.order?.videoInterview || false,
        meetingScheduling:
          partialData.chatFlow?.order?.meetingScheduling || false,
      },
      questions: partialData.chatFlow?.questions?.length
        ? partialData.chatFlow.questions
        : DEFAULT_CHAT_QUESTIONS,
    },
    videoInterview: {
      questions: partialData.videoInterview?.questions?.length
        ? partialData.videoInterview.questions
        : DEFAULT_VIDEO_QUESTIONS,
    },
    meetingScheduling: {
      meetingType: partialData.meetingScheduling?.meetingType || 'online',
      availableDates: partialData.meetingScheduling?.availableDates || [],
    },
  };
};
