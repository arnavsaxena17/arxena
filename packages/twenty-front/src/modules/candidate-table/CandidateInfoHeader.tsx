import { currentJobIdState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { processedDataSelector, tableStateAtom } from '@/candidate-table/states/states';
import { useStartChats } from '@/object-record/hooks/useStartChats';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { IconCopy, IconExternalLink, IconId, IconMessageCircle, IconMessageX, IconPhone, IconUserCircle } from '@tabler/icons-react';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { graphQltoUpdateOneCandidate } from 'twenty-shared';
import { Status } from 'twenty-ui';

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

// Status labels
const STATUS_LABELS: Record<string, string> = {
  NOT_INTERESTED: 'Not Interested',
  INTERESTED: 'Interested',
  CV_RECEIVED: 'CV Received',
  NOT_FIT: 'Not Fit',
  SCREENING: 'Screening',
  RECRUITER_INTERVIEW: 'Recruiter Interview',
  CV_SENT: 'CV Sent',
  CLIENT_INTERVIEW: 'Client Interview',
  NEGOTIATION: 'Negotiation',
};

// All chat options
const ALL_CHATS = [
  'startChat',
  'remindCandidate',
  'firstInterviewReminder',
  'secondInterviewReminder',
];

// Chat labels mapping
const CHAT_LABELS: Record<string, string> = {
  startChat: 'Start Chat',
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

export const CandidateInfoHeader = () => {
  const tableState = useRecoilValue(tableStateAtom);
  const candidateId = tableState.selectedRowIds[0];
  const [tokenPair] = useRecoilState(tokenPairState);
  const processedData = useRecoilValue(processedDataSelector);
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

    const candidateData = processedData.find((row) => row.id === candidateId);
    return candidateData;
  };

  // Find the candidate data
  const candidateData = findCandidateInTableData();
  
  if (!candidateData) {
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
            idToUpdate: candidateId,
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
        await sendStartChatRequest([candidateId], 'candidate', jobId ? [jobId] : undefined);
      } else {
        await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/start-interim-chat-prompt`,
          {
            interimChat: selectedInterimChat,
            phoneNumber: candidateData.phone,
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
        { candidateId },
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
    navigate(`/object/candidate/${candidateId}`);
  };

  // Get status color based on current status
  const getStatusColor = (status: string): "red" | "green" | "orange" | "turquoise" | "sky" | "blue" | "purple" | "gray" | "pink" | "yellow" => {
    return STATUS_COLORS[status] || 'gray';
  };

  const getProfileUrl = (candidateData: any) => {
    console.log("candidateData", candidateData);
    if (candidateData?.resdexNaukriUrl) {
      return candidateData.resdexNaukriUrl;
    }
    if (candidateData?.hiringNaukriUrl) {
      return candidateData.hiringNaukriUrl;
    }
    if (candidateData?.linkedin) {
      return candidateData.linkedin;
    }
    if (candidateData?.profileUrl) {
      return candidateData.profileUrl;
    }
    return '';
  };

  return (
    <StyledContainer>
      <StyledTopRow>
        <StyledName>{candidateData.name}</StyledName>
        {candidateData.status && (
          <Status 
            color={getStatusColor(typeof candidateData.status === 'string' ? candidateData.status : '')} 
            text={typeof candidateData.status === 'string' ? (STATUS_LABELS[candidateData.status] || candidateData.status) : ''}
          />
        )}
      </StyledTopRow>

      <StyledInfoRow>
        <StyledInfoItem>
          <StyledIconWrapper onClick={handleNavigateToCandidate}>
            <IconId size={16} />
          </StyledIconWrapper>
          <span>ID: {candidateId?.substring(0, 8)}...</span>
          <StyledIconWrapper onClick={() => handleCopy(candidateId || '', 'Candidate ID')}>
            <IconCopy size={14} />
          </StyledIconWrapper>
        </StyledInfoItem>
        
        {candidateData.phone && (
          <StyledInfoItem onClick={() => handleCopy(candidateData.phone, 'Phone number')}>
            <IconPhone size={16} />
            <span>{candidateData.phone}</span>
            <IconCopy size={14} />
          </StyledInfoItem>
        )}

        {candidateData.email && (
          <StyledInfoItem onClick={() => handleCopy(candidateData.email, 'Email')}>
            <IconUserCircle size={16} />
            <span>{candidateData.email}</span>
            <IconCopy size={14} />
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
}; 