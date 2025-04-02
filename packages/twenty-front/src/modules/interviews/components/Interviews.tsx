import styled from '@emotion/styled';
// import AgoraRTC from 'agora-rtc-sdk-ng';
import { IAgoraRTC } from 'agora-rtc-sdk-ng';
// import AgoraRTC from 'agora-rtc-sdk-ng';
// import AgoraRTC from 'agora-rtc-sdk-ng';
import { useEffect, useRef, useState } from 'react';
import { isDefined } from 'twenty-shared';

// Styled components
const StyledPageContainer = styled.div`
  font-family: Arial, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing(5)};
`;

const StyledPageTitle = styled.h1`
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const StyledSection = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  margin-bottom: ${({ theme }) => theme.spacing(5)};
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledSectionTitle = styled.h2`
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledSelect = styled.select`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

const StyledTextArea = styled.textarea`
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  min-height: 100px;
  padding: ${({ theme }) => theme.spacing(2)};
  width: 100%;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

const StyledButton = styled.button`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  margin: ${({ theme }) => theme.spacing(1)};
  background-color: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.font.color.inverted};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  font-weight: ${({ theme }) => theme.font.weight.medium};

  &:hover {
    background-color: ${({ theme }) => theme.color.blue10};
  }

  &:disabled {
    background-color: ${({ theme }) => theme.color.gray};
    cursor: not-allowed;
  }
`;

const StyledVideoContainer = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  height: 300px;
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  overflow: hidden;
  position: relative;
  width: 100%;

  .agora-video-player {
    height: 200% !important;
    left: 0;
    object-fit: cover !important;
    position: absolute !important;
    top: -180px;
    width: 100% !important;
  }
