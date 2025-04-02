// src/components/InterviewApp.tsx
import styled from '@emotion/styled';
import StreamingAvatar, {
    AvatarQuality,
    StreamingEvents,
    TaskType,
} from '@heygen/streaming-avatar';
import React, { useEffect, useRef, useState } from 'react';
import { Socket, io } from 'socket.io-client';

import { useTheme } from '@emotion/react';
import { isDefined } from 'twenty-shared';
import { MOBILE_VIEWPORT } from 'twenty-ui';

import { setupChromaKey } from '../services/ChromaKey';
import { InterviewManager } from '../services/InterviewManager';
import { SpeechRecognizer } from '../services/SpeechRecognizer';

// Import types
import '../types/WebSpeech';

// Media query helper
const mq = {
  md: `@media (min-width: ${MOBILE_VIEWPORT}px)`,
};

// Utility debounce function
const debounce = <F extends (...args: any[]) => any>(
  func: F,
  wait: number,
): ((...args: Parameters<F>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>) => {
    if (isDefined(timeout)) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

// Styled components
const StyledAppContainer = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.font.family};
  height: 100%;
  min-height: 100vh;
  overflow: hidden;
  width: 100%;
`;

const StyledHeader = styled.header`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
`;

const StyledLogo = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledMainContent = styled.main`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: ${({ theme }) => theme.spacing(4)};
  gap: ${({ theme }) => theme.spacing(4)};
  height: calc(100vh - 56px);
  overflow: auto;

  ${mq.md} {
    flex-direction: row;
  }
`;

const StyledVideoSection = styled.section`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};

  ${mq.md} {
    margin-bottom: 0;
    margin-right: ${({ theme }) => theme.spacing(4)};
  }
`;

const StyledVideoContainer = styled.div`
  width: 100%;
  max-width: 640px;
  aspect-ratio: 16/9;
  background-color: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  position: relative;
`;

const StyledVideo = styled.video`
  height: 100%;
  object-fit: cover;
  width: 100%;
`;

const StyledCanvas = styled.canvas`
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  top: 0;
  left: 0;
  display: none;
`;

const StyledTranscriptSection = styled.section`
  flex: 1;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  height: 100%;

  ${mq.md} {
    max-width: 400px;
  }
`;

const StyledTranscriptHeader = styled.h2`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledTranscript = styled.div`
  flex: 1;
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(3)};
  overflow-y: auto;
  background-color: ${({ theme }) => theme.background.secondary};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledMessageContainer = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledMessageSender = styled.div<{ isRecruiter: boolean }>`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${(props) =>
    props.isRecruiter
      ? props.theme.color.blue
      : props.theme.font.color.primary};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledMessageContent = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
`;

const StyledStatusBar = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  height: 48px;
`;

const StyledStatusIndicator = styled.div<{ isActive: boolean }>`
  align-items: center;
  display: flex;

  &::before {
    background-color: ${(props) =>
      props.isActive ? props.theme.color.green : props.theme.color.red};
    border-radius: 50%;
    content: '';
    display: inline-block;
    height: 10px;
    margin-right: ${({ theme }) => theme.spacing(2)};
    width: 10px;
  }
`;

const StyledControlsContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledButton = styled.button`
  background-color: ${({ theme }) => theme.color.blue};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: background-color 0.2s ease;
  height: 36px;
  min-width: 120px;

  &:hover {
    background-color: ${({ theme }) => theme.color.blue70};
  }

  &:disabled {
    background-color: ${({ theme }) => theme.grayScale.gray40};
    cursor: not-allowed;
  }
`;

const StyledChromaKeyToggle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(2)};
`;

const StyledCheckbox = styled.input`
  margin: 0;
`;

const StyledCheckboxLabel = styled.label`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledCurrentQuestion = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  font-style: italic;
  margin-top: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledErrorOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: ${({ theme }) =>
    `${theme.background.transparent.secondary}e6`};
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: ${({ theme }) => theme.spacing(4)};
  gap: ${({ theme }) => theme.spacing(3)};
  z-index: 10;
