import { Modal } from '@/ui/layout/modal/components/Modal';
import styled from '@emotion/styled';
import { IconX } from 'twenty-ui';

const StyledStatsContainer = styled.div`
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledStatsRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  gap: ${({ theme }) => theme.spacing(4)};

  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing(2)};
  }
`;

const StyledStatItem = styled.div`
  flex: 1;
  background-color: ${({ theme }) => theme.background.secondary};
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  text-align: center;

  strong {
    display: block;
    margin-bottom: ${({ theme }) => theme.spacing(1)};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledHeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const StyledTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(1)};
  color: ${({ theme }) => theme.font.color.tertiary};
  
  &:hover {
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

type JobStatisticsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  processedData: any[];
};

export const JobStatisticsModal = ({ isOpen, onClose, processedData }: JobStatisticsModalProps) => {
  if (!isOpen) return null;

  return (
    <Modal isClosable={true} onClose={onClose} size="large" modalVariant="primary">
      <Modal.Header>
        <StyledHeaderContainer>
          <StyledTitle>Job Statistics</StyledTitle>
          <StyledCloseButton onClick={onClose}>
            <IconX size={16} />
          </StyledCloseButton>
        </StyledHeaderContainer>
      </Modal.Header>
      <Modal.Content>
        <StyledStatsContainer>
          <StyledStatsRow>
            <StyledStatItem>
              <strong>Total Candidates</strong>
              {processedData.length}
            </StyledStatItem>
          </StyledStatsRow>
          <StyledStatsRow>
            <StyledStatItem>
              <strong>No Conversation</strong>
              {processedData.filter(record => record.candConversationStatus === 'ONLY_ADDED_NO_CONVERSATION').length} candidates
            </StyledStatItem>
            <StyledStatItem>
              <strong>Started, No Response</strong>
              {processedData.filter(record => record.candConversationStatus === 'CONVERSATION_STARTED_HAS_NOT_RESPONDED').length} candidates
            </StyledStatItem>
            <StyledStatItem>
              <strong>Shared JD, No Response</strong>
              {processedData.filter(record => record.candConversationStatus === 'SHARED_JD_HAS_NOT_RESPONDED').length} candidates
            </StyledStatItem>
          </StyledStatsRow>
          <StyledStatsRow>
            <StyledStatItem>
              <strong>Refuses Relocation</strong>
              {processedData.filter(record => record.candConversationStatus === 'CANDIDATE_REFUSES_TO_RELOCATE').length} candidates
            </StyledStatItem>
            <StyledStatItem>
              <strong>Stopped Responding</strong>
              {processedData.filter(record => record.candConversationStatus === 'STOPPED_RESPONDING_ON_QUESTIONS').length} candidates
            </StyledStatItem>
            <StyledStatItem>
              <strong>Salary Out of Range</strong>
              {processedData.filter(record => record.candConversationStatus === 'CANDIDATE_SALARY_OUT_OF_RANGE').length} candidates
            </StyledStatItem>
          </StyledStatsRow>
          <StyledStatsRow>
            <StyledStatItem>
              <strong>Keen to Chat</strong>
              {processedData.filter(record => record.candConversationStatus === 'CANDIDATE_IS_KEEN_TO_CHAT').length} candidates
            </StyledStatItem>
            <StyledStatItem>
              <strong>Followed Up</strong>
              {processedData.filter(record => record.candConversationStatus === 'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT').length} candidates
            </StyledStatItem>
            <StyledStatItem>
              <strong>Reluctant on Compensation</strong>
              {processedData.filter(record => record.candConversationStatus === 'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION').length} candidates
            </StyledStatItem>
          </StyledStatsRow>
          <StyledStatsRow>
            <StyledStatItem>
              <strong>Closed to Contact</strong>
              {processedData.filter(record => record.candConversationStatus === 'CONVERSATION_CLOSED_TO_BE_CONTACTED').length} candidates
            </StyledStatItem>
          </StyledStatsRow>
        </StyledStatsContainer>
      </Modal.Content>
    </Modal>
  );
}; 