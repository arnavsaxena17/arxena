import styled from '@emotion/styled';

const StyledChatSection = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledChatHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledChatTitle = styled.h2`
  ${({ theme }) => theme.font.size.xl};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledChatInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledPosition = styled.span`
  ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledId = styled.span`
  ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }
`;

const StyledChatMessages = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledMessage = styled.div<{ isOwn?: boolean }>`
  align-self: ${({ isOwn }) => (isOwn ? 'flex-end' : 'flex-start')};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
  max-width: 70%;
`;

const StyledMessageHeader = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: space-between;
`;

const StyledMessageSender = styled.span`
  ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledMessageTime = styled.span`
  ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledMessageContent = styled.div<{ isOwn?: boolean }>`
  background-color: ${({ theme, isOwn }) =>
    isOwn ? theme.color.gray : theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-shadow: ${({ theme }) => theme.boxShadow.light};
  color: ${({ theme, isOwn }) =>
    isOwn ? theme.font.color.inverted : theme.font.color.primary};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledInputContainer = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${({ theme }) => `${theme.spacing(2.5)} ${theme.spacing(3)}`};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 400;
  line-height: 1.171875em;
  color: ${({ theme }) => theme.font.color.primary};

  &::placeholder {
    color: ${({ theme }) => theme.font.color.light};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

type Message = {
  id: string;
  sender: string;
  time: string;
  content: string;
  isOwn?: boolean;
};

type ChatSectionProps = {
  candidateName: string;
  position: string;
  candidateId: string;
  messages: Message[];
};

export const ChatSection = ({
  candidateName,
  position,
  candidateId,
  messages,
}: ChatSectionProps) => {
  return (
    <StyledChatSection>
      <StyledChatHeader>
        <StyledChatInfo>
          <StyledChatTitle>{candidateName}</StyledChatTitle>
          <StyledPosition>{position}</StyledPosition>
          <StyledId>ID: {candidateId}</StyledId>
        </StyledChatInfo>
        <StyledActionButtons>
          <StyledButton>Resume</StyledButton>
          <StyledButton>Emails</StyledButton>
          <StyledButton>Call</StyledButton>
          <StyledButton>Video</StyledButton>
          <StyledButton>Note</StyledButton>
        </StyledActionButtons>
      </StyledChatHeader>
      <StyledChatMessages>
        {messages.map((message) => (
          <StyledMessage key={message.id} isOwn={message.isOwn}>
            <StyledMessageHeader>
              <StyledMessageSender>{message.sender}</StyledMessageSender>
              <StyledMessageTime>{message.time}</StyledMessageTime>
            </StyledMessageHeader>
            <StyledMessageContent isOwn={message.isOwn}>
              {message.content}
            </StyledMessageContent>
          </StyledMessage>
        ))}
      </StyledChatMessages>
      <StyledInputContainer>
        <StyledInput placeholder="Type a message..." />
      </StyledInputContainer>
    </StyledChatSection>
  );
};

export default ChatSection;
