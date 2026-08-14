import { IconAlertCircle, IconLoader } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  activeAiFilterState,
  aiFiltersState,
  currentProjectIdState,
  isArxAiFilteringModalMinimizedState,
} from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import {
  buildSelectedMetadataFieldsForPersist,
  hasAiFilterContext,
} from '@/arx-ai-filtering/utils/resumeMetadata';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { type TableState, tableStateAtom } from '@/candidate-table/states/states';
import { refreshTableDataTriggerState } from '@/candidate-table/states/refreshTableDataTriggerState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

// import { useViewStates } from '@/views/hooks/internal/useViewStates';
// import { currentViewWithFiltersState } from '@/views/states/currentViewState';

import { ArxEnrichName } from './ArxEnrichName'; // Ensure this import is correct
import DynamicModelCreator from './DynamicModelCreator';

const StyledFormElement = styled.form<{ isMinimized?: boolean }>`
  align-items: ${({ isMinimized }) => isMinimized ? 'center' : 'flex-start'};
  display: flex;
  flex-direction: ${({ isMinimized }) => isMinimized ? 'row' : 'column'};
  flex-grow: 1;
  gap: ${({ isMinimized }) => isMinimized ? '0px' : '44px'};
  justify-content: ${({ isMinimized }) => isMinimized ? 'space-between' : 'flex-start'};
  left: -80px;
  overflow-y: ${({ isMinimized }) => isMinimized ? 'hidden' : 'auto'};
  position: relative;
  scroll-behavior: smooth;
`;

const ErrorContainer = styled.div`
  position: sticky;
  top: 0;
  width: 100%;
  z-index: 1;
`;

const StyledAllContainer = styled.div<{ isMinimized?: boolean }>`
  align-items: ${({ isMinimized }) => isMinimized ? 'center' : 'flex-end'};
  background-color: ${themeCssVariables.background.primary};
  display: flex;
  flex-direction: column;
  flex-shrink: 1;
  gap: ${({ isMinimized }) => isMinimized ? '0px' : '44px'};
  height: ${({ isMinimized }) => isMinimized ? '60px' : 'auto'};
  left: -200px;
  min-width: ${({ isMinimized }) => isMinimized ? 'auto' : '264px'};
  padding: ${({ isMinimized }) => isMinimized ? '0 16px' : '44px 32px 44px 32px'};
  width: ${({ isMinimized }) => isMinimized ? '100%' : 'calc(100% * (6 / 6))'};
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  font-family: ${themeCssVariables.font.family};
  list-style-type: none;
  margin: 0px;
  overflow-y: scroll;
  padding: 0;
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
  otherFieldKeys: Array<{name: string, label: string}>;
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
  align-items: center;
  background: rgba(255, 255, 255, 0.7);
  bottom: 0;
  display: flex;
  justify-content: center;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
  z-index: 1000;
`;

const ProgressContainer = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  padding: 1rem;
  position: sticky;
  top: 0;
  z-index: 10;
`;

const ProgressBar = styled.div<{ progress: number }>`
  background: ${themeCssVariables.border.color.medium};
  border-radius: 4px;
  height: 8px;
  margin: 0.5rem 0;
  overflow: hidden;
  width: 100%;

  &::after {
    background: ${themeCssVariables.color.blue};
    content: '';
    display: block;
    height: 100%;
    transition: width 0.3s ease;
    width: ${({ progress }) => progress}%;
  }
`;

const ProgressText = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
`;

const ProgressDetails = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: 0.75rem;
  justify-content: space-between;
