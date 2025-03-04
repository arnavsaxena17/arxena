import styled from '@emotion/styled';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { EndInterviewPage } from './EndInterviewPage';
import { ErrorBoundary } from './ErrorBoundary'; // Import the ErrorBoundary component
import { InterviewPage } from './InterviewPage';
import { StartInterviewPage } from './StartInterviewPage';

import { GetInterviewDetailsResponse, InterviewData, VideoInterviewAttachment, emptyInterviewData } from 'twenty-shared';
import { StreamProvider, useStream } from '../StreamManager';

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

const VideoInterviewFlow: React.FC<{ interviewId: string }> = ({ interviewId }) => {
  const [stage, setStage] = useState<'start' | 'interview' | 'end'>('start');
  const [loading, setLoading] = useState(false);
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [introductionVideoData, setintroductionVideoData] = useState<VideoInterviewAttachment | null>(null);
  const [questionsVideoData, setquestionsVideoData] = useState<VideoInterviewAttachment[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [videoLoadingStatus, setVideoLoadingStatus] = useState<Record<string, boolean>>({});
  const [finalSubmissionComplete, setFinalSubmissionComplete] = useState(false);


  const { stream } = useStream();  // Add this line to get stream from context

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
  console.log("To do the interview vidoes the process.env.REACT_APP_SERVER_BASE_URL is ", process.env.REACT_APP_SERVER_BASE_URL);


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



  useEffect(() => {
    return () => {
      // Clean up streams when component unmounts
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);  // Add stream to dependency array


  // Preload all videos when interview data is fetched
  useEffect(() => {
    const preloadAllVideos = async () => {
      if (introductionVideoData?.data?.attachments?.edges[0]?.node?.fullPath) {
        // const introUrl = `${process.env.REACT_APP_SERVER_BASE_URL}/files/${introductionVideoData.data.attachments.edges[0].node.fullPath}`;
        const introUrl = `${introductionVideoData.data.attachments.edges[0].node.fullPath}`;
        preloadVideo(introUrl);
      }

      // Preload all question videos
      if (questionsVideoData?.length > 0) {
        questionsVideoData.forEach(attachment => {
          if (attachment?.fullPath) {
            // const videoUrl = `${process.env.REACT_APP_SERVER_BASE_URL}/files/${attachment.fullPath}`;
            const videoUrl = `${attachment.fullPath}`;
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
  console.log("This is the interview data::", interviewData);
  const fetchInterviewData = async () => {
    setLoading(true);
    console.log("Going to fetch interview id:", interviewId);
    try {
      const response = await axios.post(`${process.env.REACT_APP_SERVER_BASE_URL}/video-interview/get-interview-details`, { interviewId });
      console.log('This is the response to fetch interview data:', response);
      const responseObj: GetInterviewDetailsResponse = response.data;
      if (responseObj) {



        const fetchedData: any = response?.data?.responseFromInterviewRequests?.data;
        console.log('fetchedData to fetch interview data:', JSON.stringify(fetchedData));
        const formattedData: InterviewData = {
          recruiterProfile: fetchedData.recruiterProfile,
          name: fetchedData?.videoInterviews?.edges[0]?.node?.name || '',
          id: fetchedData?.videoInterviews?.edges[0]?.node?.id || '',
          candidate: {
            id: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.id || '',
            jobs: {
              jobId: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.jobs?.id || '',
              name: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.jobs?.name || '',
              recruiterId: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.jobs?.recruiterId || '',
              companyName: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.jobs?.company?.name || '',
            },
            people: {
              id: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.people?.id || '',
              name: {
                firstName: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.people?.name?.firstName || '',
                lastName: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.people?.name?.lastName || '',
              },
              email: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.people?.emails.primaryEmail || '',
              phone: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.people?.phones.primaryPhoneNumber || '',
            },
          },

          videoInterview: {
            id: fetchedData?.videoInterviews?.edges[0]?.node?.videoInterviewTemplate?.id || '',
            name: fetchedData?.videoInterviews?.edges[0]?.node?.videoInterviewTemplate?.name || '',
            introduction: fetchedData?.videoInterviews?.edges[0]?.node?.videoInterviewTemplate?.introduction || '',
            instructions: fetchedData?.videoInterviews?.edges[0]?.node?.videoInterviewTemplate?.instructions || '',
            videoInterviewQuestions: fetchedData?.videoInterviews?.edges[0]?.node?.videoInterviewTemplate?.videoInterviewQuestions || '',
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
        if (nextIndex === (interviewData?.videoInterview?.videoInterviewQuestions?.edges?.length ?? 0)) {
          setStage('end');
        }
        return nextIndex;
      });
      console.log('This is process.env.REACT_APP_SERVER_BASE_URL:', process.env.REACT_APP_SERVER_BASE_URL);
      const isLastQuestion = currentQuestionIndex === (interviewData?.videoInterview?.videoInterviewQuestions?.edges?.length ?? 0) - 1;
      responseData.append('responseData', JSON.stringify({ isLastQuestion, timeLimitAdherence: responseData.get('timeLimitAdherence') }));


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
      console.log('The calue of interviewData!.videoInterview.videoInterview.edges.length is ::', interviewData!.videoInterview?.videoInterviewQuestions?.edges?.length);
      return true; // Return success status

    } catch (error) {
      console.log('Error submitting response in VideoInterviewFlow:', error);
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

  console.log('This is the interview questions:', interviewData?.videoInterview?.videoInterviewQuestions?.edges);
  const renderCurrentStage = () => {
    if (!interviewData) {
      return (
      <StartInterviewPage onStart={handleStart} InterviewData={emptyInterviewData} introductionVideoData={introductionVideoData!} videoPlaybackState={globalVideoPlaybackState} onVideoStateChange={handleVideoStateChange} />
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
              questions={interviewData?.videoInterview?.videoInterviewQuestions?.edges?.map(edge => edge?.node).sort((a, b) => new Date(a?.createdAt).getTime() - new Date(b?.createdAt).getTime())}
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
          return <EndInterviewPage 
            interviewData={interviewData} 
            onSubmit={handleSubmitFeedback} 
            submissionComplete={finalSubmissionComplete}
          />;
            default:
        return null;
    }
  };


  return (
    <StreamProvider>
      <div>{renderCurrentStage()}</div>
    </StreamProvider>
  );
};

export default VideoInterviewFlow;
