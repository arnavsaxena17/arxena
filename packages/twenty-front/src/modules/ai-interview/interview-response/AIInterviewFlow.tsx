import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { StartInterviewPage } from './StartInterviewPage';
import { InterviewPage } from './InterviewPage';
import { EndInterviewPage } from './EndInterviewPage';
import { ErrorBoundary } from './ErrorBoundary'; // Import the ErrorBoundary component
import styled from '@emotion/styled';

import * as InterviewResponseTypes from './types/interviewResponseTypes';

const LoaderOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  z-index: 1000;
`;

const LoaderCard = styled.div`
  background-color: white;
  padding: 32px;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const SpinnerContainer = styled.div`
  width: 48px;
  height: 48px;
  position: relative;
`;

const Spinner = styled.div`
  width: 100%;
  height: 100%;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
`;

const LoaderText = styled.p`
  font-size: 18px;
  font-weight: 500;
  color: #333;
`;

const InterviewLoader = () => (
  <LoaderOverlay>
    <LoaderCard>
      <SpinnerContainer>
        <Spinner />
      </SpinnerContainer>
      <LoaderText>Preparing your interview...</LoaderText>
    </LoaderCard>
  </LoaderOverlay>
);

const AIInterviewFlow: React.FC<{ interviewId: string }> = ({ interviewId }) => {
  const [stage, setStage] = useState<'start' | 'interview' | 'end'>('start');
  const [loading, setLoading] = useState(false);
  const [interviewData, setInterviewData] = useState<InterviewResponseTypes.InterviewData | null>(null);
  const [introductionVideoData, setintroductionVideoData] = useState<InterviewResponseTypes.VideoInterviewAttachment | null>(null);
  const [questionsVideoData, setquestionsVideoData] = useState<InterviewResponseTypes.VideoInterviewAttachment[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [videoLoadingStatus, setVideoLoadingStatus] = useState<Record<string, boolean>>({});

  const [globalVideoPlaybackState, setGlobalVideoPlaybackState] = useState({
    isPlaying: false,
    isMuted: false
  });

  const handleVideoStateChange = (newState: { isPlaying: boolean; isMuted: boolean }) => {
    setGlobalVideoPlaybackState(newState);
  };



  useEffect(() => {
    fetchInterviewData();
  }, [interviewId]);



  // Function to preload a video
  const preloadVideo = async (url: string) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.src = url;
      
      video.oncanplaythrough = () => {
        setVideoLoadingStatus(prev => ({
          ...prev,
          [url]: true
        }));
        resolve(true);
      };
      
      video.load();
    });
  };

  // Preload all videos when interview data is fetched
  useEffect(() => {
    const preloadAllVideos = async () => {
      if (introductionVideoData?.data?.attachments?.edges[0]?.node?.fullPath) {
        const introUrl = `${process.env.REACT_APP_SERVER_BASE_URL}/files/${introductionVideoData.data.attachments.edges[0].node.fullPath}`;
        preloadVideo(introUrl);
      }

      // Preload all question videos
      if (questionsVideoData?.length > 0) {
        questionsVideoData.forEach(attachment => {
          if (attachment?.fullPath) {
            const videoUrl = `${process.env.REACT_APP_SERVER_BASE_URL}/files/${attachment.fullPath}`;
            preloadVideo(videoUrl);
          }
        });
      }
    };

    if (interviewData) {
      setLoading(true);
      preloadAllVideos().finally(() => {
        setLoading(false);
      });
    }
  }, [interviewData, introductionVideoData, questionsVideoData]);


  const fetchInterviewData = async () => {
    setLoading(true);

    try {
      const response = await axios.post(`${process.env.REACT_APP_SERVER_BASE_URL}/video-interview/get-interview-details`, { interviewId });
      console.log('This is the response to fetch interview data:', response);
      const responseObj: InterviewResponseTypes.GetInterviewDetailsResponse = response.data;
      if (responseObj) {
        // console.log('responseObj to fetch interview data:', responseObj);
        // console.log('responseObj to fetch interview data:', responseObj);
        const fetchedData: any = response?.data?.responseFromInterviewRequests?.data;
        console.log('fetchedData to fetch interview data:', fetchedData);
        const formattedData: InterviewResponseTypes.InterviewData = {
          name: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.name || '',
          id: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.id || '',
          candidate: {
            id: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.id || '',
            jobs: {
              jobId: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.jobs?.id || '',
              name: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.jobs?.name || '',
              recruiterId: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.jobs?.recruiterId || '',
              companyName: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.jobs?.companies?.name || '',
            },
            people: {
              name: {
                firstName: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.people?.name?.firstName || '',
                lastName: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.people?.name?.lastName || '',
              },
              email: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.people?.email || '',
              phone: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.candidate?.people?.phone || '',
            },
          },
          aIInterview: {
            name: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.aIInterview?.name || '',
            introduction: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.aIInterview?.introduction || '',
            instructions: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.aIInterview?.instructions || '',
            aIInterviewQuestions: fetchedData?.aIInterviewStatuses?.edges[0]?.node?.aIInterview?.aIInterviewQuestions || '',
          },
        };
        console.log('setting formatted interview data:', formattedData);
        setInterviewData(formattedData);
        setintroductionVideoData(responseObj?.videoInterviewAttachmentResponse);
        setquestionsVideoData(Array.isArray(responseObj?.questionsAttachments) ? responseObj.questionsAttachments : []);
      } else {
        console.error('No interview data found');
      }
    } catch (error) {
      console.error('Error fetching interview data:', error);
    }
  };

  const handleStart = () => setStage('interview');
  const handleNextQuestion = async (responseData: FormData) => {
    console.log('Currnet question  index in handle Next Question:', currentQuestionIndex);
    try {
      console.log('Going to handle next question, let sed if this submists');
      setCurrentQuestionIndex(prevIndex => {
        const nextIndex = prevIndex + 1;
        if (nextIndex === (interviewData?.aIInterview?.aIInterviewQuestions?.edges?.length ?? 0)) {
          setStage('end');
        }
        return nextIndex;
      });
      // console.log('This is process.env.REACT_APP_SERVER_BASE_URL:', process.env.REACT_APP_SERVER_BASE_URL);
      // console.log('This is the appending of the rinterview dat:', interviewData);
      responseData.append('interviewData', JSON.stringify(interviewData));
      responseData.append('currentQuestionIndex', currentQuestionIndex.toString());
      responseData.forEach((value, key) => {
        console.log('key for response data:', key, '::', value);
      });
      // console.log("Final resposne data being setnt:", responseData)
      const response = await axios.post(process.env.REACT_APP_SERVER_BASE_URL + '/video-interview/submit-response', responseData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      console.log('This isreht ersponse:', response);
      console.log('The calue of interviewData!.aIInterview.aIInterviewQuestions.edges.length is ::', interviewData!.aIInterview?.aIInterviewQuestions?.edges?.length);
    } catch (error) {
      console.error('Error submitting response:', error);
    }
  };

  const handleSubmitFeedback = async (feedback: string) => {
    try {
      const response = await axios.post(`${process.env.REACT_APP_SERVER_BASE_URL}/video-interview/update-feedback`, { interviewId, feedback });
      console.log('Interview completed, feedback submitted:', response.status);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const handleFinish = () => {
    setStage('end');
  };

  console.log('This is the interview questions:', interviewData?.aIInterview?.aIInterviewQuestions?.edges);
  const renderCurrentStage = () => {
    if (!interviewData) {
      return (
      <StartInterviewPage
        onStart={handleStart}
        InterviewData={InterviewResponseTypes.emptyInterviewData}
        introductionVideoData={introductionVideoData!}
        videoPlaybackState={globalVideoPlaybackState}
        onVideoStateChange={handleVideoStateChange}
    />
      );
    }
    switch (stage) {
      case 'start':
        return (
          <>
            {introductionVideoData && <StartInterviewPage onStart={handleStart} InterviewData={interviewData} introductionVideoData={introductionVideoData} videoPlaybackState={globalVideoPlaybackState} onVideoStateChange={handleVideoStateChange} />}
            {loading && <InterviewLoader />}
          </>
        );
      case 'interview':
        return (
          <ErrorBoundary>
          {loading && <InterviewLoader />}
            <InterviewPage
              InterviewData={interviewData}
              questions={interviewData?.aIInterview?.aIInterviewQuestions?.edges?.map(edge => edge?.node).sort((a, b) => new Date(a?.createdAt).getTime() - new Date(b?.createdAt).getTime())}
              introductionVideoAttachment={introductionVideoData!}
              questionsVideoAttachment={questionsVideoData || []}
              currentQuestionIndex={currentQuestionIndex}
              onNextQuestion={handleNextQuestion}
              onFinish={handleFinish}
              videoPlaybackState={globalVideoPlaybackState}
              onVideoStateChange={handleVideoStateChange}

            />
          </ErrorBoundary>
        );
      case 'end':
        return <EndInterviewPage interviewData={interviewData} onSubmit={handleSubmitFeedback} />;
      default:
        return null;
    }
  };

  return <div>{renderCurrentStage()}</div>;
};

export default AIInterviewFlow;
