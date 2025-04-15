import { activeEnrichmentState, enrichmentsState, recordsToEnrichState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import styled from '@emotion/styled';
import axios from 'axios';
import { useRecoilState, useRecoilValue } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { selectedRecordsForModalState } from '@/object-record/states/selectedRecordsState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
// import { useViewStates } from '@/views/hooks/internal/useViewStates';
// import { currentViewWithFiltersState } from '@/views/states/currentViewState';
import { IconLoader2 } from '@tabler/icons-react';
import { useState } from 'react';
import { IconAlertCircle } from 'twenty-ui';
import { ArxEnrichName } from './ArxEnrichName'; // Ensure this import is correct
import DynamicModelCreator from './DynamicModelCreator';

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
const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;


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
    // Add loading state and style
  const [isLoading, setIsLoading] = useState(false);
  const { enqueueSnackBar } = useSnackBar();

  
  const handleError = (newError: string) => {
    setError(newError);
    if (newError) {
      const formElement = document.getElementById('NewArxEnrichForm');
      formElement?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  const recordsToEnrich = useRecoilValue(recordsToEnrichState);



  const currentViewId = location.href.split("view=")[1];
  // const {
  //   canPersistViewSelector,
  //   isViewBarExpandedState,
  //   availableFilterDefinitionsState,
  //   availableSortDefinitionsState,
  // } = useViewStates(currentViewId);

  
  // const availableSortDefinitions = useRecoilValue(
  //   availableSortDefinitionsState,
  // );
  
  // const availableFilterDefinitions = useRecoilValue(
  //   availableFilterDefinitionsState,
  // );

  // const currentViewWithCombinedFiltersAndSorts = useRecoilValue(currentViewWithFiltersState);
  const selectedRecords = useRecoilValue(selectedRecordsForModalState);
  console.log("These are the selected record ids", selectedRecords, "from selectedRecordsForModalState")

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setFieldErrors([]);
    setIsLoading(true);


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

    // const jobId = useRecoilValue(jobIdState);
    console.log("All Enrichmetns", enrichments)

    let selectedRecordIds = (recordsToEnrich?.length || 0) > 0 ? recordsToEnrich : selectedRecords;
    console.log("Selected Record Ids::selectedRecordIds", selectedRecordIds)
    console.log("Selected Record Ids:::recordsToEnrich", recordsToEnrich)
    console.log("Selected Record Ids:::selectedRecords", selectedRecords)
    try {
      const response = await axios.post(process.env.REACT_APP_SERVER_BASE_URL+'/candidate-sourcing/create-enrichments', {
        enrichments,
        objectNameSingular,
        // jobId,
        // availableSortDefinitions,
        // availableFilterDefinitions,
        objectRecordId,
        // selectedRecordIds,
        selectedRecordIds
      }, {
        headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
      });
  
      if (response.status === 200 || response.status === 201) {
        enqueueSnackBar('Enrichment created successfully', {
          variant: SnackBarVariant.Success,
          duration: 3000,
        });
        closeModal();
      }
    } catch (error) {
      console.error('Error creating enrichments:', error);
      setError('Failed to create enrichment');
      enqueueSnackBar('Failed to create enrichment', {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
    };
  

  return (

 <StyledAllContainer id={`${objectNameSingular}: ${objectRecordId}`}>
    <StyledFormElement onSubmit={handleSubmit} id="NewArxEnrichForm">
    {isLoading && (
        <LoadingOverlay>
          <IconLoader2 size={32} className="animate-spin" />
        </LoadingOverlay>
      )}

      <ArxEnrichName 
        closeModal={closeModal}
        onSubmit={handleSubmit}
        index={activeEnrichment || 0}
        onError={handleError}

      />

      <StyledQuestionsContainer type="1">
        {activeEnrichment !== null && activeEnrichment < enrichments.length && (
          <DynamicModelCreator 
            objectNameSingular={objectNameSingular} 
            index={activeEnrichment}
            onError={handleError}

          />
        )}
      </StyledQuestionsContainer>
      <ErrorContainer>
        {(error || fieldErrors.length > 0) && (
          <ErrorAlert>
            <IconAlertCircle size={16} stroke={1.5} />
            {error || fieldErrors.join(', ')}
          </ErrorAlert>
        )}
      </ErrorContainer>
    </StyledFormElement>
  </StyledAllContainer>
);

};