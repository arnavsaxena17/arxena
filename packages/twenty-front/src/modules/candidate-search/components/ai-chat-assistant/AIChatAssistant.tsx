import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { tokenPairState } from '@/auth/states/tokenPairState';
// import { useSearchPlanFilters } from '@/candidate-search/hooks/useSearchPlanFilters';
import { useSearchPlanGeneration } from '@/candidate-search/hooks/useSearchPlanGeneration';
// import { useSearchPlanManager } from '@/candidate-search/hooks/useSearchPlanManager';
import { searchConfigState } from '@/candidate-search/states/searchConfigState';
import { EnrichmentsResponse, FiltersResponse, SearchParametersResponse } from '@/candidate-search/types/candidate-search.types';
import { chatMessagesSelector, resolvedParametersSelector } from '@/candidate-table/states/states';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useDestroyOneRecord } from '@/object-record/hooks/useDestroyOneRecord';
import { useFindManyAttachments } from '@/object-record/hooks/useFindManyAttachments';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { Loader } from 'twenty-ui';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { JDAttachmentStrip } from './JDAttachmentStrip';
import { LinkedInRequestStatus } from './LinkedInRequestStatus';

const StyledActionBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
  justify-content: center;
  flex-wrap: wrap;
`;

const StyledLoaderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
  justify-content: center;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledActionButton = styled.button<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: ${({ disabled }) => disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ disabled }) => disabled ? 0.5 : 1};
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
  }
  
  &:disabled {
    cursor: not-allowed;
  }
`;

const StyledChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

// Use the ChatMessage type from the state
type ChatMessage = {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'search_parameters' | 'enrichments' | 'filters';
  content: string;
  timestamp: Date;
  metadata?: {
    searchParameters?: SearchParametersResponse;
    enrichments?: EnrichmentsResponse;
    filters?: FiltersResponse;
    actionButtons?: Array<{
      id: string;
      label: string;
      action: string;
      disabled?: boolean;
    }>;
  };
};

type AIChatAssistantProps = {
  parsedJD: ParsedJD;
  onJDUpload?: (file: File) => Promise<void>;
  onEnrichmentCreate?: (enrichments: any[]) => void;
  onJDRemove?: () => Promise<void>;
  onJDReplace?: (files: File[]) => Promise<void>;
  onParsedJDUpdate?: (updatedParsedJD: ParsedJD) => void;
};

