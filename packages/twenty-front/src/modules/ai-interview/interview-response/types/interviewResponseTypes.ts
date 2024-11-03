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
    name: {
      firstName: '',
      lastName: '',
    },
    email: '',
    phone: '',
    },
  },
  aIInterview: {
    name: '',
    introduction: '',
    instructions: '',
    aIInterviewQuestions: {
    edges: [],
    },
  },
  };

export interface InterviewData {
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
      name: {
        firstName: string;
        lastName: string;
      };
      email: string;
      phone: string;
    };
  };
  aIInterview: {
    name: string;
    introduction: string;
    instructions: string;
    aIInterviewQuestions: {
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
