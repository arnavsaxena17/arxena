import { activeAiFilterState, aiFiltersState, isArxAiFilteringModalMinimizedState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import styled from '@emotion/styled';
import axios from 'axios';
import { useEffect } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { TableState, tableStateAtom } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
// import { useViewStates } from '@/views/hooks/internal/useViewStates';
// import { currentViewWithFiltersState } from '@/views/states/currentViewState';
import { currentJobIdState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { IconLoader2 } from '@tabler/icons-react';
import { useState } from 'react';
import { IconAlertCircle } from 'twenty-ui';
import { refreshTableDataTriggerState } from '../../candidate-table/states/refreshTableDataTriggerState';
import { ArxEnrichName } from './ArxEnrichName'; // Ensure this import is correct
import DynamicModelCreator from './DynamicModelCreator';

const StyledFormElement = styled.form<{ isMinimized?: boolean }>`
  display: flex;
  gap: ${({ isMinimized }) => isMinimized ? '0px' : '44px'};
  flex-grow: 1;
  flex-direction: ${({ isMinimized }) => isMinimized ? 'row' : 'column'};
  overflow-y: ${({ isMinimized }) => isMinimized ? 'hidden' : 'auto'};
  scroll-behavior: smooth;  
  position: relative;
  left: -80px;
  align-items: ${({ isMinimized }) => isMinimized ? 'center' : 'flex-start'};
  justify-content: ${({ isMinimized }) => isMinimized ? 'space-between' : 'flex-start'};
`;

const ErrorContainer = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
  width: 100%;
`;


const StyledAllContainer = styled.div<{ isMinimized?: boolean }>`
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  left: -200px;
  gap: ${({ isMinimized }) => isMinimized ? '0px' : '44px'};
  padding: ${({ isMinimized }) => isMinimized ? '0 16px' : '44px 32px 44px 32px'};
  width: ${({ isMinimized }) => isMinimized ? '100%' : 'calc(100% * (6 / 6))'};
  min-width: ${({ isMinimized }) => isMinimized ? 'auto' : '264px'};
  flex-shrink: 1;
  height: ${({ isMinimized }) => isMinimized ? '60px' : 'auto'};
  align-items: ${({ isMinimized }) => isMinimized ? 'center' : 'flex-end'};
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
  candidateFields: Array<{name: string, label: string}>;
  isLoadingFields: boolean;
  apiError: string | null;
  aiFilteringProgress?: any;
  /** @deprecated use aiFilteringProgress */
  enrichmentProgress?: any;
  isConnected?: boolean;
  sseError?: string | null;
  reconnect?: () => void;
  onRefresh?: () => void;
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

const ProgressContainer = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
  background: ${({ theme }) => theme.background.primary};
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
`;

const ProgressBar = styled.div<{ progress: number }>`
  width: 100%;
  height: 8px;
  background: ${({ theme }) => theme.border.color.medium};
  border-radius: 4px;
  overflow: hidden;
  margin: 0.5rem 0;
  
  &::after {
    content: '';
    display: block;
    width: ${({ progress }) => progress}%;
    height: 100%;
    background: ${({ theme }) => theme.color.blue60};
    transition: width 0.3s ease;
  }
`;

const ProgressText = styled.div`
  font-size: 0.875rem;
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-bottom: 0.25rem;
`;

const ProgressDetails = styled.div`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;


export const ArxEnrichRightSideContainer: React.FC<ArxEnrichRightSideContainerProps> = ({ 
  closeModal, 
  objectNameSingular, 
  objectRecordId,
  candidateFields,
  isLoadingFields,
  apiError,
  aiFilteringProgress: propAiFilteringProgress,
  enrichmentProgress: propEnrichmentProgress,
  isConnected: propIsConnected,
  sseError: propSseError,
  reconnect: propReconnect,
  onRefresh
}) => {
  const [activeEnrichment, setActiveEnrichment] = useRecoilState(activeAiFilterState);
  const [enrichments, setEnrichments] = useRecoilState(aiFiltersState);
  const [isMinimized, setIsMinimized] = useRecoilState(isArxAiFilteringModalMinimizedState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [enrichmentProgressState, setEnrichmentProgressState] = useState<{
    step: string;
    message: string;
    progress_percentage?: number;
    total_records?: number;
    processed_records?: number;
    current_enrichment?: number;
    total_enrichments?: number;
  } | null>(null);
  const { enqueueSnackBar } = useSnackBar();
  const setRefreshTableDataTrigger = useSetRecoilState(refreshTableDataTriggerState);
  const jobId = useRecoilValue(currentJobIdState);
  const tableState = useRecoilValue<TableState>(tableStateAtom);
  // Use SSE data from props (passed from modal level)
  const enrichmentProgress = propAiFilteringProgress ?? propEnrichmentProgress;
  const isConnected = propIsConnected || false;
  const sseError = propSseError;
  const reconnect = propReconnect || (() => {});

  const handleError = (newError: string) => {
    setError(newError);
    if (newError) {
      const formElement = document.getElementById('NewArxEnrichForm');
      formElement?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  // Get selected or all record IDs from table state
  const getSelectedOrAllRecordIds = () => {
    return tableState?.selectedRowIds?.length > 0 
      ? tableState.selectedRowIds 
      : tableState?.rawData?.map(row => row.id) || [];
  };

  // Log selected records when they change
  useEffect(() => {
    const selectedIds = getSelectedOrAllRecordIds();
    console.log("ArxEnrichRightSideContainer - selected records updated:", selectedIds);
  }, [tableState]);

  // Handle enrichment progress updates from SSE
  useEffect(() => {
    if (enrichmentProgress) {
      console.log('ArxEnrichRightSideContainer received enrichment progress:', enrichmentProgress);
      setEnrichmentProgressState(enrichmentProgress);
      
      // Show progress in snackbar for important steps
      if (enrichmentProgress.step === 'started') {
        enqueueSnackBar(enrichmentProgress.message, { variant: SnackBarVariant.Info });
      } else if (enrichmentProgress.step === 'completed') {
        enqueueSnackBar(enrichmentProgress.message, { variant: SnackBarVariant.Success });
        // Clear progress state after completion and close modal
        setTimeout(() => {
          setEnrichmentProgressState(null);
          closeModal(); // Close modal when enrichment is completed
          // Call refresh to update the table data
          onRefresh?.();
        }, 3000);
      } else if (enrichmentProgress.step === 'error') {
        enqueueSnackBar(enrichmentProgress.message, { variant: SnackBarVariant.Error });
        setEnrichmentProgressState(null);
        // Don't close modal on error - let user see the error and retry
      }
    }
  }, [enrichmentProgress, enqueueSnackBar, closeModal]);

  // Debug SSE connection status
  useEffect(() => {
    console.log('🔗 SSE Connection Status:', {
      isConnected,
      sseError,
      hasProgress: !!enrichmentProgress,
      componentMounted: true
    });
  }, [isConnected, sseError, enrichmentProgress]);

  // Force SSE connection when component mounts
  useEffect(() => {
    console.log('🔗 ArxEnrichRightSideContainer mounted, ensuring SSE connection is active');
    // The useEnrichmentProgress hook should automatically establish connection
  }, []);

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

    console.log("All Enrichmetns", enrichments)

    const selectedRecordIds = getSelectedOrAllRecordIds();
    
    console.log("Selected Record Ids::selectedRecordIds", selectedRecordIds);
    console.log("Selected Record Ids from table state:", tableState?.selectedRowIds);
    console.log("All rows from table state:", tableState?.rawData);

    try {
      const response = await axios.post(process.env.REACT_APP_SERVER_BASE_URL+'/candidate-sourcing/process-ai-filters', {
        aiFilters: enrichments,
        objectNameSingular,
        jobId,
        objectRecordId,
        selectedRecordIds
      }, {
        headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
      });
  
      if (response.status === 200 || response.status === 201) {
        enqueueSnackBar('AI filter processing started', {
          variant: SnackBarVariant.Info,
          duration: 3000,
        });
        // Don't close the modal immediately - let it stay open to show progress
        // The modal will be closed when enrichment is completed (handled in progress handler)
        setRefreshTableDataTrigger(true);
      }
    } catch (error) {
      console.error('Error creating enrichments:', error);
      setError('Failed to run AI filters');
      enqueueSnackBar('Failed to create enrichment', {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };
  

  return (

 <StyledAllContainer id={`${objectNameSingular}: ${objectRecordId}`} isMinimized={isMinimized}>
    <StyledFormElement onSubmit={handleSubmit} id="NewArxEnrichForm" isMinimized={isMinimized}>
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
        isMinimized={isMinimized}
        onToggleMinimize={handleToggleMinimize}
      />

      {/* Progress Display - Show even when minimized */}
      {enrichmentProgressState && (
        <ProgressContainer>
          <ProgressText>{enrichmentProgressState.message}</ProgressText>
          {enrichmentProgressState.progress_percentage !== undefined && (
            <ProgressBar progress={enrichmentProgressState.progress_percentage} />
          )}
          <ProgressDetails>
            {enrichmentProgressState.current_enrichment && enrichmentProgressState.total_enrichments && (
              <span>
                Enrichment {enrichmentProgressState.current_enrichment} of {enrichmentProgressState.total_enrichments}
              </span>
            )}
            {enrichmentProgressState.processed_records && enrichmentProgressState.total_records && (
              <span>
                {enrichmentProgressState.processed_records} / {enrichmentProgressState.total_records} records
              </span>
            )}
            {enrichmentProgressState.progress_percentage !== undefined && (
              <span>{enrichmentProgressState.progress_percentage}%</span>
            )}
          </ProgressDetails>
        </ProgressContainer>
      )}

      {!isMinimized && (
        <>

          {/* SSE Connection Status Debug */}
          {/* {process.env.NODE_ENV === 'development' && (
            <div style={{ 
              padding: '8px', 
              margin: '8px 0', 
              backgroundColor: isConnected ? '#d4edda' : '#f8d7da', 
              border: `1px solid ${isConnected ? '#c3e6cb' : '#f5c6cb'}`,
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              SSE Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}
              {sseError && <div>Error: {sseError}</div>}
              <button 
                onClick={reconnect} 
                style={{ 
                  marginLeft: '8px', 
                  padding: '2px 6px', 
                  fontSize: '10px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Reconnect
              </button>
            </div>
          )}
           */}
          <StyledQuestionsContainer type="1">
            { activeEnrichment !== null && activeEnrichment < enrichments?.length && (
              <DynamicModelCreator 
                objectNameSingular={objectNameSingular} 
                index={activeEnrichment}
                onError={handleError}
                candidateFields={candidateFields}
                isLoadingFields={isLoadingFields}
                apiError={apiError}
              />
            )}
          </StyledQuestionsContainer>
          <ErrorContainer>
            {(error || fieldErrors?.length > 0) && (
              <ErrorAlert>
                <IconAlertCircle size={16} stroke={1.5} />
                {error || fieldErrors?.join(', ')}
              </ErrorAlert>
            )}
          </ErrorContainer>
        </>
      )}
    </StyledFormElement>
  </StyledAllContainer>
);

};