import styled from '@emotion/styled';
import StreamingAvatar, {
  AvatarQuality,
  StartAvatarResponse,
  StreamingEvents,
  TaskMode,
  TaskType,
  VoiceEmotion,
} from '@heygen/streaming-avatar';
import { useMemoizedFn, usePrevious } from 'ahooks';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'twenty-ui';
import { Select } from '../../ui/input/components/Select';
import { TextInput } from '../../ui/input/components/TextInput';

import {
  AVATARS,
  STT_LANGUAGE_LIST,
} from '@/heygen/constants/heygen.constants';
import { InteractiveAvatarTextInput } from './InteractiveAvatarTextInput';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  width: 100%;
`;

const StyledCard = styled.div`
  height: 500px;
`;

const StyledCardContent = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
`;

const StyledVideoContainer = styled.div`
  height: 500px;
  width: 900px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  border-radius: ${({ theme }) => theme.border.radius.lg};
  overflow: hidden;
`;

const StyledVideo = styled.video`
  height: 100%;
  object-fit: contain;
  width: 100%;
`;

const StyledButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  position: absolute;
  bottom: ${({ theme }) => theme.spacing(3)};
  right: ${({ theme }) => theme.spacing(3)};
`;

const StyledFormContainer = styled.div`
  align-self: center;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(8)};
  height: 100%;
  justify-content: center;
  width: 500px;
`;

const StyledInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  width: 100%;
`;

const StyledDebugText = styled.p`
  font-family: monospace;
  text-align: right;

  strong {
    font-weight: ${({ theme }) => theme.font.weight.bold};
  }
`;

