import styled from '@emotion/styled';
import { useRecoilState, useRecoilValue } from 'recoil';
import { activeEnrichmentState, enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import axios from 'axios';

import DynamicModelCreator from './DynamicModelCreator';
import { ArxEnrichName } from './ArxEnrichName'; // Ensure this import is correct
import { useViewStates } from '@/views/hooks/internal/useViewStates';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { currentViewWithFiltersState } from '@/views/states/currentViewState';
import { selectedRecordsForModalState } from '@/object-record/states/selectedRecordsState';
import { useState } from 'react';
import { IconAlertCircle } from 'twenty-ui';

// In ArxEnrichRightSideContainer
const StyledFormElement = styled.form`
  display: flex;
  gap: 44px;
  flex-grow: 1;
  flex-direction: column;
  overflow-y: auto;
  scroll-behavior: smooth;
  position: relative;
`;

const ErrorContainer = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
  width: 100%;
`;


const StyledAllContainer = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: 44px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (5 / 6));
  min-width: 264px;
  flex-shrink: 1;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  padding: 0;
  font-family: ${({ theme }) => theme.font.family};
  margin: 0px;
  list-style-type: none;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

const ErrorAlert = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #dc2626;
  position: sticky; // Add this
  top: 0; // Add this
  z-index: 1; // Add this
  margin-bottom: 1rem; // Add this
`;


interface ArxEnrichRightSideContainerProps {
  closeModal: () => void;
  objectNameSingular: string;
  objectRecordId: string;
}

export const ArxEnrichRightSideContainer: React.FC<ArxEnrichRightSideContainerProps> = ({ 
  closeModal, 
  objectNameSingular, 
  objectRecordId,
}) => {
  const [activeEnrichment, setActiveEnrichment] = useRecoilState(activeEnrichmentState);
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [error, setError] = useState<string>(''); // Add this line
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  
  
  const handleError = (newError: string) => {
    setError(newError);
    if (newError) {
      const formElement = document.getElementById('NewArxEnrichForm');
      formElement?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  


  const currentViewId = location.href.split("view=")[1];
  const {
    canPersistViewSelector,
    isViewBarExpandedState,
    availableFilterDefinitionsState,
    availableSortDefinitionsState,
  } = useViewStates(currentViewId);

  
  const availableSortDefinitions = useRecoilValue(
    availableSortDefinitionsState,
  );
  
  const availableFilterDefinitions = useRecoilValue(
    availableFilterDefinitionsState,
  );

  const currentViewWithCombinedFiltersAndSorts = useRecoilValue(currentViewWithFiltersState);
  const selectedRecordIds = useRecoilValue(selectedRecordsForModalState);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(''); // Clear previous errors
    setFieldErrors([]); // Clear previous field errors
    
    // Validate current enrichment
    const currentEnrichment = enrichments[activeEnrichment || 0];
    
    if (!currentEnrichment.modelName?.trim()) {
      setError('Model name is required');
      return;
    }
  
    if (!currentEnrichment.prompt?.trim()) {
      setError('Prompt is required');
      return;
    }
  
    if (!currentEnrichment.selectedModel || currentEnrichment.selectedModel=="") {
      console.log("currentEnrichment.selectedModel::",currentEnrichment.selectedModel)
      setError('Please select a model');
      return;
    }
  
    if (!currentEnrichment.selectedMetadataFields?.length) {
      setError('Please select at least one metadata field');
      return;
    }
  
    if (!currentEnrichment.fields?.length) {
      setError('Please create at least one field');
      setFieldErrors(['At least one field is required']);
      const formElement = document.getElementById('NewArxEnrichForm');
      formElement?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    console.log("All Enrichmetns", enrichments)
    
    try {
      const response = await axios.post(process.env.REACT_APP_SERVER_BASE_URL+'/candidate-sourcing/create-enrichments', {
        enrichments,
        objectNameSingular,
        availableSortDefinitions,
        availableFilterDefinitions,
        objectRecordId,
        selectedRecordIds
      }, {
        headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
      });
  
      if (response.status === 200 || response.status === 201) {
        console.log('Enrichments created successfully:', response.data);
        closeModal();
      }
    } catch (error) {
      console.error('Error creating enrichments:', error);
      setError('Failed to create enrichment');
    }
  };
  

  return (

 <StyledAllContainer id={`${objectNameSingular}: ${objectRecordId}`}>
    <StyledFormElement onSubmit={handleSubmit} id="NewArxEnrichForm">
      <ArxEnrichName 
        closeModal={closeModal}
        onSubmit={handleSubmit}
        index={activeEnrichment || 0}
        onError={handleError}

      />
      <ErrorContainer>
        {(error || fieldErrors.length > 0) && (
          <ErrorAlert>
            <IconAlertCircle size={16} stroke={1.5} />
            {error || fieldErrors.join(', ')}
          </ErrorAlert>
        )}
      </ErrorContainer>
      <StyledQuestionsContainer type="1">
        {activeEnrichment !== null && activeEnrichment < enrichments.length && (
          <DynamicModelCreator 
            objectNameSingular={objectNameSingular} 
            index={activeEnrichment}
            onError={handleError}

          />
        )}
      </StyledQuestionsContainer>
    </StyledFormElement>
  </StyledAllContainer>
);

};