`;

const StyledMessagesContainer = styled.div`
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  height: 200px;
  margin-top: ${({ theme }) => theme.spacing(5)};
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledMessage = styled.p<{ isSystem?: boolean; isResponse?: boolean }>`
  color: ${({ isSystem, isResponse, theme }) =>
    isSystem
      ? theme.color.gray
      : isResponse
        ? theme.color.blue
        : theme.font.color.primary};
  font-style: ${({ isSystem }) => (isSystem ? 'italic' : 'normal')};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

// Types
type Avatar = {
  _id: string;
  name: string;
};

type SessionData = {
  channel: string;
  token: string;
  appId: string;
  uid: string;
};

// Main component
const Interview = () => {
  // State

  const [agoraSDK, setAgoraSDK] = useState<IAgoraRTC | null>(null);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState('');
  const [context, setContext] = useState('');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<
    Array<{ sender: string; text: string; isResponse?: boolean }>
  >([]);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isJoined, setIsJoined] = useState(false);

  // Refs
  // eslint-disable-next-line @nx/workspace-no-state-useref
  const agoraClientRef = useRef<any>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Base URL for API calls based on environment
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://arxena.com'
      : 'http://localhost:5050';

  // Effects
  useEffect(() => {
    import('agora-rtc-sdk-ng')
      .then((module) => {
        setAgoraSDK(module.default);
        console.log('Agora SDK loaded successfully');
      })
      .catch((err) => console.error('Failed to load Agora SDK:', err));

    // Fetch available avatars
    fetchAvatars();

    // Clean up when component unmounts
    return () => {
      if (isDefined(sessionData?.channel)) {
        fetch(`${baseUrl}/api/session/close`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: sessionData.channel,
          }),
        }).catch(console.error);
      }

      if (isDefined(agoraClientRef.current)) {
        try {
          agoraClientRef.current.leave();
        } catch (error) {
          console.error('Error leaving Agora room:', error);
        }
      }
    };
  }, []);

  useEffect(() => {
    // Auto-scroll messages container to bottom when messages change
    if (isDefined(messagesContainerRef.current)) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Functions
  const fetchAvatars = async () => {
    try {
      const response = await fetch(`${baseUrl}/api/avatars`);
      const data = await response.json();
      const isValidAvatarData =
        data.code === 0 && data.data && Array.isArray(data.data);

      if (isDefined(isValidAvatarData)) {
        setAvatars(data.data);
      } else {
        addMessage('System', 'Failed to load avatars.');
      }
    } catch (error) {
      console.error('Error fetching avatars:', error);
      addMessage(
        'System',
        'Failed to load avatars. Check console for details.',
      );
    }
  };

  const createSession = async (retryCount = 0, maxRetries = 3) => {
    if (!selectedAvatarId) {
      addMessage('System', 'Please select an avatar first.');
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/session/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatar_id: selectedAvatarId,
          expire_seconds: 300, // 5 minutes
        }),
      });

      const data = await response.json();
      const isValidSessionData = data.code === 0 && data.data;

      if (isDefined(isValidSessionData)) {
        const newSessionData = {
          channel: data.data.channel,
          token: data.data.token,
          appId: data.data.appId,
          uid: data.data.uid,
        };

        setSessionData(newSessionData);
        addMessage(
          'System',
          `Session created! Channel: ${newSessionData.channel}`,
        );
      } else if (data.code === 1001 && retryCount < maxRetries) {
        // Server busy - retry with backoff
        const waitTime = 15 * (retryCount + 1); // 15s, 30s, 45s
        addMessage(
          'System',
          `Servers busy. Retrying in ${waitTime} seconds...`,
        );

        setTimeout(() => {
          createSession(retryCount + 1, maxRetries);
        }, waitTime * 1000);
      } else {
        addMessage(
          'System',
          'Failed to create session: ' + JSON.stringify(data),
        );
      }
    } catch (error) {
      console.error('Error creating session:', error);
      addMessage(
        'System',
        'Error creating session. Check console for details.',
      );
    }
  };

  const setAvatarContext = async () => {
    if (!context) {
      addMessage('System', 'Please enter context information.');
      return;
    }

    if (!sessionData?.channel) {
      addMessage('System', 'No active session. Please create a session first.');
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/api/session/set-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: sessionData.channel,
          context: context,
        }),
      });

      const data = await response.json();

      if (data.code === 0) {
        addMessage('System', 'Context set successfully!');
      } else {
        addMessage('System', 'Failed to set context: ' + JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error setting context:', error);
      addMessage('System', 'Error setting context. Check console for details.');
    }
  };

  const joinAgoraRoom = async () => {
    if (!sessionData) {
      addMessage(
        'System',
        'Missing session information. Please create a session first.',
      );
      return;
    }

    try {
      // Initialize Agora client
      agoraClientRef.current = agoraSDK?.createClient({
        mode: 'live',
        codec: 'vp8',
      });

      // Set client role as audience
      agoraClientRef.current.setClientRole('audience');

      // Set up event listeners
      agoraClientRef.current.on('user-published', handleUserPublished);
      agoraClientRef.current.on('user-unpublished', handleUserUnpublished);
      agoraClientRef.current.on('stream-message', handleStreamMessage);

      // Join the channel
      await agoraClientRef.current.join(
        sessionData.appId,
        sessionData.channel,
        sessionData.token,
        sessionData.uid,
      );

      setIsJoined(true);
      addMessage('System', 'Joined Agora room successfully!');
    } catch (error) {
      console.error('Error joining Agora room:', error);
      addMessage(
        'System',
        'Failed to join Agora room: ' + (error as Error).message,
      );
    }
  };

  const leaveAgoraRoom = async () => {
    if (!agoraClientRef.current) {
      addMessage('System', 'No active Agora client.');
      return;
    }

    try {
      // Leave the channel
      await agoraClientRef.current.leave();

      // Also notify the server to release resources
      if (isDefined(sessionData?.channel)) {
        await fetch(`${baseUrl}/api/session/close`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channel: sessionData.channel,
          }),
        });
      }

      setIsJoined(false);
      addMessage('System', 'Left Agora room and released resources.');

      // Reset video container
      if (isDefined(videoContainerRef.current)) {
        videoContainerRef.current.innerHTML = '';
      }

      // Reset client ref
      agoraClientRef.current = null;
    } catch (error) {
      console.error('Error leaving Agora room:', error);
      addMessage('System', 'Error leaving room: ' + (error as Error).message);
    }
  };

  const askQuestion = async () => {
    if (!question) {
      addMessage('System', 'Please enter a question.');
      return;
    }

    if (!sessionData?.channel) {
      addMessage('System', 'No active session. Please create a session first.');
      return;
    }

    addMessage('You', question);

    try {
      const response = await fetch(`${baseUrl}/api/session/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: sessionData.channel,
          question: question,
        }),
      });

      const data = await response.json();

      if (data.code !== 0) {
        addMessage(
          'System',
          'Failed to send question: ' + JSON.stringify(data),
        );
      }
      // The actual response will come through Agora stream messaging
    } catch (error) {
      console.error('Error asking question:', error);
      addMessage('System', 'Error asking question. Check console for details.');
    }

    setQuestion('');
  };

  const speakDirectly = async () => {
    if (!question) {
      addMessage('System', 'Please enter text for the avatar to speak.');
      return;
    }

    if (!sessionData?.channel) {
      addMessage('System', 'No active session. Please create a session first.');
      return;
    }

    addMessage('You (Direct)', question);

    try {
      const response = await fetch(`${baseUrl}/api/session/speak`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: sessionData.channel,
          text: question,
        }),
      });

      const data = await response.json();

      if (data.code !== 0) {
        addMessage('System', 'Failed to send text: ' + JSON.stringify(data));
      }
    } catch (error) {
      console.error('Error with direct speak:', error);
      addMessage(
        'System',
        'Error with direct speak. Check console for details.',
      );
    }

    setQuestion('');
  };

  // Agora handlers
  const handleUserPublished = async (user: any, mediaType: string) => {
    // Subscribe to the remote user
    await agoraClientRef.current.subscribe(user, mediaType);

    // If video is published
    if (mediaType === 'video' && isDefined(videoContainerRef.current)) {
      const remoteVideoTrack = user.videoTrack;
      // Play the video in our container
      remoteVideoTrack.play(videoContainerRef.current, { fit: 'contain' });
      addMessage('System', `Avatar video connected (${user.uid})`);
    }

    // If audio is published
    if (mediaType === 'audio') {
      const remoteAudioTrack = user.audioTrack;
      remoteAudioTrack.play();
      addMessage('System', `Avatar audio connected (${user.uid})`);
    }
  };

  const handleUserUnpublished = (user: any) => {
    addMessage('System', `Avatar disconnected (${user.uid})`);
  };

  const handleStreamMessage = (uid: string, message: any) => {
    try {
      // Decode the message
      const decodedMessage = new TextDecoder().decode(message);
      const data = JSON.parse(decodedMessage);

      if (data.type === 'QA') {
        // Handle QA responses
        const position = data.pos || '';
        const messageText = data.message || '';

        if (position === 'start') {
          addMessage('Avatar', messageText, true);
        } else if (position === 'middle' || position === 'end') {
          // Update the last message
          setMessages((prevMessages) => {
            const newMessages = [...prevMessages];
            const lastMessageIndex = newMessages.findIndex(
              (msg) => msg.sender === 'Avatar' && msg.isResponse,
            );

            if (lastMessageIndex !== -1) {
              newMessages[lastMessageIndex] = {
                ...newMessages[lastMessageIndex],
                text: newMessages[lastMessageIndex].text + ' ' + messageText,
              };
            } else {
              newMessages.push({
                sender: 'Avatar',
                text: messageText,
                isResponse: true,
              });
            }

            return newMessages;
          });
        } else {
          addMessage('Avatar', messageText, true);
        }
      }
    } catch (error) {
      console.error('Error handling stream message:', error);
    }
  };

  const addMessage = (sender: string, text: string, isResponse = false) => {
    setMessages((prev) => [...prev, { sender, text, isResponse }]);
  };

  return (
    <StyledPageContainer>
      <StyledPageTitle>A2E Avatar Interface</StyledPageTitle>

      <StyledSection>
        <StyledSectionTitle>Step 1: Choose an Avatar</StyledSectionTitle>
        <StyledSelect
          value={selectedAvatarId}
          onChange={(e) => setSelectedAvatarId(e.target.value)}
        >
          <option value="">Select an avatar...</option>
          {avatars.map((avatar) => (
            <option key={avatar._id} value={avatar._id}>
              {avatar.name}
            </option>
          ))}
        </StyledSelect>
        <StyledButton
          onClick={() => createSession()}
          disabled={!selectedAvatarId}
        >
          Create Session
        </StyledButton>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>
          Step 2: Set Context for the Avatar
        </StyledSectionTitle>
        <StyledTextArea
          placeholder="Enter context information for the avatar..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
        <StyledButton
          onClick={setAvatarContext}
          disabled={!sessionData || !context}
        >
          Set Context
        </StyledButton>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Step 3: Avatar Video</StyledSectionTitle>
        <StyledVideoContainer ref={videoContainerRef} />
        <StyledButton
          onClick={joinAgoraRoom}
          disabled={!sessionData || isJoined}
        >
          Join Agora Room
        </StyledButton>
        <StyledButton onClick={leaveAgoraRoom} disabled={!isJoined}>
          Leave Room
        </StyledButton>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Step 4: Interact with Avatar</StyledSectionTitle>
        <StyledInput
          type="text"
          placeholder="Ask a question or enter text for the avatar to speak..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <StyledButton onClick={askQuestion} disabled={!isJoined || !question}>
          Ask Question
        </StyledButton>
        <StyledButton onClick={speakDirectly} disabled={!isJoined || !question}>
          Speak Directly
        </StyledButton>

        <h3>Avatar Responses:</h3>
        <StyledMessagesContainer ref={messagesContainerRef}>
          {messages.map((message, index) => (
            <StyledMessage
              key={index}
              isSystem={message.sender === 'System'}
              isResponse={message.isResponse}
            >
              <strong>{message.sender}:</strong> {message.text}
            </StyledMessage>
          ))}
        </StyledMessagesContainer>
      </StyledSection>
    </StyledPageContainer>
  );
};

export default Interview;
