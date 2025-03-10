export type ParsedJD = {
  name: string;
  description: string;
  jobCode: string;
  jobLocation: string;
  salaryBracket: string;
  isActive: boolean;
  specificCriteria: string;
  pathPosition: string;
  companyName?: string;
  companyId?: string;
  id?: string;
  chatFlow: {
    order: {
      initialChat: boolean;
      videoInterview: boolean;
      meetingScheduling: boolean;
    };
    questions: string[];
  };
  videoInterview: {
    questions: string[];
  };
  meetingScheduling: {
    meetingType: 'walkIn' | 'online' | 'inPerson';
    availableDates: Array<{
      date: string;
      timeSlots: {
        morning: boolean;
        afternoon: boolean;
        evening: boolean;
      };
    }>;
  };
};
