import { ParsedJD } from '../types/ParsedJD';

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
      questions: partialData.chatFlow?.questions || [],
    },
    videoInterview: {
      questions: partialData.videoInterview?.questions || [],
    },
    meetingScheduling: {
      meetingType: partialData.meetingScheduling?.meetingType || 'scheduled',
      availableDates: partialData.meetingScheduling?.availableDates || [],
    },
  };
};
