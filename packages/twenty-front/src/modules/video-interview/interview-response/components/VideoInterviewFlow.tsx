import styled from '@emotion/styled';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { EndInterviewPage } from '../EndInterviewPage';
import { ErrorBoundary } from '../ErrorBoundary';
import { InterviewPage } from '../InterviewPage';
import { StartInterviewPage } from '../StartInterviewPage';

import {
  GetInterviewDetailsResponse,
  InterviewData,
  VideoInterviewAttachment,
  emptyInterviewData,
} from 'twenty-shared';
import { StreamProvider, useStream } from '../StreamManager';

const StyledLoaderOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${({ theme }) => theme.background.transparent.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  z-index: 1000;
`;

const StyledLoaderCard = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  padding: ${({ theme }) => theme.spacing(8)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(4)};
`;

const StyledSpinnerContainer = styled.div`
  height: ${({ theme }) => theme.spacing(12)};
  position: relative;
  width: ${({ theme }) => theme.spacing(12)};
`;

const StyledSpinner = styled.div`
  width: 100%;
  height: 100%;
  border: 4px solid ${({ theme }) => theme.border.color.light};
  border-top: 4px solid ${({ theme }) => theme.color.blue};
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

const StyledLoaderText = styled.p`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const InterviewLoader = () => (
  <StyledLoaderOverlay>
    <StyledLoaderCard>
      <StyledSpinnerContainer>
        <StyledSpinner />
      </StyledSpinnerContainer>
      <StyledLoaderText>Preparing your interview...</StyledLoaderText>
    </StyledLoaderCard>
  </StyledLoaderOverlay>
);

const VideoInterviewFlow: React.FC<{ interviewId: string }> = ({
  interviewId,
}) => {
  const [stage, setStage] = useState<'start' | 'interview' | 'end'>('start');
  const [loading, setLoading] = useState(false);
  const [interviewData, setInterviewData] = useState<InterviewData | null>(
    null,
  );
  const [introductionVideoData, setIntroductionVideoData] =
    useState<VideoInterviewAttachment | null>(null);
  const [questionsVideoData, setQuestionsVideoData] = useState<
    VideoInterviewAttachment[]
  >([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [videoLoadingStatus, setVideoLoadingStatus] = useState<
    Record<string, boolean>
  >({});
  const [finalSubmissionComplete, setFinalSubmissionComplete] = useState(false);

  const { stream } = useStream();

  const [globalVideoPlaybackState, setGlobalVideoPlaybackState] = useState({
    isPlaying: false,
    isMuted: false,
  });

  const handleVideoStateChange = (newState: {
    isPlaying: boolean;
    isMuted: boolean;
  }) => {
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
        setVideoLoadingStatus((prev) => ({
          ...prev,
          [url]: true,
        }));
        resolve(true);
      };

      video.load();
    });
  };

  useEffect(() => {
    return () => {
      if (stream !== null && stream !== undefined) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Preload all videos when interview data is fetched
  useEffect(() => {
    const preloadAllVideos = async () => {
      const introPath =
        introductionVideoData?.data?.attachments?.edges[0]?.node?.fullPath;
      if (introPath !== null && introPath !== undefined) {
        const introUrl = `${process.env.REACT_APP_SERVER_BASE_URL}/files/${introPath}`;
        preloadVideo(introUrl);
      }

      // Preload all question videos
      if (questionsVideoData?.length > 0) {
        questionsVideoData.forEach((attachment) => {
          const fullPath = attachment?.fullPath;
          if (fullPath !== null && fullPath !== undefined) {
            const videoUrl = `${process.env.REACT_APP_SERVER_BASE_URL}/files/${fullPath}`;
            preloadVideo(videoUrl);
          }
        });
      }
    };

    if (interviewData !== null && interviewData !== undefined) {
      setLoading(true);
      preloadAllVideos().finally(() => {
        setLoading(false);
      });
    }
  }, [interviewData, introductionVideoData, questionsVideoData]);

  const fetchInterviewData = async () => {
    setLoading(true);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/video-interview-controller/get-interview-details`,
        { interviewId },
      );

      const responseObj: GetInterviewDetailsResponse = response.data;
      if (responseObj !== null && responseObj !== undefined) {
        const fetchedData: any =
          response?.data?.responseFromInterviewRequests?.data;

        const formattedData: InterviewData = {
          recruiterProfile: fetchedData.recruiterProfile,
          name: fetchedData?.videoInterviews?.edges[0]?.node?.name || '',
          id: fetchedData?.videoInterviews?.edges[0]?.node?.id || '',
          candidate: {
            id:
              fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.id || '',
            jobs: {
              id:
                fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.jobs
                  ?.id || '',
              name:
                fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.jobs
                  ?.name || '',
              recruiterId:
                fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.jobs
                  ?.recruiterId || '',
              companyName:
                fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.jobs
                  ?.company?.name || '',
            },
            people: {
              id:
                fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.people
                  ?.id || '',
              name: {
                firstName:
                  fetchedData?.videoInterviews?.edges[0]?.node?.candidate
                    ?.people?.name?.firstName || '',
                lastName:
                  fetchedData?.videoInterviews?.edges[0]?.node?.candidate
                    ?.people?.name?.lastName || '',
              },
              email:
                fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.people
                  ?.emails.primaryEmail || '',
              phone:
                fetchedData?.videoInterviews?.edges[0]?.node?.candidate?.people
                  ?.phones.primaryPhoneNumber || '',
            },
          },

          videoInterview: {
            id:
              fetchedData?.videoInterviews?.edges[0]?.node
                ?.videoInterviewTemplate?.id || '',
            name:
              fetchedData?.videoInterviews?.edges[0]?.node
                ?.videoInterviewTemplate?.name || '',
            introduction:
              fetchedData?.videoInterviews?.edges[0]?.node
                ?.videoInterviewTemplate?.introduction || '',
            instructions:
              fetchedData?.videoInterviews?.edges[0]?.node
                ?.videoInterviewTemplate?.instructions || '',
            videoInterviewQuestions:
              fetchedData?.videoInterviews?.edges[0]?.node
                ?.videoInterviewTemplate?.videoInterviewQuestions || '',
          },
        };

        setInterviewData(formattedData);
        setIntroductionVideoData(responseObj?.videoInterviewAttachmentResponse);
        setQuestionsVideoData(
          Array.isArray(responseObj?.questionsAttachments)
            ? responseObj.questionsAttachments
            : [],
        );
      } else {
        console.error('No interview data found');
      }
    } catch (error) {
      console.error('Error fetching interview data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => setStage('interview');

  const handleNextQuestion = async (responseData: FormData) => {
    try {
      setCurrentQuestionIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        if (
          nextIndex ===
          (interviewData?.videoInterview?.videoInterviewQuestions?.edges
            ?.length ?? 0)
        ) {
          setStage('end');
        }
        return nextIndex;
      });

      const isLastQuestion =
        currentQuestionIndex ===
        (interviewData?.videoInterview?.videoInterviewQuestions?.edges
          ?.length ?? 0) -
          1;

      responseData.append(
        'responseData',
        JSON.stringify({
          isLastQuestion,
          timeLimitAdherence: responseData.get('timeLimitAdherence'),
        }),
      );

      responseData.append('interviewData', JSON.stringify(interviewData));
      responseData.append(
        'currentQuestionIndex',
        currentQuestionIndex.toString(),
      );

      const response = await axios.post(
        process.env.REACT_APP_SERVER_BASE_URL +
          '/video-interview-controller/submit-response',
        responseData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );

      if (isLastQuestion) {
        setFinalSubmissionComplete(true);
      }

      return true;
    } catch (error) {
      console.error('Error submitting response in VideoInterviewFlow:', error);
      return false;
    }
  };

  const handleSubmitFeedback = async (feedback: string) => {
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/video-interview-controller/update-feedback`,
        { interviewId, feedback },
      );
      setFinalSubmissionComplete(true);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const handleFinish = () => {
    setStage('end');
  };

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

    if (stage === 'start') {
      return (
        <>
          {introductionVideoData && (
            <StartInterviewPage
              onStart={handleStart}
              InterviewData={interviewData}
              introductionVideoData={introductionVideoData}
              videoPlaybackState={globalVideoPlaybackState}
              onVideoStateChange={handleVideoStateChange}
            />
          )}
          {loading && <InterviewLoader />}
        </>
      );
    }

    if (stage === 'interview') {
      return (
        <ErrorBoundary>
          {loading && <InterviewLoader />}
          <InterviewPage
            InterviewData={interviewData}
            questions={interviewData?.videoInterview?.videoInterviewQuestions?.edges
              ?.map((edge) => edge?.node)
              .sort(
                (a, b) =>
                  new Date(a?.createdAt).getTime() -
                  new Date(b?.createdAt).getTime(),
              )}
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
    }

    if (stage === 'end') {
      return (
        <EndInterviewPage
          interviewData={interviewData}
          onSubmit={handleSubmitFeedback}
          submissionComplete={finalSubmissionComplete}
        />
      );
    }

    return null;
  };

  return (
    <StreamProvider>
      <div>{renderCurrentStage()}</div>
    </StreamProvider>
  );
};

export default VideoInterviewFlow;