`;

const StyledErrorMessage = styled.div`
  color: ${({ theme }) => theme.font.color.light};
  font-size: ${({ theme }) => theme.font.size.md};
  text-align: center;
  max-width: 80%;
`;

const StyledRetryButton = styled.button`
  background-color: ${({ theme }) => theme.color.blue};
  color: white;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(3)};
  font-family: ${({ theme }) => theme.font.family};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.color.blue70};
  }
`;

const StyledEmptyState = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.light};
  display: flex;
  font-style: italic;
  height: 100%;
  justify-content: center;
  text-align: center;
`;

// Interface for transcript messages
interface Message {
  id: string;
  sender: 'recruiter' | 'candidate';
  content: string;
  timestamp: Date;
}

const ArxInterview: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState('Ready to start interview');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const theme = useTheme();

  // Avatar and video elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [avatar, setAvatar] = useState<StreamingAvatar | null>(null);

  // Interview state
  const [interviewManager, setInterviewManager] =
    useState<InterviewManager | null>(null);
  const [speechRecognizer, setSpeechRecognizer] =
    useState<SpeechRecognizer | null>(null);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);
  const [isCandidateSpeaking, setIsCandidateSpeaking] = useState(false);
  const [chromaKeyEnabled, setChromaKeyEnabled] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [stopChromaKeyProcessing, setStopChromaKeyProcessing] = useState<
    (() => void) | null
  >(null);

  // Connect to WebSocket server on component mount
  useEffect(() => {
    const serverUrl =
      process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:3000';
    setStatus(`Connecting to ${serverUrl}...`);

    try {
      // Configure Socket.IO client with proper options
      const newSocket = io(serverUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        setStatus('Ready to start interview');
        setConnectionError(null);
        console.log('Socket connected successfully');
      });

      newSocket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
        setStatus(`Connection error: ${err.message}`);
        setConnectionError(
          `Failed to connect to ${serverUrl}. Make sure the server is running and the ArxInterviewsModule is properly configured.`,
        );
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setIsConnected(false);
        setStatus(`Disconnected: ${reason}`);
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } catch (error) {
      console.error('Error setting up socket:', error);
      setStatus('Connection failed');
      setConnectionError('Failed to initialize socket connection');
    }
  }, []);

  // Fetch avatar token
  const fetchAvatarToken = async (): Promise<string> => {
    try {
      if (isDefined(socket)) {
        return new Promise((resolve, reject) => {
          socket.emit('get-avatar-token');

          const timeoutId = setTimeout(() => {
            reject(new Error('Token request timed out'));
          }, 10000);

          socket.once('avatar-token', (token: string) => {
            clearTimeout(timeoutId);
            console.log('Received avatar token');
            resolve(token);
          });

          socket.once('token-error', (error: string) => {
            clearTimeout(timeoutId);
            console.error('Token error:', error);
            reject(new Error(error));
          });
        });
      }

      throw new Error('Socket not connected');
    } catch (error) {
      console.error('Error fetching avatar token:', error);
      throw error;
    }
  };

  // Initialize the avatar session
  const initializeAvatarSession = async () => {
    try {
      setStatus('Initializing interview session...');

      // Initialize OpenAI interview manager
      const openAIKey = process.env.REACT_APP_OPENAI_API_KEY;
      if (!openAIKey) {
        throw new Error('OpenAI API key not found');
      }

      const manager = new InterviewManager(openAIKey);
      await manager.generateInitialQuestions('Software Developer');
      setInterviewManager(manager);

      // Get current question
      const firstQuestion = manager.getCurrentQuestion();
      setCurrentQuestion(firstQuestion);

      // Get avatar token
      const token = await fetchAvatarToken();
      if (!token) {
        throw new Error('Failed to get avatar token');
      }

      // Create avatar instance
      const avatarInstance = new StreamingAvatar({ token });
      if (!avatarInstance) {
        throw new Error('Failed to create avatar instance');
      }

      // Set up avatar event handlers
      avatarInstance.on(StreamingEvents.STREAM_READY, handleStreamReady);
      avatarInstance.on(
        StreamingEvents.STREAM_DISCONNECTED,
        handleStreamDisconnected,
      );
      avatarInstance.on(
        StreamingEvents.AVATAR_START_TALKING,
        handleAvatarStartTalking,
      );
      avatarInstance.on(
        StreamingEvents.AVATAR_STOP_TALKING,
        handleAvatarStopTalking,
      );

      // Create avatar session
      const sessionData = await avatarInstance.createStartAvatar({
        quality: AvatarQuality.High,
        avatarName: 'default', // Use your preferred avatar
        disableIdleTimeout: true,
        language: 'en',
      });

      setAvatar(avatarInstance);
      setIsSessionActive(true);
      setStatus('Avatar session started');
    } catch (error) {
      console.error('Error initializing avatar:', error);
      setStatus('Error initializing avatar');
    }
  };

  // Handle when avatar stream is ready
  const handleStreamReady = (event: any) => {
    if (isDefined(videoRef.current) && isDefined(event.detail)) {
      videoRef.current.srcObject = event.detail;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch((error) => {
          console.error('Error playing video:', error);
          setStatus('Error playing video');
        });

        // Apply chroma key if enabled
        updateChromaKeyState();
      };
      setStatus('Avatar stream ready');

      // Start the interview
      startInterview();
    }
  };

  // Start the interview
  const startInterview = async () => {
    if (!avatar || !interviewManager) return;

    setStatus('Starting interview...');

    // Get the first question
    const firstQuestion = interviewManager.getCurrentQuestion();
    setCurrentQuestion(firstQuestion);

    try {
      await avatar.speak({
        text: firstQuestion,
        task_type: TaskType.REPEAT,
      });
    } catch (error) {
      console.error('Error having avatar speak:', error);
      setStatus('Error starting interview');
    }
  };

  // Handle candidate speech events
  const handleCandidateStartSpeaking = () => {
    setIsCandidateSpeaking(true);
    setStatus('Listening to candidate...');
  };

  const handleCandidateStopSpeaking = async (transcript: string) => {
    setIsCandidateSpeaking(false);
    setStatus('Processing response...');

    if (!transcript || transcript.trim() === '') {
      setStatus('No speech detected. Please try again.');

      // Restart speech recognition
      if (isDefined(speechRecognizer)) {
        speechRecognizer.stop();
        setSpeechRecognizer(null);
      }

      const newRecognizer = new SpeechRecognizer(
        handleCandidateStartSpeaking,
        handleCandidateStopSpeaking,
        handleInterimSpeechResult,
      );

      setSpeechRecognizer(newRecognizer);
      newRecognizer.start();

      return;
    }

    // Process the response and get the next question/response
    if (isDefined(interviewManager) && isDefined(avatar)) {
      try {
        const response = await interviewManager.getNextQuestion(transcript);

        // Update current question
        setCurrentQuestion(interviewManager.getCurrentQuestion());

        await avatar.speak({
          text: response,
          task_type: TaskType.REPEAT,
        });
      } catch (error) {
        console.error('Error processing response:', error);
        setStatus('Error processing response');
      }
    }
  };

  const handleInterimSpeechResult = (interimTranscript: string) => {
    // Optionally show interim transcripts
  };

  // Avatar speaking event handlers
  const handleAvatarStartTalking = () => {
    setIsAvatarSpeaking(true);
    setStatus('Avatar is speaking...');

    // Stop speech recognition while avatar is speaking
    if (isDefined(speechRecognizer)) {
      speechRecognizer.stop();
      setSpeechRecognizer(null);
    }
  };

  const handleAvatarStopTalking = () => {
    setIsAvatarSpeaking(false);
    setStatus('Waiting for your response...');

    // Start speech recognition when avatar stops speaking
    setTimeout(() => {
      if (!isCandidateSpeaking && !isAvatarSpeaking) {
        const newRecognizer = new SpeechRecognizer(
          handleCandidateStartSpeaking,
          handleCandidateStopSpeaking,
          handleInterimSpeechResult,
        );

        setSpeechRecognizer(newRecognizer);
        newRecognizer.start();
      }
    }, 500);
  };

  // Handle stream disconnection
  const handleStreamDisconnected = () => {
    setStatus('Avatar stream disconnected');
    endInterview();
  };

  // End the interview
  const endInterview = async () => {
    // Stop speech recognition
    if (isDefined(speechRecognizer)) {
      speechRecognizer.stop();
      setSpeechRecognizer(null);
    }

    // Stop avatar session
    if (isDefined(avatar)) {
      await avatar.stopAvatar();
      setAvatar(null);
    }

    // Reset video
    if (isDefined(videoRef.current)) {
      videoRef.current.srcObject = null;
    }

    // Stop chroma key processing
    if (isDefined(stopChromaKeyProcessing)) {
      stopChromaKeyProcessing();
      setStopChromaKeyProcessing(null);
    }

    // Reset state
    setIsSessionActive(false);
    setStatus('Interview ended');
    setCurrentQuestion('');
  };

  // Toggle chroma key effect
  const updateChromaKeyState = () => {
    if (!videoRef.current?.srcObject) return;

    // Stop any existing chroma key processing
    if (isDefined(stopChromaKeyProcessing)) {
      stopChromaKeyProcessing();
      setStopChromaKeyProcessing(null);
    }

    if (chromaKeyEnabled && isDefined(canvasRef.current)) {
      // Show canvas, hide video
      if (isDefined(canvasRef.current))
        canvasRef.current.style.display = 'block';
      if (isDefined(videoRef.current)) videoRef.current.style.display = 'none';

      // Start chroma key processing
      const stopFn = setupChromaKey(videoRef.current, canvasRef.current, {
        minHue: 60,
        maxHue: 180,
        minSaturation: 0.1,
        threshold: 1.0,
      });

      setStopChromaKeyProcessing(() => stopFn);
    } else {
      // Show video, hide canvas
      if (isDefined(videoRef.current)) videoRef.current.style.display = 'block';
      if (isDefined(canvasRef.current))
        canvasRef.current.style.display = 'none';
    }
  };

  // Handle chroma key toggle
  const handleChromaKeyToggle = () => {
    setChromaKeyEnabled(!chromaKeyEnabled);
  };

  // Effect to update chroma key when toggle changes
  useEffect(() => {
    updateChromaKeyState();
  }, [chromaKeyEnabled]);

  return (
    <StyledAppContainer>
      <StyledHeader>
        <StyledLogo>AI Interviewer</StyledLogo>
      </StyledHeader>

      <StyledMainContent>
        <StyledVideoSection>
          <StyledVideoContainer>
            <StyledVideo ref={videoRef} autoPlay playsInline />
            <StyledCanvas ref={canvasRef} />
            {connectionError && (
              <StyledErrorOverlay>
                <StyledErrorMessage>{connectionError}</StyledErrorMessage>
                <StyledRetryButton onClick={() => window.location.reload()}>
                  Retry Connection
                </StyledRetryButton>
              </StyledErrorOverlay>
            )}
          </StyledVideoContainer>

          <StyledStatusBar>
            <StyledStatusIndicator
              isActive={isCandidateSpeaking || isAvatarSpeaking}
            >
              {isCandidateSpeaking
                ? 'Listening...'
                : isAvatarSpeaking
                  ? 'Avatar Speaking...'
                  : 'Ready'}
            </StyledStatusIndicator>
            <div>{status}</div>
          </StyledStatusBar>

          <StyledControlsContainer>
            <StyledButton
              onClick={initializeAvatarSession}
              disabled={!isConnected || isSessionActive}
            >
              Start Interview
            </StyledButton>
            <StyledButton onClick={endInterview} disabled={!isSessionActive}>
              End Interview
            </StyledButton>
          </StyledControlsContainer>

          <StyledChromaKeyToggle>
            <StyledCheckbox
              type="checkbox"
              id="chromaKeyToggle"
              checked={chromaKeyEnabled}
              onChange={handleChromaKeyToggle}
            />
            <StyledCheckboxLabel htmlFor="chromaKeyToggle">
              Remove Background
            </StyledCheckboxLabel>
          </StyledChromaKeyToggle>

          {currentQuestion && (
            <StyledCurrentQuestion>{currentQuestion}</StyledCurrentQuestion>
          )}
        </StyledVideoSection>
      </StyledMainContent>
    </StyledAppContainer>
  );
};

export default ArxInterview;