`;

export const ArxEnrichRightSideContainer: React.FC<ArxEnrichRightSideContainerProps> = ({
  closeModal,
  objectNameSingular,
  objectRecordId,
  otherFieldKeys,
  isLoadingFields,
  apiError,
  aiFilteringProgress: propAiFilteringProgress,
  enrichmentProgress: propEnrichmentProgress,
  isConnected: propIsConnected,
  sseError: propSseError,
  reconnect: propReconnect,
  onRefresh
}) => {
  const [activeAiFilter, setActiveAiFilter] = useAtomState(activeAiFilterState);
  const [aiFilters, setAiFilters] = useAtomState(aiFiltersState);
  const [isArxAiFilteringModalMinimized, setIsArxAiFilteringModalMinimized] = useAtomState(isArxAiFilteringModalMinimizedState);
  const [tokenPair] = useAtomState(tokenPairState);
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
  const {
    enqueueInfoSnackBar,
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
  } = useSnackBar();
  const setRefreshTableDataTrigger = useSetAtomState(refreshTableDataTriggerState);
  const currentProjectId = useAtomStateValue(currentProjectIdState);
  const tableState = useAtomStateValue<TableState>(tableStateAtom);
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
    setIsArxAiFilteringModalMinimized(!isArxAiFilteringModalMinimized);
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
        enqueueInfoSnackBar({ message: enrichmentProgress.message });
      } else if (enrichmentProgress.step === 'completed') {
        enqueueSuccessSnackBar({ message: enrichmentProgress.message });
        // Clear progress state after completion and close modal
        setTimeout(() => {
          setEnrichmentProgressState(null);
          closeModal(); // Close modal when enrichment is completed
          // Call refresh to update the table data
          onRefresh?.();
        }, 3000);
      } else if (enrichmentProgress.step === 'error') {
        enqueueErrorSnackBar({ message: enrichmentProgress.message });
        setEnrichmentProgressState(null);
        // Don't close modal on error - let user see the error and retry
      }
    }
  }, [
    enrichmentProgress,
    enqueueInfoSnackBar,
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    closeModal,
    onRefresh,
  ]);

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setFieldErrors([]);
    setIsLoading(true);

    // Validate current enrichment
    const currentEnrichment = enrichments[activeEnrichment || 0];

    if (!currentEnrichment.modelName?.trim()) {
      setError('Model name is required');
      setIsLoading(false);
      return;
    }

    if (!currentEnrichment.prompt?.trim()) {
      setError('Prompt is required');
      setIsLoading(false);
      return;
    }

    if (!currentEnrichment.selectedModel || currentEnrichment.selectedModel=="") {
      console.log("currentEnrichment.selectedModel::",currentEnrichment.selectedModel)
      setError('Please select a model');
      setIsLoading(false);
      return;
    }

    if (!hasAiFilterContext(currentEnrichment)) {
      setError('Please select at least one column header or include resume');
      setIsLoading(false);
      return;
    }

    if (!currentEnrichment.fields?.length) {
      setError('Please create at least one field');
      setFieldErrors(['At least one field is required']);
      const formElement = document.getElementById('NewArxEnrichForm');
      formElement?.scrollTo({ top: 0, behavior: 'smooth' });
      setIsLoading(false);
      return;
    }

    console.log("All Enrichmetns", enrichments)

    const selectedRecordIds = getSelectedOrAllRecordIds();

    console.log("Selected Record Ids::selectedRecordIds", selectedRecordIds);
    console.log("Selected Record Ids from table state:", tableState?.selectedRowIds);
    console.log("All rows from table state:", tableState?.rawData);

    try {
      const aiFiltersForRequest = enrichments.map((enrichment) => ({
        ...enrichment,
        selectedMetadataFields: buildSelectedMetadataFieldsForPersist(enrichment),
      }));

      const response = await axios.post(REACT_APP_SERVER_BASE_URL+'/candidate-sourcing/process-ai-filters', {
        aiFilters: aiFiltersForRequest,
        objectNameSingular,
        projectId: currentProjectId,
        objectRecordId,
        selectedRecordIds
      }, {
        headers: {
          Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
        }
      });

      if (response.status === 200 || response.status === 201) {
        enqueueInfoSnackBar({
          message: 'AI filter processing started',
          options: { duration: 3000 },
        });
        // Don't close the modal immediately - let it stay open to show progress
        // The modal will be closed when enrichment is completed (handled in progress handler)
        setRefreshTableDataTrigger(true);
      }
    } catch (error) {
      console.error('Error creating enrichments:', error);
      setError('Failed to run AI filters');
      enqueueErrorSnackBar({
        message: 'Failed to create enrichment',
        options: { duration: 5000 },
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (

 <StyledAllContainer id={`${objectNameSingular}: ${objectRecordId}`} isMinimized={isArxAiFilteringModalMinimized}>
    <StyledFormElement onSubmit={handleSubmit} id="NewArxEnrichForm" isMinimized={isArxAiFilteringModalMinimized}>
    {isLoading && (
        <LoadingOverlay>
          <IconLoader size={32} className="animate-spin" />
        </LoadingOverlay>
      )}

      <ArxEnrichName
        closeModal={closeModal}
        onSubmit={handleSubmit}
        index={activeEnrichment || 0}
        onError={handleError}
        isMinimized={isArxAiFilteringModalMinimized}
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

      {!isArxAiFilteringModalMinimized && (
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
                otherFieldKeys={otherFieldKeys}
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
