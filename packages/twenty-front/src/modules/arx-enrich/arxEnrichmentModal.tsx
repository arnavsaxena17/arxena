import styled from '@emotion/styled';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

import { ArxEnrichLeftSideContainer } from '@/arx-enrich/left-side/ArxEnrichLeftSideContainer';
import { ArxEnrichRightSideContainer } from '@/arx-enrich/right-side/ArxEnrichRightSideContainer';
import { currentJobIdState, enrichmentsState, isArxEnrichModalOpenState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { usePreviousHotkeyScope } from '@/ui/utilities/hotkey/hooks/usePreviousHotkeyScope';
import { AppHotkeyScope } from '@/ui/utilities/hotkey/types/AppHotkeyScope';

const StyledModalContainer = styled.div`
  background-color: solid;
  top: 10vh;
  left: 10vw;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  position: fixed;
  height: 80vh;
  width: 80vw;
  z-index: 1000;
  pointer-events: none; /* This ensures clicks pass through to the backdrop */
`;

const StyledModalBackdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent background */
  z-index: 999; /* Just below your modal container */
  pointer-events: all; /* Ensures clicks are captured by this element */
`;

const StyledAdjuster = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0 120px;
  justify-content: center;
  align-items: center;
`;

export interface Enrichment {
  modelName: string;
  prompt: string;
  filterDescription: string;

  fields: Array<{
    id: number;
    name: string;
    type: string;
    description: string;
    required: boolean;
  }>;
  selectedModel: string;
  selectedMetadataFields: string[];
}

const StyledModal = styled.div`
  background-color: ${({ theme }) => theme.background.tertiary};
  box-shadow: ${({ theme }) => theme.boxShadow.superHeavy};
  border-radius: 16px;
  display: flex;
  flex-direction: row;
  height: 100%;
  flex-basis: 900px;
  z-index: 1001;
  overflow: hidden;
  max-height: 680px;
  box-sizing: border-box;
  position: relative;  // Ensure this is present
  pointer-events: auto;
  user-select: none;  // Prevent text selection

    & * {
    pointer-events: auto;
  }

  /* Add custom scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.background.tertiary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.background.quaternary || '#888'};
    border-radius: 4px;
    
    &:hover {
      background: ${({ theme }) => theme.background.noisy || '#666'};
    }
  }

  /* For Firefox */
  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.background.quaternary || '#888'} ${theme.background.tertiary}`};
`;

const ScrollableContent = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding-right: 8px; /* Compensate for scrollbar width */
`;

export const ArxEnrichmentModal = ({
  objectNameSingular,
  objectRecordId,
}: {
  objectNameSingular: string;
  objectRecordId: string;
}) => {
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useRecoilState(isArxEnrichModalOpenState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentJobId] = useRecoilState(currentJobIdState);
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [candidateFields, setCandidateFields] = useState<Array<{name: string, label: string}>>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const {
    setHotkeyScopeAndMemorizePreviousScope,
    goBackToPreviousHotkeyScope,
  } = usePreviousHotkeyScope();

  const closeModal = () => {
    setIsArxEnrichModalOpen(false);
    goBackToPreviousHotkeyScope();
  };

  const fetchCandidateFields = useCallback(async () => {
    try {
      console.log('fetching candidate fields in ArxEnrichmentModal');
      setIsLoadingFields(true);
      setApiError(null);
      
      if (currentJobId) {
        try {
          console.log('Fetching candidate fields for job ID:', currentJobId);
          
          const response = await axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-candidate-fields-by-job`,
            { jobId: currentJobId },
            { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPair?.accessToken?.token}`, } }
          );
          
          console.log('Response from fetch candidate fields:', response.data);
          
          if (response.data.status === 'Success' && response.data.candidateFields) {
            console.log('Received candidate fields:', response?.data?.candidateFields);
            setCandidateFields(response.data.candidateFields);
            
            // Update enrichments with jobId and candidateFields
            setEnrichments(prev => prev.map(enrichment => ({
              ...enrichment,
              jobId: currentJobId,
              candidateFields: response.data.candidateFields
            })));
          } else {
            console.warn('No fields returned from API or unexpected response format');
            setApiError('No custom fields found for this job');
          }
        } catch (error) {
          console.error('Error fetching candidate fields:', error);
          setApiError('Error fetching candidate fields');
        }
      } else {
        console.warn('No job ID available in Recoil state');
        setApiError('No job ID available');
      }
    } catch (error) {
      console.error('Error in fetchCandidateFields:', error);
      setApiError('Unexpected error occurred');
    } finally {
      setIsLoadingFields(false);
    }
  }, [currentJobId, tokenPair?.accessToken?.token, setEnrichments]);

  useEffect(() => {
    if (isArxEnrichModalOpen) {
      setHotkeyScopeAndMemorizePreviousScope(AppHotkeyScope.App, {
        commandMenu: false,
        goto: false,
        keyboardShortcutMenu: false,
      });
      fetchCandidateFields();
    }
  }, [isArxEnrichModalOpen, setHotkeyScopeAndMemorizePreviousScope, fetchCandidateFields]);

  if (!isArxEnrichModalOpen) {
    return null;
  }

  return (
    <>
      <StyledModalBackdrop onClick={closeModal} />
      <StyledModalContainer>
        <StyledAdjuster>
          <StyledModal onClick={(e) => e.stopPropagation()}>
            <ArxEnrichLeftSideContainer />
            <ArxEnrichRightSideContainer
              closeModal={closeModal}
              objectNameSingular={objectNameSingular}
              objectRecordId={objectRecordId}
              candidateFields={candidateFields}
              isLoadingFields={isLoadingFields}
              apiError={apiError}
            />
          </StyledModal>
        </StyledAdjuster>
      </StyledModalContainer>
    </>
  );
};