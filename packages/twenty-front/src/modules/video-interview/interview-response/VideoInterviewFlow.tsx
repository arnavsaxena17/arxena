import { styled } from '@linaria/react';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { EndInterviewPage } from './EndInterviewPage';
import { ErrorBoundary } from './ErrorBoundary'; // Import the ErrorBoundary component
import { StartInterviewPage } from './StartInterviewPage';
import { InterviewPage } from './components/InterviewPage';

import { emptyInterviewData, type GetInterviewDetailsResponse, type InterviewData, type VideoInterviewAttachment } from 'twenty-shared/arx';
import { getAttachmentDownloadUrl } from 'twenty-shared/utils';
import { StreamProvider, useStream } from '../StreamManager';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const LoaderOverlay = styled.div`
  align-items: center;
  backdrop-filter: blur(4px);
  background-color: rgba(0, 0, 0, 0.5);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  position: fixed;
  right: 0;
  top: 0;
  z-index: 1000;
`;

const LoaderCard = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border-radius: 8px;
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 32px;
`;

const SpinnerContainer = styled.div`
  height: 48px;
  position: relative;
  width: 48px;
`;

const Spinner = styled.div`
  animation: spin 1s linear infinite;
  border: 4px solid #f3f3f3;
  border-radius: 50%;
  border-top: 4px solid #3498db;
  height: 100%;
  width: 100%;
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
  color: #333;
  font-size: 18px;
  font-weight: 500;
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
  console.log("To do the interview vidoes the REACT_APP_SERVER_BASE_URL is ", REACT_APP_SERVER_BASE_URL);


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
      const introAttachment =
        introductionVideoData?.data?.attachments?.edges[0]?.node;
      const introDownloadUrl = getAttachmentDownloadUrl(introAttachment);

      if (introDownloadUrl) {
        const introUrl = introDownloadUrl.startsWith('http')
          ? introDownloadUrl
          : `${REACT_APP_SERVER_BASE_URL}/files/${introDownloadUrl}`;
        preloadVideo(introUrl);
      }

      if (questionsVideoData?.length > 0) {
        questionsVideoData.forEach((attachment) => {
          const attachmentDownloadUrl = getAttachmentDownloadUrl(attachment);

          if (attachmentDownloadUrl) {
            const videoUrl = attachmentDownloadUrl.startsWith('http')
              ? attachmentDownloadUrl
              : `${REACT_APP_SERVER_BASE_URL}/files/${attachmentDownloadUrl}`;
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
      const response = await axios.post(`${REACT_APP_SERVER_BASE_URL}/video-interview-controller/get-interview-details`, { interviewId });
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
            projects: {
              id: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.projects?.id || '',
              name: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.projects?.name || '',
              recruiterId: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.projects?.recruiterId || '',
              companyName: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.projects?.company?.name || '',
            },
            peopleId: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.peopleId || '',
            name: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.name || '',
            email: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.email?.primaryEmail || '',
            phoneNumber: {primaryPhoneNumber: fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.phoneNumber?.primaryPhoneNumber || ''},
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
      console.log('This is REACT_APP_SERVER_BASE_URL:', REACT_APP_SERVER_BASE_URL);
      const isLastQuestion = currentQuestionIndex === (interviewData?.videoInterview?.videoInterviewQuestions?.edges?.length ?? 0) - 1;

      responseData.append('responseData', JSON.stringify({
        isLastQuestion,
        timeLimitAdherence: responseData.get('timeLimitAdherence') // preserve any existing data
      }));


      // console.log('This is the appending of the rinterview dat:', interviewData);
      responseData.append('interviewData', JSON.stringify(interviewData));
      responseData.append('currentQuestionIndex', currentQuestionIndex.toString());
      responseData.forEach((value, key) => {
        console.log('key for response data:', key, '::', value);
      });
      // console.log("Final resposne data being setnt:", responseData)
      const response = await axios.post(REACT_APP_SERVER_BASE_URL + '/video-interview-controller/submit-response', responseData, {
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
      const response = await axios.post(`${REACT_APP_SERVER_BASE_URL}/video-interview-controller/update-feedback`, { interviewId, feedback });
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
      <StartInterviewPage
        onStart={handleStart}
        InterviewData={emptyInterviewData}
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
