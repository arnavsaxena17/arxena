import React, { useEffect, useRef, useState } from 'react';
import * as InterviewResponseTypes from './types/interviewResponseTypes';
import { VideoPlayer } from './utils/videoPlaybackUtils';
// import {recruiterProfile} from '../../activities/chats/types/front-chat-types';


import { useStream } from '../StreamManager';
import {
  AccessMessage,
  ButtonContainer,
  InstructionList,
  InstructionSection,
  StartInterviewStyledLeftPanel,
  StartInterviewStyledRightPanel,
  StyledButton,
  StyledContainer,
  StyledLeftPanelContentBox,
  StyledTextLeftPanelTextHeadline,
  StyledTextLeftPaneldisplay,
} from './styled-components/StyledComponentsInterviewResponse';

interface StartInterviewPageProps extends InterviewResponseTypes.StartInterviewPageProps {
  videoPlaybackState: { isPlaying: boolean; isMuted: boolean };
  onVideoStateChange: (state: { isPlaying: boolean; isMuted: boolean }) => void;
}

export const StartInterviewPage: React.FC<StartInterviewPageProps> = ({ onStart, InterviewData, introductionVideoData, videoPlaybackState,  onVideoStateChange }) => {


  const { isStreamReady, error } = useStream();

  useEffect(() => {
    if (isStreamReady) {
      setHasAccess(true);
    }
  }, [isStreamReady]);

  const [hasAccess, setHasAccess] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const handlePlaybackChange = (isPlaying: boolean) => {
    onVideoStateChange({
      ...videoPlaybackState,
      isPlaying
    });
  };



    // Preload the introduction video when component mounts
    useEffect(() => {
      if (introductionVideoData?.data?.attachments?.edges[0]?.node?.fullPath) {
        const videoUrl = `${process.env.REACT_APP_SERVER_BASE_URL}/files/${introductionVideoData.data.attachments.edges[0].node.fullPath}`;
        // Create a new video element for preloading
        const preloadVideo = document.createElement('video');
        preloadVideo.src = videoUrl;
        preloadVideo.preload = 'auto';
        // Start loading the video
        preloadVideo.load();
      }
    }, [introductionVideoData]);
  
    // Handle video loading state
    const handleVideoLoadStart = () => {
      setIsVideoLoading(true);
    };

    const handleVideoCanPlay = () => {
      setIsVideoLoading(false);
    };





  // useEffect(() => {
  //   checkMediaAccess();
  // }, []);

  // const checkMediaAccess = async () => {
  //   try {
  //     const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  //     setHasAccess(true);
  //     stream.getTracks().forEach(track => track.stop());
  //   } catch (err) {
  //     setHasAccess(false);
  //   }
  // };

  const requestMediaAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setHasAccess(true);
    } catch (err) {
      console.error('Trying to get media access:', err);
      // alert('Failed to get camera and microphone access. Please check your browser settings and try again.');
    }
  };

  // const recruiterProfile = InterviewData?.candidate?.jobs?

  console.log("This is the intorduction interview data::", introductionVideoData)
  // console.log("This is the intorduction interview data::", introductionVideoData?.data?.attachments?.edges[0]?.node.fullPath)
  const introductionVideoURL = process.env.REACT_APP_SERVER_BASE_URL+"/"+introductionVideoData?.data?.attachments?.edges[0]?.node.fullPath;
  console.log("THis is introductionVideoURL:", introductionVideoURL)
  return (
    <StyledContainer>
    <StartInterviewStyledLeftPanel>
      <h2>{InterviewData?.candidate?.jobs?.name} at {InterviewData?.candidate?.jobs?.companyName}</h2>
      <StyledLeftPanelContentBox>
        <StyledTextLeftPanelTextHeadline>Introduction</StyledTextLeftPanelTextHeadline>
        <VideoPlayer 
          src={`${process.env.REACT_APP_SERVER_BASE_URL}/files/${introductionVideoData?.data?.attachments?.edges[0]?.node?.fullPath}`}
          videoRef={videoRef}
          isPlaying={videoPlaybackState.isPlaying}
          setIsPlaying={handlePlaybackChange}
          isMuted={videoPlaybackState.isMuted}
          onLoadStart={handleVideoLoadStart}
          onCanPlay={handleVideoCanPlay}
        />
        <h3>Transcript</h3>
        <StyledTextLeftPaneldisplay>
        <div dangerouslySetInnerHTML={{ __html: InterviewData?.videoInterview?.introduction.replace(/\n/g, '<br />') }}></div>
        </StyledTextLeftPaneldisplay>
      </StyledLeftPanelContentBox>
    </StartInterviewStyledLeftPanel>
    <StartInterviewStyledRightPanel>
      <InstructionSection>
        <h2>Hi, {InterviewData?.candidate?.people?.name?.firstName} - Applicant for {InterviewData?.candidate?.jobs?.name} at {InterviewData?.candidate?.jobs?.companyName}</h2>
        <br></br>
        <h3>Instructions: Please read this before continuing</h3>
        <InstructionList>
          <li>Sit in a quiet, noise free place and provide your browser access to camera and microphone on your device</li>
          <li>You have to answer {InterviewData?.videoInterview?.videoInterviewQuestions?.edges?.length} questions and have 4 minutes per question.</li>
          <li>Answer all {InterviewData?.videoInterview?.videoInterviewQuestions?.edges?.length} questions in one go. Do not click back, close or refresh the tab to prevent loss of progress.</li>
          <li>Please make sure you have a stable internet connection and use a fully charged device for giving the interview.</li>
          <li>If you need assistance, write to me <a href={`mailto:${InterviewData.recruiterProfile.email}`}>{InterviewData.recruiterProfile.email}</a> or call/ whatsapp at <a href={`tel:${InterviewData.recruiterProfile.phone}`}>{InterviewData.recruiterProfile.phone}</a></li>
        </InstructionList>
      </InstructionSection>
          <ButtonContainer>
            {!hasAccess ? ( <StyledButton onClick={requestMediaAccess}> Give camera and microphone access </StyledButton> ) : ( <AccessMessage>✓ Camera and microphone access granted</AccessMessage> )}
            {hasAccess && ( <StyledButton onClick={onStart}> Start Interview </StyledButton> )}
          </ButtonContainer>
    </StartInterviewStyledRightPanel>
    </StyledContainer>
  ); 
};