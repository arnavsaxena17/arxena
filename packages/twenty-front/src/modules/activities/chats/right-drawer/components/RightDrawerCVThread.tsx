import AttachmentPanel from '@/activities/chats/components/AttachmentPanel';
import { chatPanelState } from '@/activities/chats/states/chatPanelState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { graphqlToFetchAllCandidateData, MessageNode } from 'twenty-shared';

// const StyledContainer = styled.div`
//   display: flex;
//   flex-direction: column;
//   height: 100%;
//   background-color: ${props => props.theme.background.primary};
// `;
const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh; // Changed to 100vh to take full viewport height
  width: 100%; // Ensure full width
  background-color: ${props => props.theme.background.primary};
  position: relative; // Added for proper positioning
  overflow: hidden; // Prevent scrolling of container
`;

const ModifiedAttachmentPanel = styled(AttachmentPanel)`
  position: absolute; 
  top: 0;
  right: 0;
  width: 100% !important; // Force full width
  height: 100vh !important; // Force full height
  margin: 0;
  padding: 0;
  
  // Override any internal positioning if necessary
  & > div {
    position: relative;
    width: 100% !important;
    height: 100% !important;
    right: 0 !important;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${props => props.theme.font.color.light};
  text-align: center;
  padding: ${props => props.theme.spacing(4)};
`;


export const RightDrawerCVThread = () => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [chatPanel] = useRecoilState(chatPanelState);
  const [messageHistory, setMessageHistory] = useState<MessageNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [candidateData, setCandidateData] = useState<{ id: string; name: string } | null>(null);
  const [isAttachmentPanelOpen, setIsAttachmentPanelOpen] = useState(true);

  const candidateId = chatPanel.selectedRecordIds[0];

  useEffect(() => {
    const fetchCandidateData = async () => {
      if (!candidateId || !tokenPair?.accessToken?.token) return;

      try {
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/graphql`,
          {
            operationName: 'FindManyCandidates',
            variables: {
              lastCursor: null,
              limit: 1,
              filter: { id: { eq: candidateId } },
            },
            query: graphqlToFetchAllCandidateData,
          },
          {
            headers: {
              Authorization: `Bearer ${tokenPair.accessToken.token}`,
              'Content-Type': 'application/json',
              'x-schema-version': '135',
            },
          },
        );

        const candidate = response.data.data.candidates.edges[0]?.node;
        if (candidate) {
          setCandidateData({
            id: candidate.id,
            name: `${candidate.people.name.firstName} ${candidate.people.name.lastName}`.trim(),
          });
        }
      } catch (err) {
        console.error('Error fetching candidate data:', err);
        setError('Failed to fetch candidate data');
      }
    };

    fetchCandidateData();
  }, [candidateId, tokenPair]);

  if (error) {
    return (
      <EmptyState>
        <p>{error}</p>
        <p>Please try again later</p>
      </EmptyState>
    );
  }

  if (!candidateId) {
    return (
      <EmptyState>
        <p>Please select a candidate to view CV</p>
      </EmptyState>
    );
  }

  return (
    <StyledContainer>
      {candidateData && (
        <ModifiedAttachmentPanel
          isOpen={isAttachmentPanelOpen}
          onClose={() => setIsAttachmentPanelOpen(false)}
          candidateId={candidateData.id}
          candidateName={candidateData.name}
        />
      )}
    </StyledContainer>
  )
};

export default RightDrawerCVThread;
