import { currentJobIdState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { getPermanentId, isUUID } from '@/candidate-table/HotHooks';
import { processedDataSelector, selectedCandidateIdState, tableStateAtom } from '@/candidate-table/states/states';
import { useStartChats } from '@/object-record/hooks/useStartChats';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { IconCopy, IconExternalLink, IconId, IconMessageCircle, IconMessageX, IconPhone, IconUserCircle } from '@tabler/icons-react';
import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { getCandidateCustomField, graphQltoUpdateOneCandidate } from 'twenty-shared';
import { Status } from 'twenty-ui';
import { STATUS_LABELS } from './TableColumns';


// Status colors mapping
const STATUS_COLORS: Record<string, "red" | "green" | "orange" | "turquoise" | "sky" | "blue" | "purple" | "gray" | "pink" | "yellow"> = {
  NOT_INTERESTED: 'red',
  INTERESTED: 'green',
  CV_RECEIVED: 'orange',
  NOT_FIT: 'turquoise',
  SCREENING: 'green',
  RECRUITER_INTERVIEW: 'turquoise',
  CV_SENT: 'sky',
  CLIENT_INTERVIEW: 'blue',
  NEGOTIATION: 'purple',
};

// Conversation status labels mapping
const CANDIDATE_CONVERSATION_STATUS_LABELS: Record<string, string> = {
  ONLY_ADDED_NO_CONVERSATION: 'No Conversation',
  CONVERSATION_STARTED_HAS_NOT_RESPONDED: 'Started, No Response',
  SHARED_JD_HAS_NOT_RESPONDED: 'Shared JD, No Response',
  CANDIDATE_REFUSES_TO_RELOCATE: 'Refuses Relocation',
  STOPPED_RESPONDING_ON_QUESTIONS: 'Stopped Responding',
  CANDIDATE_SALARY_OUT_OF_RANGE: 'Salary Out of Range',
  CANDIDATE_IS_KEEN_TO_CHAT: 'Keen to Chat',
  CANDIDATE_DECLINED_OPPORTUNITY: 'Declined Opportunity',
  CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT: 'Followed Up',
  CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION: 'Reluctant on Compensation',
  CONVERSATION_CLOSED_TO_BE_CONTACTED: 'Closed to Contact'
};

// Conversation status colors mapping
const CONVERSATION_STATUS_COLORS: Record<string, "red" | "green" | "orange" | "turquoise" | "sky" | "blue" | "purple" | "gray" | "pink" | "yellow"> = {
  ONLY_ADDED_NO_CONVERSATION: 'gray',
  CONVERSATION_STARTED_HAS_NOT_RESPONDED: 'orange',
  SHARED_JD_HAS_NOT_RESPONDED: 'orange',
  CANDIDATE_REFUSES_TO_RELOCATE: 'red',
  STOPPED_RESPONDING_ON_QUESTIONS: 'red',
  CANDIDATE_SALARY_OUT_OF_RANGE: 'red',
  CANDIDATE_IS_KEEN_TO_CHAT: 'green',
  CANDIDATE_DECLINED_OPPORTUNITY: 'red',
  CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT: 'green',
  CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION: 'orange',
  CONVERSATION_CLOSED_TO_BE_CONTACTED: 'gray'
};



// All chat options
const ALL_CHATS = [
  'startChat',
  'resumeChat',
  'remindCandidate',
  'restartChatWithNewPhone',
  'firstInterviewReminder',
  'secondInterviewReminder',
];

// Chat labels mapping
const CHAT_LABELS: Record<string, string> = {
  startChat: 'Start Chat',
  resumeChat: 'Resume Chat',
  restartChatWithNewPhone:'Restart Chat with New Phone',
  remindCandidate: 'Remind Candidate',
  firstInterviewReminder: '1st Interview Reminder',
  secondInterviewReminder: '2nd Interview Reminder',
};

// Styled components
const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.primary};
`;

const StyledTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledName = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledInfoRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledInfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(1)};
  cursor: pointer;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledActionsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing(1)};
  background-color: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(1)}`};
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: ${({ theme }) => theme.font.size.sm};
  white-space: nowrap;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.quaternary};
  }
`;

const StyledDropdownContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 120px;
`;

const StyledSelect = styled.select`
  padding: ${({ theme }) => `${theme.spacing(0.5)} ${theme.spacing(1)}`};
  background-color: ${({ theme }) => theme.background.tertiary};
  color: ${({ theme }) => theme.font.color.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.border.color.strong};
  }
`;

