export interface Question {
  attachments: any;
  id: string;
  name: string;
  timeLimit: number;
  questionType: string;
  createdAt: string;
  questionValue: string;
}

export const emptyInterviewData: InterviewData = {
  recruiterProfile: {
    companyName: '',
    companyDescription: '',
    firstName: '',
    lastName: '',
    name: '',
    email: '',
    phone: '',
  },
  id: '',
  name: '',
  candidate: {
    id: '',
    jobs: {
    jobId: '',
    name: '',
    recruiterId: '',
    companyName: '',
    },
    people: {
      id: '',
    name: {
      firstName: '',
      lastName: '',
    },
    email: '',
    phone: '',
    },
  },
  videoInterview: {
    id: '',
    name: '',
    introduction: '',
    instructions: '',
    videoInterviewQuestions: {
    edges: [],
    },
  },
  };


  export interface RecruiterProfileType {
    jobTitle?: string;
    companyName: string;
    companyDescription: string;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    phone: string;
  }
  

export interface InterviewData {
  recruiterProfile:RecruiterProfileType,
  id: string;
  name: string;
  candidate: {
    id: string;
    jobs: {
      jobId: string;
      recruiterId: string;
      name: string;
      companyName: string;
    };
    people: {
      id: string;
      name: {
        firstName: string;
        lastName: string;
      };
      email: string;
      phone: string;
    };
  };
  videoInterview: {
    id: string;
    name: string;
    introduction: string;
    instructions: string;
    videoInterviewQuestions: {
      edges: Array<{
        node: Question;
      }>;
    };
  };
}

export interface Question {
  id: string;
  name: string;
  questionValue: string;
  timeLimit: number;
}

export interface VideoInterviewAttachment {
  data: any;
  id: string;
  fullPath: string;
  name: string;
}


export interface GetInterviewDetailsResponse {
  responseFromInterviewRequests: InterviewData;
  videoInterviewAttachmentResponse: VideoInterviewAttachment;
  questionsAttachments: VideoInterviewAttachment[];
}

export interface InterviewPageProps {
  InterviewData: InterviewData;
  questions: Question[];
  introductionVideoAttachment: VideoInterviewAttachment;
  questionsVideoAttachment: VideoInterviewAttachment[];
  currentQuestionIndex: number;
  onNextQuestion: (responseData: FormData) => void;
  onFinish: () => void;
}

export interface StartInterviewPageProps {
  onStart: () => void;
  InterviewData: InterviewData;
  introductionVideoData: VideoInterviewAttachment;
}
