export interface Question {
    id: string;
    name: string;
    timeLimit: number;
    questionType: string;
    questionValue: string;
  }
  
  export interface InterviewData {
    id: string;
    name: string;
    candidate: {
      id: string;
      jobs: {
        jobId: string;
        recruiterId: string;
        name: string;
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
  
export interface InterviewPageProps {
    InterviewData: InterviewData;
    questions: Question[];
    currentQuestionIndex: number;
    onNextQuestion: (responseData: FormData) => void;
    onFinish: () => void;
  }
  

export interface StartInterviewPageProps {
    onStart: () => void;
    candidateName: string;
    positionName: string;
    introduction: string;
    instructions: string;
  }
  