const StyledIconWrapper = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  
  &:hover {
    opacity: 0.8;
  }
`;

const StyledLinkIcon = styled(IconExternalLink)`
  color: ${({ theme }) => theme.font.color.secondary};
  width: 16px;
  height: 16px;
  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

type CandidateInfoHeaderProps = {
  candidateData?: any;
};

// Custom comparison function for React.memo to prevent re-renders when candidateData hasn't actually changed
const arePropsEqual = (prevProps: CandidateInfoHeaderProps, nextProps: CandidateInfoHeaderProps) => {
  const prevData = prevProps.candidateData;
  const nextData = nextProps.candidateData;
  
  // If both are undefined/null, they're equal
  if (!prevData && !nextData) return true;
  
  // If one is undefined/null and the other isn't, they're different
  if (!prevData || !nextData) return false;
  
  // Compare key fields that affect the UI
  return (
    prevData.id === nextData.id &&
    prevData.name === nextData.name &&
    prevData.status === nextData.status &&
    prevData.candConversationStatus === nextData.candConversationStatus &&
    prevData.updatedAt === nextData.updatedAt
  );
};

export const CandidateInfoHeader = React.memo(({ candidateData: propCandidateData }: CandidateInfoHeaderProps) => {
  const candidateId = useRecoilValue(selectedCandidateIdState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const processedData = useRecoilValue(processedDataSelector);
  const searchResults = useRecoilValue(searchResultsState);
  const tableState = useRecoilValue(tableStateAtom);
  const jobId = useRecoilValue(currentJobIdState);
  const navigate = useNavigate();

  const [selectedInterimChat, setSelectedInterimChat] = useState('');
  const { enqueueSnackBar } = useSnackBar();
  const { sendStartChatRequest } = useStartChats({
    onSuccess: () => {
      enqueueSnackBar('Chat started successfully', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });
      setSelectedInterimChat('');
    },
    onError: (error: Error) => {
      console.error('Error starting chat:', error);
      enqueueSnackBar('Error starting chat', {
        variant: SnackBarVariant.Error,
        duration: 3000,
      });
    },
  });

  // Function to find all table data states and search for our candidate
  const findCandidateInTableData = () => {
    // If we don't have a candidate ID, return null
    if (!candidateId) {
      return null;
    }

    // Combine searchResults and processedData (same as DataTable does)
    const allCandidates = [...searchResults, ...processedData];

    // First, try exact match by ID
    let candidateData = allCandidates.find((row) => row.id === candidateId);
    
    // If not found, try to find using getPermanentId logic
    if (!candidateData && tableState.rawData && Array.isArray(tableState.rawData)) {
      // Try to find a row that matches the candidateId
      // by checking if any row's permanentId matches our candidateId
      for (const row of allCandidates) {
        const rowPermanentId = getPermanentId(row, tableState.rawData);
        if (rowPermanentId === candidateId || row.id === candidateId) {
          candidateData = row;
          break;
        }
      }
      
      // If still not found, try to find in rawData directly
      if (!candidateData) {
        const rawCandidate = tableState.rawData.find((row: any) => {
          return row.id === candidateId || 
                 row.tempId === candidateId ||
                 getPermanentId(row, tableState.rawData) === candidateId;
        });
        
        // If found in rawData, try to find corresponding entry in allCandidates
        if (rawCandidate) {
          const rawCandidateId = getPermanentId(rawCandidate as any, tableState.rawData) || rawCandidate.id;
          candidateData = allCandidates.find((row) => {
            const rowPermanentId = getPermanentId(row, tableState.rawData);
            return rowPermanentId === rawCandidateId || row.id === rawCandidateId || row.id === candidateId;
          });
        }
      }
    }
    
    // Last resort: if candidateId is a LinkedIn ID, try to find by matching LinkedIn ID or tempId
    if (!candidateData && candidateId && !isUUID(candidateId)) {
      candidateData = allCandidates.find((row) => {
        return row.tempId === candidateId || 
               row.id === candidateId ||
               (row.linkedinUrl && typeof row.linkedinUrl === 'string' && row.linkedinUrl.includes(candidateId)) ||
               (row.linkedinUrl && typeof row.linkedinUrl === 'object' && row.linkedinUrl.primaryLinkUrl && row.linkedinUrl.primaryLinkUrl.includes(candidateId));
      });
    }
    
    return candidateData;
  };

  // Find the candidate data - use prop data if available, otherwise fall back to table data
  const candidateData = propCandidateData || findCandidateInTableData();
  const activeCandidateId = candidateId || candidateData?.id;
  
  if (!candidateData || !activeCandidateId) {
    return (
      <StyledContainer>
        <div>No candidate selected or data not found.</div>
      </StyledContainer>
    );
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackBar(`${label} copied to clipboard`, {
      variant: SnackBarVariant.Success,
      duration: 3000,
    });
  };

  const handleStatusUpdate = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = event.target.value;
    
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
        {
          query: graphQltoUpdateOneCandidate,
          variables: {
            idToUpdate: activeCandidateId,
            input: { status: newStatus },
          },
        },
        {
          headers: {
            authorization: `Bearer ${tokenPair?.accessToken?.token}`,
            'content-type': 'application/json',
            'x-schema-version': '66',
          },
        }
      );
      
      enqueueSnackBar('Status updated successfully', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      enqueueSnackBar('Error updating status', {
        variant: SnackBarVariant.Error,
        duration: 3000,
      });
    }
  };

  const handleChatStart = async () => {
    if (!selectedInterimChat) {
      enqueueSnackBar('Please select a chat type', {
        variant: SnackBarVariant.Error,
        duration: 3000,
      });
      return;
    }

    try {
      if (selectedInterimChat === 'startChat') {
        await sendStartChatRequest([activeCandidateId], 'candidate', jobId ? [jobId] : undefined);
      } else {
        await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/start-interim-chat-prompt`,
          {
            interimChat: selectedInterimChat,
            candidateId: activeCandidateId,
          },
          {
            headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
          }
        );
        
        enqueueSnackBar('Interim chat started successfully', {
          variant: SnackBarVariant.Success,
          duration: 3000,
        });
        
        setSelectedInterimChat('');
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      enqueueSnackBar('Error starting chat', {
        variant: SnackBarVariant.Error,
        duration: 3000,
      });
    }
  };

  const handleStopChat = async () => {
    try {
      await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/stop-chat`,
        { candidateId: activeCandidateId },
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` },
        }
      );
      
      enqueueSnackBar('Chat stopped successfully', {
        variant: SnackBarVariant.Success,
        duration: 3000,
      });
    } catch (error) {
      console.error('Error stopping chat:', error);
      enqueueSnackBar('Error stopping chat', {
        variant: SnackBarVariant.Error,
        duration: 3000,
      });
    }
  };

  const handleNavigateToCandidate = () => {
    navigate(`/object/candidate/${activeCandidateId}`);
  };

  // Get status color based on current status
  const getStatusColor = (status: string): "red" | "green" | "orange" | "turquoise" | "sky" | "blue" | "purple" | "gray" | "pink" | "yellow" => {
    return STATUS_COLORS[status] || 'gray';
  };

  // Get conversation status color based on current conversation status
  const getConversationStatusColor = (conversationStatus: string): "red" | "green" | "orange" | "turquoise" | "sky" | "blue" | "purple" | "gray" | "pink" | "yellow" => {
    return CONVERSATION_STATUS_COLORS[conversationStatus] || 'gray';
  };

  const getProfileUrl = (candidateData: any) => {
    console.log("candidateData", candidateData);
    if (candidateData?.resdexNaukriUrl) {
      return candidateData.resdexNaukriUrl.primaryLinkUrl;
    }
    if (candidateData?.hiringNaukriUrl) {
      return candidateData.hiringNaukriUrl.primaryLinkUrl;
    }
    if (candidateData?.linkedin) {
      return candidateData.linkedin.primaryLinkUrl;
    }
    if (candidateData?.profileUrl) {
      return candidateData.profileUrl.primaryLinkUrl;
    }
    return '';
  };

  // Helper function to get field value from candidateFieldValues
  const getFieldValue = (candidateData: any, fieldName: string) => {
    const value = getCandidateCustomField(candidateData, fieldName);
    if (value === null || value === undefined) {
      return '';
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
  };

  // Get basic candidate info
  const jobTitle = getFieldValue(candidateData, 'job_title') || candidateData.jobTitle || '';
  const companyName = getFieldValue(candidateData, 'job_company_name') || '';
  const location = getFieldValue(candidateData, 'location_name') || '';
  const experience = getFieldValue(candidateData, 'inferred_years_experience') || '';
  const salary = getFieldValue(candidateData, 'inferred_salary') || '';
  const industry = getFieldValue(candidateData, 'industry') || '';

  // Extract phone and email values safely
  const phoneValue = typeof candidateData.phone === 'string' 
    ? candidateData.phone 
    : candidateData.phone?.primaryPhoneNumber || '';
  
  const emailValue = typeof candidateData.email === 'string' 
    ? candidateData.email 
    : candidateData.email?.primaryEmail || '';

  return (
    <StyledContainer>
      <StyledTopRow>
        <StyledName>{candidateData.name}</StyledName>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {candidateData.status && (
            <Status 
              color={getStatusColor(typeof candidateData.status === 'string' ? candidateData.status : '')} 
              text={typeof candidateData.status === 'string' ? (STATUS_LABELS[candidateData.status] || candidateData.status) : ''}
            />
          )}
          {candidateData.candConversationStatus && (
            <Status 
              color={getConversationStatusColor(typeof candidateData.candConversationStatus === 'string' ? candidateData.candConversationStatus : '')} 
              text={typeof candidateData.candConversationStatus === 'string' ? (CANDIDATE_CONVERSATION_STATUS_LABELS[candidateData.candConversationStatus] || candidateData.candConversationStatus) : ''}
            />
          )}
        </div>
      </StyledTopRow>

      <StyledInfoRow>
        <StyledInfoItem>
          <StyledIconWrapper onClick={handleNavigateToCandidate}>
            <IconId size={16} />
          </StyledIconWrapper>
          <span>ID: {activeCandidateId?.substring(0, 8)}...</span>
          <StyledIconWrapper onClick={() => handleCopy(activeCandidateId || '', 'Candidate ID')}>
            <IconCopy size={14} />
          </StyledIconWrapper>
        </StyledInfoItem>
        
        {phoneValue && (
          <StyledInfoItem onClick={() => handleCopy(phoneValue, 'Phone number')}>
            <IconPhone size={16} />
            <span>{phoneValue}</span>
            <IconCopy size={14} />
          </StyledInfoItem>
        )}

        {emailValue && (
          <StyledInfoItem onClick={() => handleCopy(emailValue, 'Email')}>
            <IconUserCircle size={16} />
            <span>{emailValue}</span>
            <IconCopy size={14} />
          </StyledInfoItem>
        )}

        {jobTitle && (
          <StyledInfoItem>
            <span 
              style={{ 
                fontWeight: '500',
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block'
              }}
              title={jobTitle}
            >
              {jobTitle}
            </span>
          </StyledInfoItem>
        )}

        {companyName && (
          <StyledInfoItem>
            <span style={{ color: '#6B7280' }}>at {companyName}</span>
          </StyledInfoItem>
        )}

        {location && (
          <StyledInfoItem>
            <span style={{ color: '#6B7280' }}>📍 {location}</span>
          </StyledInfoItem>
        )}

        {experience && (
          <StyledInfoItem>
            <span style={{ color: '#6B7280' }}>⏱️ {experience}</span>
          </StyledInfoItem>
        )}

        {salary && (
          <StyledInfoItem>
            <span style={{ color: '#6B7280' }}>💰 {salary}L</span>
          </StyledInfoItem>
        )}

        {industry && (
          <StyledInfoItem>
            <span style={{ color: '#6B7280' }}>🏢 {industry}</span>
          </StyledInfoItem>
        )}

        {getProfileUrl(candidateData) && (
          <StyledInfoItem>
            <a 
              href={getProfileUrl(candidateData)} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
            >
              <StyledLinkIcon />
              <span style={{ marginLeft: '4px' }}>Profile</span>
            </a>
          </StyledInfoItem>
        )}
      </StyledInfoRow>

      <StyledActionsRow>
        <StyledDropdownContainer>
          <StyledSelect 
            value={candidateData.status as string || ''} 
            onChange={handleStatusUpdate}
          >
            <option value="" disabled>Update Status</option>
            {Object.keys(STATUS_LABELS).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </StyledSelect>
        </StyledDropdownContainer>

        <StyledDropdownContainer>
          <StyledSelect
            value={selectedInterimChat}
            onChange={(e) => setSelectedInterimChat(e.target.value)}
          >
            <option value="" disabled>Chat Type</option>
            {ALL_CHATS.map((chat) => (
              <option key={chat} value={chat}>
                {CHAT_LABELS[chat]}
              </option>
            ))}
          </StyledSelect>
        </StyledDropdownContainer>

        <StyledActionButton onClick={handleChatStart}>
          <IconMessageCircle size={16} />
          <span>Start Chat</span>
        </StyledActionButton>

        <StyledActionButton onClick={handleStopChat}>
          <IconMessageX size={16} />
          <span>Stop Chat</span>
        </StyledActionButton>
      </StyledActionsRow>
    </StyledContainer>
  );
}, arePropsEqual); 