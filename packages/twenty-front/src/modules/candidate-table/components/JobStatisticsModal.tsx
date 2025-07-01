import { Modal } from '@/ui/layout/modal/components/Modal';
import styled from '@emotion/styled';
import { useSetRecoilState } from 'recoil';
import { IconX } from 'twenty-ui';
import { selectedConversationStatusState } from '../states/states';

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
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
  }

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

type CandidateStatus = {
  label: string;
  status: string;
};

const candidateStatuses: CandidateStatus[] = [
  {
    label: 'No Conversation',
    status: 'ONLY_ADDED_NO_CONVERSATION',
  },
  {
    label: 'Started, No Response',
    status: 'CONVERSATION_STARTED_HAS_NOT_RESPONDED',
  },
  {
    label: 'Shared JD, No Response',
    status: 'SHARED_JD_HAS_NOT_RESPONDED',
  },
  {
    label: 'Refuses Relocation',
    status: 'CANDIDATE_REFUSES_TO_RELOCATE',
  },
  {
    label: 'Stopped Responding',
    status: 'STOPPED_RESPONDING_ON_QUESTIONS',
  },
  {
    label: 'Salary Out of Range',
    status: 'CANDIDATE_SALARY_OUT_OF_RANGE',
  },
  {
    label: 'Keen to Chat',
    status: 'CANDIDATE_IS_KEEN_TO_CHAT',
  },
  {
    label: 'Followed Up',
    status: 'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT',
  },
  {
    label: 'Reluctant on Compensation',
    status: 'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION',
  },
  {
    label: 'Closed to Contact',
    status: 'CONVERSATION_CLOSED_TO_BE_CONTACTED',
  },
];

export const JobStatisticsModal = ({ isOpen, onClose, processedData }: JobStatisticsModalProps) => {
  const setSelectedStatus = useSetRecoilState(selectedConversationStatusState);
  
  if (!isOpen) return null;

  const handleStatusClick = (status: string | null) => {
    setSelectedStatus(status);
    onClose();
  };

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
            <StyledStatItem onClick={() => handleStatusClick(null)}>
              <strong>Total Candidates</strong>
              {processedData.length}
            </StyledStatItem>
          </StyledStatsRow>
          <StyledStatsRow>
            <StyledStatItem onClick={() => handleStatusClick('ONLY_ADDED_NO_CONVERSATION')}>
              <strong>No Conversation</strong>
              {processedData.filter(record => record.candConversationStatus === 'ONLY_ADDED_NO_CONVERSATION').length} candidates
            </StyledStatItem>
            <StyledStatItem onClick={() => handleStatusClick('CONVERSATION_STARTED_HAS_NOT_RESPONDED')}>
              <strong>Started, No Response</strong>
              {processedData.filter(record => record.candConversationStatus === 'CONVERSATION_STARTED_HAS_NOT_RESPONDED').length} candidates
            </StyledStatItem>
            <StyledStatItem onClick={() => handleStatusClick('SHARED_JD_HAS_NOT_RESPONDED')}>
              <strong>Shared JD, No Response</strong>
              {processedData.filter(record => record.candConversationStatus === 'SHARED_JD_HAS_NOT_RESPONDED').length} candidates
            </StyledStatItem>
          </StyledStatsRow>
          <StyledStatsRow>
            <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_REFUSES_TO_RELOCATE')}>
              <strong>Refuses Relocation</strong>
              {processedData.filter(record => record.candConversationStatus === 'CANDIDATE_REFUSES_TO_RELOCATE').length} candidates
            </StyledStatItem>
            <StyledStatItem onClick={() => handleStatusClick('STOPPED_RESPONDING_ON_QUESTIONS')}>
              <strong>Stopped Responding</strong>
              {processedData.filter(record => record.candConversationStatus === 'STOPPED_RESPONDING_ON_QUESTIONS').length} candidates
            </StyledStatItem>
            <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_SALARY_OUT_OF_RANGE')}>
              <strong>Salary Out of Range</strong>
              {processedData.filter(record => record.candConversationStatus === 'CANDIDATE_SALARY_OUT_OF_RANGE').length} candidates
            </StyledStatItem>
          </StyledStatsRow>
          <StyledStatsRow>
            <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_IS_KEEN_TO_CHAT')}>
              <strong>Keen to Chat</strong>
              {processedData.filter(record => record.candConversationStatus === 'CANDIDATE_IS_KEEN_TO_CHAT').length} candidates
            </StyledStatItem>
            <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT')}>
              <strong>Followed Up</strong>
              {processedData.filter(record => record.candConversationStatus === 'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT').length} candidates
            </StyledStatItem>
            <StyledStatItem onClick={() => handleStatusClick('CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION')}>
              <strong>Reluctant on Compensation</strong>
              {processedData.filter(record => record.candConversationStatus === 'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION').length} candidates
            </StyledStatItem>
          </StyledStatsRow>
          <StyledStatsRow>
            <StyledStatItem onClick={() => handleStatusClick('CONVERSATION_CLOSED_TO_BE_CONTACTED')}>
              <strong>Closed to Contact</strong>
              {processedData.filter(record => record.candConversationStatus === 'CONVERSATION_CLOSED_TO_BE_CONTACTED').length} candidates
            </StyledStatItem>
          </StyledStatsRow>
        </StyledStatsContainer>
      </Modal.Content>
    </Modal>
  );
}; 