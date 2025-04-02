import styled from '@emotion/styled';

type Status =
  | 'screening'
  | 'interview_scheduled'
  | 'offer_pending'
  | 'rejected';

const StyledListItem = styled.div<{ isSelected?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme, isSelected }) =>
    isSelected ? theme.background.tertiary : theme.background.primary};
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }
`;

const StyledContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`;

const StyledName = styled.span`
  ${({ theme }) => theme.font.size.lg};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledTime = styled.span`
  ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledPosition = styled.span`
  ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledMessage = styled.p`
  ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
`;

const StyledStatus = styled.span<{ status: Status }>`
  ${({ theme }) => theme.font.size.sm};
  border-radius: 999px;
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(1.5)}`};

  ${({ status, theme }) => {
    const statusStyles = {
      screening: {
        color: theme.color.yellow,
        backgroundColor: `${theme.color.yellow}20`,
      },
      interview_scheduled: {
        color: theme.color.blue,
        backgroundColor: `${theme.color.blue}20`,
      },
      offer_pending: {
        color: theme.color.purple,
        backgroundColor: `${theme.color.purple}20`,
      },
      rejected: {
        color: theme.color.red,
        backgroundColor: `${theme.color.red}20`,
      },
    };
    return statusStyles[status];
  }}
`;

type ConversationListItemProps = {
  name: string;
  time: string;
  position: string;
  company: string;
  message: string;
  status: Status;
  isSelected?: boolean;
  onClick?: () => void;
};

export const ConversationListItem = ({
  name,
  time,
  position,
  company,
  message,
  status,
  isSelected,
  onClick,
}: ConversationListItemProps) => {
  const getStatusText = (status: Status) => {
    return {
      screening: 'Screening',
      interview_scheduled: 'Interview Scheduled',
      offer_pending: 'Offer Pending',
      rejected: 'Rejected',
    }[status];
  };

  return (
    <StyledListItem isSelected={isSelected} onClick={onClick}>
      <StyledContent>
        <StyledHeader>
          <StyledName>{name}</StyledName>
          <StyledTime>{time}</StyledTime>
        </StyledHeader>
        <StyledPosition>
          {position} at {company}
        </StyledPosition>
        <StyledMessage>{message}</StyledMessage>
        <StyledStatus status={status}>{getStatusText(status)}</StyledStatus>
      </StyledContent>
    </StyledListItem>
  );
};

export default ConversationListItem;