export const InteractiveAvatar = () => {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [knowledgeId, setKnowledgeId] = useState<string>('');
  const [avatarId, setAvatarId] = useState<string>('June_HR_public');
  const [language, setLanguage] = useState<string>('en');
  const [data, setData] = useState<StartAvatarResponse>();
  const [text, setText] = useState<string>('');
  const [chatMode, setChatMode] = useState('text_mode');
  const [isUserTalking, setIsUserTalking] = useState(false);

  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);

  const baseApiUrl = () => 'https://api.heygen.com';

  const fetchAccessToken = async () => {
    try {
      const response = await fetch('http://127.0.0.1:3000/heygen/token', {
        method: 'POST',
      });
      const token = await response.text();
      return token;
    } catch (error) {
      console.error('Error fetching access token:', error);
      return '';
    }
  };

  const startSession = async () => {
    setIsLoadingSession(true);
    const newToken = await fetchAccessToken();
    const token = JSON.parse(newToken)['token'];
    console.log('newToken', token);
    avatar.current = new StreamingAvatar({
      token,
      basePath: baseApiUrl(),
    });

    avatar.current.on(StreamingEvents.AVATAR_START_TALKING, (e: Event) => {
      console.log('Avatar started talking', e);
    });

    avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, (e: Event) => {
      console.log('Avatar stopped talking', e);
    });

    avatar.current.on(StreamingEvents.STREAM_DISCONNECTED, () => {
      console.log('Stream disconnected');
      endSession();
    });

    avatar.current?.on(
      StreamingEvents.STREAM_READY,
      (event: CustomEvent<MediaStream>) => {
        console.log('Stream ready:', event.detail);
        setStream(event.detail);
      },
    );

    avatar.current?.on(StreamingEvents.USER_START, (event: Event) => {
      console.log('User started talking:', event);
      setIsUserTalking(true);
    });

    avatar.current?.on(StreamingEvents.USER_STOP, (event: Event) => {
      console.log('User stopped talking:', event);
      setIsUserTalking(false);
    });

    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: avatarId,
        knowledgeId,
        voice: {
          rate: 1.5,
          emotion: VoiceEmotion.EXCITED,
        },
        language,
        disableIdleTimeout: true,
      });

      setData(res);
      await avatar.current?.startVoiceChat({
        useSilencePrompt: false,
      });
      setChatMode('voice_mode');
    } catch (error) {
      console.error('Error starting avatar session:', error);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleSpeak = async () => {
    setIsLoadingRepeat(true);
    if (!avatar.current) {
      setDebug('Avatar API not initialized');
      return;
    }

    await avatar.current
      .speak({ text, taskType: TaskType.REPEAT, taskMode: TaskMode.SYNC })
      .catch((e: Error) => {
        setDebug(e.message);
      });
    setIsLoadingRepeat(false);
  };

  const handleInterrupt = async () => {
    if (!avatar.current) {
      setDebug('Avatar API not initialized');
      return;
    }
    await avatar.current.interrupt().catch((e: Error) => {
      setDebug(e.message);
    });
  };

  const endSession = async () => {
    await avatar.current?.stopAvatar();
    setStream(undefined);
  };

  const handleChangeChatMode = useMemoizedFn(async (value: string) => {
    if (value === chatMode) {
      return;
    }
    if (value === 'text_mode') {
      avatar.current?.closeVoiceChat();
    } else {
      await avatar.current?.startVoiceChat();
    }
    setChatMode(value);
  });

  const previousText = usePrevious(text);

  useEffect(() => {
    if (previousText === '' && text !== '') {
      avatar.current?.startListening();
    } else if (previousText !== '' && text === '') {
      avatar.current?.stopListening();
    }
  }, [text, previousText]);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, []);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current?.play();
        setDebug('Playing');
      };
    }
  }, [stream]);

  return (
    <StyledContainer>
      <StyledCard>
        <StyledCardContent>
          {stream ? (
            <StyledVideoContainer>
              <StyledVideo ref={mediaStream} autoPlay playsInline>
                <track kind="captions" />
              </StyledVideo>
              <StyledButtonContainer>
                <Button
                  variant="secondary"
                  title="Interrupt task"
                  onClick={handleInterrupt}
                >
                  Interrupt task
                </Button>
                <Button
                  variant="secondary"
                  title="End session"
                  onClick={endSession}
                >
                  End session
                </Button>
              </StyledButtonContainer>
            </StyledVideoContainer>
          ) : !isLoadingSession ? (
            <StyledFormContainer>
              <StyledInputGroup>
                <TextInput
                  label="Custom Knowledge ID (optional)"
                  placeholder="Enter a custom knowledge ID"
                  value={knowledgeId}
                  onChange={(value) => setKnowledgeId(value)}
                />
                <TextInput
                  label="Custom Avatar ID (optional)"
                  placeholder="Enter a custom avatar ID"
                  value={avatarId}
                  onChange={(value) => setAvatarId(value)}
                />
                <Select
                  dropdownId="avatar-select"
                  label="Or select one from these example avatars"
                  value={avatarId}
                  onChange={(value) => setAvatarId(value as string)}
                  options={AVATARS.map((avatar) => ({
                    value: avatar.avatar_id,
                    label: avatar.name,
                  }))}
                />
                <Select
                  dropdownId="language-select"
                  label="Select language"
                  value={language}
                  onChange={(value) => setLanguage(value as string)}
                  options={STT_LANGUAGE_LIST.map((lang) => ({
                    value: lang.key,
                    label: lang.label,
                  }))}
                />
              </StyledInputGroup>
              <Button
                variant="primary"
                title="Start session"
                onClick={startSession}
              >
                Start session
              </Button>
            </StyledFormContainer>
          ) : (
            <div>Loading...</div>
          )}
        </StyledCardContent>
        <div>
          {chatMode === 'text_mode' ? (
            <InteractiveAvatarTextInput
              disabled={!stream}
              input={text}
              label="Chat"
              loading={isLoadingRepeat}
              placeholder="Type something for the avatar to respond"
              setInput={setText}
              onSubmit={handleSpeak}
            />
          ) : (
            <Button
              variant="secondary"
              disabled={!isUserTalking}
              onClick={() => {}}
            >
              {isUserTalking ? 'Listening' : 'Voice chat'}
            </Button>
          )}
        </div>
      </StyledCard>
      <StyledDebugText>
        <strong>Console:</strong>
        <br />
        {debug}
      </StyledDebugText>
    </StyledContainer>
  );
};
