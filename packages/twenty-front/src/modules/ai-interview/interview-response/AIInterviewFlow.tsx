import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { StartInterviewPage } from './StartInterviewPage';
import { InterviewPage } from './InterviewPage';
import { EndInterviewPage } from './EndInterviewPage';



interface Question {
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
    id:string
    jobs:{
      jobId: string;
      recruiterId: string;
      name: string;
    }
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

export const AIInterviewFlow: React.FC<{ interviewId: string }> = ({ interviewId }) => {
  const [stage, setStage] = useState<'start' | 'interview' | 'end'>('start');
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  
  useEffect(() => {
    fetchInterviewData();
  }, [interviewId]);

  const fetchInterviewData = async () => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_SERVER_BASE_URL}/video-interview/get-interview-details`, { interviewId });
      console.log("This is the response:", response);
      
      const fetchedData = response.data.data;
      if (fetchedData) {
        const formattedData: InterviewData = {
          name: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.name,
          id: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.id,
          candidate: {
            id: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.id,
            jobs: {
              jobId :fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.jobs?.id,
              name :fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.jobs?.name,
              recruiterId : fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.jobs?.recruiterId
            },
            people: {
              name: {
                firstName: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.people?.name?.firstName,
                lastName: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.people?.name?.lastName
              },
              email: fetchedData?.candidate?.people?.email,
              phone: fetchedData?.candidate?.people?.phone
            }
          },
          aIInterview: {
            name: fetchedData.aIInterviewStatuses.edges[0].node?.aIInterview?.name,
            introduction: fetchedData.aIInterviewStatuses.edges[0].node.aIInterview.introduction,
            instructions: fetchedData.aIInterviewStatuses.edges[0].node.aIInterview.instructions,
            aIInterviewQuestions: fetchedData.aIInterviewStatuses.edges[0].node.aIInterview.aIInterviewQuestions
          }
        };
        setInterviewData(formattedData);
      } else {
        console.error('No interview data found');
      }
    } catch (error) {
      console.error('Error fetching interview data:', error);
      // Consider adding user-friendly error handling here
    }
  };

  const handleStart = () => {
    setStage('interview');
  };

  const handleNextQuestion = async (responseData: FormData) => {
    try {
      console.log("Going to handle next question, let sed if this submists")
      console.log("This is process.env.REACT_APP_SERVER_BASE_URL:", process.env.REACT_APP_SERVER_BASE_URL)
      responseData.append('interviewData', JSON.stringify(interviewData));
      const response = await axios.post(process.env.REACT_APP_SERVER_BASE_URL+'/video-interview/submit-response', responseData, {
        headers: { 'Content-Type': 'multipart/form-data', },
      });
      console.log("This isreht ersponse:", response)
      if (currentQuestionIndex < interviewData!.aIInterview.aIInterviewQuestions.edges.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        setStage('end');
      }
    } catch (error) {
      console.error('Error submitting response:', error);
      // Consider adding user-friendly error handling here
    }
  };

  const handleSubmitFeedback = async (feedback: string) => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_SERVER_BASE_URL}/video-interview/update-feedback`, { interviewId, feedback });

      console.log('Interview completed, feedback submitted:', response.status);
      // Consider implementing a success message or redirect after submission
    } catch (error) {
      console.error('Error submitting feedback:', error);
      // Consider adding user-friendly error handling here
    }
  };

  const handleFinish = () => {
    setStage('end');
  };

  const renderCurrentStage = () => {
    if (!interviewData) return <div>Loading...</div>;

    switch (stage) {
      case 'start':
        return (
          <StartInterviewPage
            onStart={handleStart}
            candidateName={`${interviewData.candidate.people.name.firstName} ${interviewData.candidate.people.name.lastName}`}
            positionName={interviewData.aIInterview.name}
            introduction={interviewData.aIInterview.introduction}
            instructions={interviewData.aIInterview.instructions}
          />
        );
      case 'interview':
        return (
          <InterviewPage
            InterviewData = {interviewData}
            questions={interviewData.aIInterview.aIInterviewQuestions.edges.map(edge => edge.node)}
            currentQuestionIndex={currentQuestionIndex}
            onNextQuestion={handleNextQuestion}
            onFinish={handleFinish}
          />
        );
      case 'end':
        return <EndInterviewPage onSubmit={handleSubmitFeedback} />;
      default:
        return null;
    }
  };

  return (
    <div className="ai-interview-flow">
      {renderCurrentStage()}
    </div>
  );
};