export const AIChatAssistant = ({
  parsedJD,
  onJDUpload,
  onEnrichmentCreate,
  onJDRemove,
  onJDReplace,
  onParsedJDUpdate,
}: AIChatAssistantProps) => {
  const [enrichments] = useRecoilState(enrichmentsState);
  const { enqueueSnackBar } = useSnackBar();
  const { destroyOneRecord } = useDestroyOneRecord({ objectNameSingular: 'attachment' });
  const { findManyAttachments } = useFindManyAttachments();
  const { uploadAttachmentFile } = useUploadAttachmentFile();

  const [chatMessages, setChatMessages] = useRecoilState(chatMessagesSelector);
  const [resolvedParameters, setResolvedParameters] = useRecoilState(resolvedParametersSelector);
  const [searchConfig, setSearchConfig] = useRecoilState(searchConfigState);
  const [, setParsedJD] = useRecoilState(parsedJDSelector);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedSearchVariation, setSelectedSearchVariation] = useState<string | null>(null);
  const [currentSearchParameters, setCurrentSearchParameters] = useState<SearchParametersResponse | null>(null);
  const [currentEnrichments, setCurrentEnrichments] = useState<EnrichmentsResponse | null>(null);
  const searchPlanGeneration = useSearchPlanGeneration();
  const tokenPair = useRecoilValue(tokenPairState);

  // Fetch attachments for the current job using parsedJD.id
  useEffect(() => {
    const fetchAttachments = async () => {
      if (!parsedJD?.id) {
        setAttachments([]);
        return;
      }

      try {
        const fetchedAttachments = await findManyAttachments({
          filter: { jobId: { eq: parsedJD.id } },
          orderBy: [{ createdAt: 'DescNullsFirst' }],
        });
        setAttachments(fetchedAttachments);
        console.log('AIChatAssistant - Fetched attachments for job:', parsedJD.id, fetchedAttachments);
      } catch (error) {
        console.error('Error fetching attachments:', error);
        setAttachments([]);
      }
    };

    fetchAttachments();
  }, [parsedJD?.id, findManyAttachments]);

  // Initialize chat with welcome message
  useEffect(() => {
    if (chatMessages.length === 0) {
      setChatMessages([{
        id: 'welcome',
        type: 'assistant',
        content: 'Welcome! I can help you create complete search plans (parameters + enrichments + filters), upload job descriptions, and set up individual components. Try saying "generate complete plan" or use the action buttons below!',
        timestamp: new Date(),
      }]);
    }
  }, []);

  const addMessage = useCallback(async (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    
    // Update local state
    setChatMessages(prev => [...prev, newMessage]);
    
    // Save to backend if we have a searchFilterId
    if (parsedJD?.searchFilters?.[0]?.id && tokenPair?.accessToken?.token) {
      try {
        console.log ("addMessage - Saving chat message to backend::");
        // await sendChatMessage(message.content, parsedJD.searchFilters[0].id, tokenPair);
      } catch (error) {
        console.error('Error saving chat message to backend:', error);
        // Don't show error to user as the message is still added locally
      }
    }
  }, [setChatMessages, parsedJD?.searchFilters, tokenPair]);

  // Handle natural language enrichment editing

  // Function to remove existing attachments for a job
  const removeExistingAttachments = useCallback(async (jobId: string) => {
    try {
      // Delete all existing attachments
      for (const attachment of attachments) {
        if (attachment.id) {
          await destroyOneRecord(attachment.id);
        }
      }
    } catch (error) {
      console.error('Error removing existing attachments:', error);
    }
  }, [destroyOneRecord, attachments]);

  // Handle JD file removal
  const handleJDRemove = useCallback(async () => {
    if (!parsedJD?.id) return;
    
    try {
      setIsUploadingFile(true);
      
      // Remove existing attachments
      await removeExistingAttachments(parsedJD.id);
      
      // Refresh attachments list
      const fetchedAttachments = await findManyAttachments({
        filter: { jobId: { eq: parsedJD.id } },
        orderBy: [{ createdAt: 'DescNullsFirst' }],
      });
      setAttachments(fetchedAttachments);
      
      await addMessage({
        type: 'assistant',
        content: 'Job description file removed successfully. You can upload a new one using the replace button.',
      });
      
      enqueueSnackBar('Job description file removed successfully', {
        variant: SnackBarVariant.Success,
      });
      
      if (onJDRemove) {
        await onJDRemove();
      }
    } catch (error) {
      console.error('Error removing JD file:', error);
      await addMessage({
        type: 'assistant',
        content: 'Sorry, I encountered an error while removing the job description file.',
      });
      enqueueSnackBar('Failed to remove job description file', {
        variant: SnackBarVariant.Error,
      });
    } finally {
      setIsUploadingFile(false);
    }
  }, [parsedJD?.id, attachments, removeExistingAttachments, findManyAttachments, setAttachments, addMessage, enqueueSnackBar, onJDRemove]);

  // Handle JD file replacement
  const handleJDReplace = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    try {
      setIsUploadingFile(true);
      
      await addMessage({
        type: 'user',
        content: `Replacing JD with: ${file.name}`,
      });
      
      if (!parsedJD?.id) {
        throw new Error('No job ID available for file upload');
      }
      
      // Remove existing attachments first
      await removeExistingAttachments(parsedJD.id);
      
      // Upload new attachment
      const { attachmentAbsoluteURL } = await uploadAttachmentFile(file, {
        targetObjectNameSingular: CoreObjectNameSingular.Job,
        id: parsedJD.id,
      });
      
      // Refresh attachments list
      const fetchedAttachments = await findManyAttachments({
        filter: { jobId: { eq: parsedJD.id } },
        orderBy: [{ createdAt: 'DescNullsFirst' }],
      });
      setAttachments(fetchedAttachments);
      
      await addMessage({
        type: 'assistant',
        content: 'Job description file replaced successfully! I\'m analyzing the new file to update the search plan...',
      });
      
      enqueueSnackBar('Job description file replaced successfully', {
        variant: SnackBarVariant.Success,
      });
      
      if (onJDReplace) {
        await onJDReplace(files);
      } else if (onJDUpload) {
        await onJDUpload(file);
      }
      
    } catch (error) {
      console.error('Error replacing JD file:', error);
      await addMessage({
        type: 'assistant',
        content: 'Sorry, I encountered an error while replacing the job description file.',
      });
      enqueueSnackBar('Failed to replace job description file', {
        variant: SnackBarVariant.Error,
      });
    } finally {
      setIsUploadingFile(false);
    }
  }, [parsedJD?.id, removeExistingAttachments, uploadAttachmentFile, findManyAttachments, setAttachments, addMessage, enqueueSnackBar, onJDReplace, onJDUpload]);

  // Search Plan Generation Handlers
  const handleGenerateSearchParameters = useCallback(async (
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    searchCategory: 'people' | 'companies' | 'jobs'
  ) => {
    if (!parsedJD?.searchFilters?.[0]?.id) {
      enqueueSnackBar('No search filter found. Please create a search filter first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      const result = await searchPlanGeneration.generateSearchParameters(
        parsedJD.searchFilters[0].id,
        searchType,
        searchCategory
      );
      console.log (`handleGenerateSearchParameters - Result: ${JSON.stringify(result, null, 2)}`);

      if (result) {
        setCurrentSearchParameters(result);
        
        // Update resolved parameters with the resolved search parameters (LinkedIn IDs + display info)
        // This will make them available in the search form
        const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
        const resolvedParams = result.variations[0]?.resolvedSearchParameters || {};
        
        console.log('AIChatAssistant - Setting resolved parameters:', {
          parameterKey,
          resolvedParams,
          previousResolvedParameters: resolvedParameters
        });
        
        setResolvedParameters((prevResolved: any) => {
          const updated = {
            ...prevResolved,
            [parameterKey]: resolvedParams
          };
          console.log('AIChatAssistant - Updated resolved parameters:', updated);
          return updated;
        });
        
        // Also update parsedJD state to ensure PRIORITY 1 in resolvedParametersSelector returns correct data
        if (parsedJD) {
          setParsedJD(prev => {
            if (!prev) return null;
            
            const updatedSearchParameters = [...(prev.searchParameters || [])];
            
            // Find existing search parameter entry or create new one
            let searchParamIndex = updatedSearchParameters.findIndex(
              param => param.resolvedSearchParameters && 
              Object.keys(param.resolvedSearchParameters).some(key => 
                key.includes(parameterKey.toLowerCase())
              )
            );
            
            if (searchParamIndex === -1) {
              // Create new search parameter entry
              updatedSearchParameters.push({
                generatedSearchParameters: {},
                resolvedSearchParameters: {}
              });
              searchParamIndex = updatedSearchParameters.length - 1;
            }
            
            // Update the resolved search parameters
            updatedSearchParameters[searchParamIndex] = {
              ...updatedSearchParameters[searchParamIndex],
              resolvedSearchParameters: {
                ...updatedSearchParameters[searchParamIndex].resolvedSearchParameters,
                [parameterKey]: resolvedParams
              }
            };
            
            console.log('AIChatAssistant - Updated parsedJD with resolved parameters:', {
              parameterKey,
              resolvedParams,
              updatedSearchParameters
            });
            
            return {
              ...prev,
              searchParameters: updatedSearchParameters
            };
          });
        }
        
        await addMessage({
          type: 'search_parameters',
          content: `Generated ${result.variations.length} search strategy variations for ${searchType} ${searchCategory} search. The parameters have been applied to your search form.`,
          metadata: {
            searchParameters: result,
            actionButtons: [
              {
                id: 'select-variation',
                label: 'Select Variation',
                action: 'select_search_variation'
              },
              {
                id: 'generate-enrichments',
                label: 'Generate Enrichments',
                action: 'generate_enrichments'
              }
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error generating search parameters:', error);
      enqueueSnackBar('Failed to generate search parameters', {
        variant: SnackBarVariant.Error,
      });
    }
  }, [parsedJD?.searchFilters, searchPlanGeneration, addMessage, enqueueSnackBar]);

  const handleGenerateEnrichments = useCallback(async () => {
    if (!parsedJD?.searchFilters?.[0]?.id) {
      enqueueSnackBar('No search filter found. Please create a search filter first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      const result = await searchPlanGeneration.generateEnrichments(
        parsedJD.searchFilters[0].id
      );

      console.log (`handleGenerateEnrichments - Result: ${JSON.stringify(result, null, 2)}`);

      if (result) {
        setCurrentEnrichments(result);
        await addMessage({
          type: 'enrichments',
          content: `Generated ${result.enrichments.length} enrichment configurations for candidate evaluation.`,
          metadata: {
            enrichments: result,
            actionButtons: [
              {
                id: 'execute-enrichments',
                label: 'Execute Enrichments',
                action: 'execute_enrichments'
              },
              {
                id: 'generate-filters',
                label: 'Generate Filters',
                action: 'generate_filters'
              }
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error generating enrichments:', error);
      enqueueSnackBar('Failed to generate enrichments', {
        variant: SnackBarVariant.Error,
      });
    }
  }, [parsedJD?.searchFilters, searchPlanGeneration, addMessage, enqueueSnackBar]);

  const handleGenerateFilters = useCallback(async () => {
    if (!parsedJD?.searchFilters?.[0]?.id || !currentEnrichments) {
      enqueueSnackBar('No search filter or enrichments found. Please generate enrichments first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      const result = await searchPlanGeneration.generateFilters(
        parsedJD.searchFilters[0].id,
        currentEnrichments
      );

      console.log (`handleGenerateFilters - Result: ${JSON.stringify(result, null, 2)}`);

      if (result) {
        await addMessage({
          type: 'filters',
          content: `Generated filter strategy with ${result.handsontableFilters.length} Handsontable filters and ${result.candidateSearchFilters.length} CandidateSearch filters.`,
          metadata: {
            filters: result,
            actionButtons: [
              {
                id: 'apply-filters',
                label: 'Apply Filters',
                action: 'apply_filters'
              }
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error generating filters:', error);
      enqueueSnackBar('Failed to generate filters', {
        variant: SnackBarVariant.Error,
      });
    }
  }, [parsedJD?.searchFilters, currentEnrichments, searchPlanGeneration, addMessage, enqueueSnackBar]);

  const handleSearchVariationSelect = useCallback((variationId: string) => {
    setSelectedSearchVariation(variationId);
    
    // Update resolved parameters with the selected variation
    if (currentSearchParameters) {
      const selectedVariation = currentSearchParameters.variations.find(v => v.id === variationId);
      if (selectedVariation) {
        const searchType = currentSearchParameters.metadata.searchType;
        const searchCategory = currentSearchParameters.metadata.searchCategory;
        
        // Update searchConfigState to match the variation's search type and category
        setSearchConfig({
          searchType: searchType as any,
          searchCategory: searchCategory as any,
        });
        
        const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
        const resolvedParams = selectedVariation.resolvedSearchParameters || selectedVariation.searchParameters || {};
        setResolvedParameters((prevResolved: any) => ({
          ...prevResolved,
          [parameterKey]: resolvedParams
        }));
        
        enqueueSnackBar(`Search variation "${selectedVariation.name}" selected and applied to search form`, {
          variant: SnackBarVariant.Success,
        });
      }
    }
  }, [enqueueSnackBar, currentSearchParameters, setResolvedParameters, setSearchConfig]);

  const handleExecuteEnrichments = useCallback(() => {
    enqueueSnackBar('Enrichments execution started', {
      variant: SnackBarVariant.Success,
    });
    // TODO: Implement enrichment execution
  }, [enqueueSnackBar]);

  const handleApplyFilters = useCallback(() => {
    enqueueSnackBar('Filters applied successfully', {
      variant: SnackBarVariant.Success,
    });
    // TODO: Implement filter application
  }, [enqueueSnackBar]);
  const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsProcessing(true);

    await addMessage({
      type: 'user',
      content: userMessage,
    });

    try {

      // Simulate AI processing
      setTimeout(() => {
        let response = '';
        
        if (userMessage.toLowerCase().includes('search') || userMessage.toLowerCase().includes('find')) {
          response = 'I can help you search for candidates! Use the search parameters on the left to configure your search, then click the search button.';
        } else if (userMessage.toLowerCase().includes('enrichment') || userMessage.toLowerCase().includes('enrich')) {

          response = 'I can help you set up enrichments! These will add new columns to your candidate data with AI-generated insights. First, upload a job description or create a search plan.';
        } else if (userMessage.toLowerCase().includes('filter') || userMessage.toLowerCase().includes('column')) {
          response = 'Column filters help you narrow down candidates based on enriched data. I can create filters based on the enrichments we set up.';
        } else if (userMessage.toLowerCase().includes('upload') || userMessage.toLowerCase().includes('jd')) {
          response = 'You can upload a job description by clicking the upload button above. I\'ll analyze it and create a comprehensive search plan for you.';
        } else if (userMessage.toLowerCase().includes('plan') || userMessage.toLowerCase().includes('create plan')) {
            response = 'I can help you create a search plan! Upload a job description first, and I\'ll analyze it to create a comprehensive search strategy.';
        } else if (userMessage.toLowerCase().includes('apply') || userMessage.toLowerCase().includes('use plan')) {
            response = 'No search plan available to apply. Please create a search plan first.';
        } else {
          response = 'I can help you with search plans, enrichments, and filtering. What specific aspect would you like to work on?';
        }

        addMessage({
          type: 'assistant',
          content: response,
        });
        setIsProcessing(false);
      }, 1000);
      
    } catch (error) {
      await addMessage({
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      setIsProcessing(false);
    }
    }, [chatInput, isProcessing, addMessage]);

  return (
    <>
      <ChatHeader />
      <StyledChatContainer>
        <ChatMessages 
          messages={chatMessages}
          onSearchVariationSelect={handleSearchVariationSelect}
          onGenerateEnrichments={handleGenerateEnrichments}
          onExecuteEnrichments={handleExecuteEnrichments}
          onGenerateFilters={handleGenerateFilters}
          onApplyFilters={handleApplyFilters}
          selectedSearchVariation={selectedSearchVariation}
        />

        {/* JD Attachment Strip */}
        <JDAttachmentStrip
          parsedJD={parsedJD}
          onFileRemove={handleJDRemove}
          onFileUpload={handleJDReplace}
          isUploading={isUploadingFile}
          onParsedJDUpdate={onParsedJDUpdate}
        />

        {/* LinkedIn Request Status */}
        <LinkedInRequestStatus />

        {/* Record Action Bar */}
        {searchPlanGeneration.isGenerating ? (
          <StyledLoaderContainer>
            <Loader />
            <span>Generating search plan...</span>
          </StyledLoaderContainer>
        ) : (
          <StyledActionBar>

            <StyledActionButton
              onClick={() => {
                const validSearchCategory = searchConfig.searchCategory === 'posts' ? 'people' : searchConfig.searchCategory;
                handleGenerateSearchParameters(searchConfig.searchType, validSearchCategory as 'people' | 'companies' | 'jobs');
              }}
              disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id}
              title={`Generate search parameters for ${searchConfig.searchType} ${searchConfig.searchCategory} search`}
            >
              🔍 Search Parameters
            </StyledActionButton>
            
            <StyledActionButton
              onClick={handleGenerateEnrichments}
              disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id || !currentSearchParameters}
              title="Generate enrichment configurations for candidate evaluation"
            >
              🧠 Enrichments
            </StyledActionButton>
            
            <StyledActionButton
              onClick={handleGenerateFilters}
              disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id || !currentEnrichments}
              title="Generate filter configurations for candidate shortlisting"
            >
              🔧 Filters
            </StyledActionButton>
          </StyledActionBar>
        )}

        {/* Chat Input */}
        <ChatInput
          value={chatInput}
          onChange={setChatInput}
          onSubmit={handleChatSubmit}
          disabled={isProcessing}
        />
      </StyledChatContainer>
    </>
  );
};
