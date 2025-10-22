import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { tokenPairState } from '@/auth/states/tokenPairState';
// import { useSearchPlanFilters } from '@/candidate-search/hooks/useSearchPlanFilters';
import { useSearchPlanGeneration } from '@/candidate-search/hooks/useSearchPlanGeneration';
// import { useSearchPlanManager } from '@/candidate-search/hooks/useSearchPlanManager';
import { searchConfigState } from '@/candidate-search/states/searchConfigState';
import { EnrichmentsResponse, FiltersResponse, SearchParametersResponse, SortsResponse } from '@/candidate-search/types/candidate-search.types';
import { dataTableApplySortsFunctionState } from '@/candidate-table/states/dataTableApplySortsFunctionState';
import { chatMessagesSelector, enrichmentsSelector, filtersSelector, resolvedParametersSelector, sortsSelector } from '@/candidate-table/states/states';
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
  type: 'user' | 'assistant' | 'system' | 'search_parameters' | 'enrichments' | 'filters' | 'sorts';
  content: string;
  timestamp: Date;
  metadata?: {
    searchParameters?: SearchParametersResponse;
    enrichments?: EnrichmentsResponse;
    filters?: FiltersResponse;
    sorts?: SortsResponse;
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
  const [currentFilters, setCurrentFilters] = useState<FiltersResponse | null>(null);
  const [currentSorts, setCurrentSorts] = useState<SortsResponse | null>(null);
  const searchPlanGeneration = useSearchPlanGeneration();
  const tokenPair = useRecoilValue(tokenPairState);
  const applyGeneratedSorts = useRecoilValue(dataTableApplySortsFunctionState);
  
  // Load existing data from database selectors
  const existingEnrichments = useRecoilValue(enrichmentsSelector);
  const existingFilters = useRecoilValue(filtersSelector);
  const existingSorts = useRecoilValue(sortsSelector);
  // Debug logging moved to useEffect to prevent repeated logging

  // Helper functions to check for existing data in parsedJD
  const hasExistingSearchParameters = useCallback(() => {
    return parsedJD?.searchFilters?.some(searchFilter => 
      searchFilter.searchFilterParameter?.generatedSearchParameters && 
      Object.keys(searchFilter.searchFilterParameter.generatedSearchParameters).length > 0
    ) || false;
  }, [parsedJD?.searchFilters]);

  const hasExistingEnrichments = useCallback(() => {
    return parsedJD?.searchFilters?.some(searchFilter => 
      searchFilter.enrichmentConfigs && searchFilter.enrichmentConfigs.length > 0
    ) || existingEnrichments.length > 0;
  }, [parsedJD?.searchFilters, existingEnrichments]);

  const hasExistingFilters = useCallback(() => {
    return parsedJD?.searchFilters?.some(searchFilter => 
      searchFilter.columnFilters && searchFilter.columnFilters.length > 0
    ) || existingFilters.length > 0;
  }, [parsedJD?.searchFilters, existingFilters]);

  const hasExistingSorts = useCallback(() => {
    return parsedJD?.searchFilters?.some(searchFilter => 
      (searchFilter.sortColumns && searchFilter.sortColumns.length > 0) ||
      (searchFilter.searchStrategy && searchFilter.searchStrategy.sortColumns && searchFilter.searchStrategy.sortColumns.length > 0)
    ) || !!existingSorts;
  }, [parsedJD?.searchFilters, existingSorts]);
  
  // Debug logging for button states (only log when parsedJD changes)
  useEffect(() => {
    if (parsedJD?.id) {
      console.log('AIChatAssistant Debug Info:', {
        hasExistingSearchParameters: hasExistingSearchParameters(),
        hasExistingEnrichments: hasExistingEnrichments(),
        hasExistingFilters: hasExistingFilters(),
        hasExistingSorts: hasExistingSorts(),
        currentSearchParameters: !!currentSearchParameters,
        currentEnrichments: !!currentEnrichments,
        parsedJD: {
          hasSearchFilters: !!parsedJD?.searchFilters?.length,
          searchFiltersData: parsedJD?.searchFilters?.map(sf => ({
            hasSearchFilterParameter: !!sf.searchFilterParameter?.generatedSearchParameters,
            hasEnrichmentConfigs: !!sf.enrichmentConfigs?.length,
            hasColumnFilters: !!sf.columnFilters?.length,
            hasSearchStrategy: !!sf.searchStrategy,
            hasSortColumns: !!sf.sortColumns?.length
          }))
        }
      });
    }
  }, [parsedJD?.id]);
  
  // Monitor when applyGeneratedSorts becomes available
  useEffect(() => {
    console.log('AIChatAssistant: applyGeneratedSorts changed:', applyGeneratedSorts);
  }, [applyGeneratedSorts]);
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
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  // Load existing enrichments from database when component mounts
  useEffect(() => {
    if (existingEnrichments.length > 0 && !currentEnrichments) {
      console.log('Loading existing enrichments from database:', existingEnrichments);
      const enrichmentsResponse: EnrichmentsResponse = {
        enrichments: existingEnrichments,
        overallStrategy: 'Loaded from existing configuration',
        reasoning: 'Enrichments loaded from database',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: false,
          sampleDataSize: undefined
        }
      };
      setCurrentEnrichments(enrichmentsResponse);
      
      // Add a message to show the existing enrichments
      addMessage({
        type: 'enrichments',
        content: `Loaded ${existingEnrichments.length} existing enrichment configurations from database.`,
        metadata: {
          enrichments: enrichmentsResponse,
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
  }, [existingEnrichments, currentEnrichments, addMessage]);

  // Load existing filters from database when component mounts
  useEffect(() => {
    if (existingFilters.length > 0 && !currentFilters) {
      console.log('Loading existing filters from database:', existingFilters);
      const filtersResponse: FiltersResponse = {
        filterStrategy: { name: 'Loaded Strategy', description: 'Loaded from existing configuration', targetShortlistSize: 50, priority: 'balanced' as const, reasoning: 'Loaded from database' },
        handsontableFilters: existingFilters,
        candidateSearchFilters: [],
        reasoning: 'Filters loaded from database',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasDataDistribution: false,
          dataDistributionFields: undefined
        }
      };
      setCurrentFilters(filtersResponse);
      
      // Add a message to show the existing filters
      addMessage({
        type: 'filters',
        content: `Loaded ${existingFilters.length} existing filter configurations from database.`,
        metadata: {
          filters: filtersResponse,
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
  }, [existingFilters, currentFilters, addMessage]);

  // Load existing sorts from database when component mounts
  useEffect(() => {
    if (existingSorts && !currentSorts) {
      console.log('Loading existing sorts from database:', existingSorts);
      const sortsResponse: SortsResponse = {
        sortStrategy: existingSorts,
        reasoning: existingSorts.reasoning || 'Loaded from existing configuration',
        metadata: {
          generatedAt: new Date().toISOString(),
          hasSampleData: false,
          sampleDataSize: null,
          hasEnrichments: existingEnrichments.length > 0,
          enrichmentsCount: existingEnrichments.length,
          hasFilters: existingFilters.length > 0,
          filtersCount: existingFilters.length
        }
      };
      setCurrentSorts(sortsResponse);
      
      // Add a message to show the existing sorts
      addMessage({
        type: 'sorts',
        content: `Loaded existing sorting strategy with ${existingSorts.sortColumns.length} sort columns. The sorting configuration prioritizes candidates based on ${existingSorts.name}.`,
        metadata: {
          sorts: sortsResponse,
          actionButtons: [
            {
              id: 'apply-sorts',
              label: 'Apply Sorting',
              action: 'apply_sorts',
              disabled: false
            }
          ]
        }
      });
    }
  }, [existingSorts, currentSorts, existingEnrichments, existingFilters, addMessage]);

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
        // Convert searchType to camelCase to match backend parameter key construction
        const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
        const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
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
        if (parsedJD?.searchFilters?.[0]?.id) {
          setParsedJD(prev => {
            if (!prev) return null;
            
            const updatedSearchFilters = [...(prev.searchFilters || [])];
            const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === parsedJD.searchFilters?.[0]?.id);
            
            if (searchFilterIndex !== -1) {
              updatedSearchFilters[searchFilterIndex] = {
                ...updatedSearchFilters[searchFilterIndex],
                searchFilterParameter: {
                  ...updatedSearchFilters[searchFilterIndex].searchFilterParameter,
                  generatedSearchParameters: {
                    ...updatedSearchFilters[searchFilterIndex].searchFilterParameter?.generatedSearchParameters,
                    [parameterKey]: result.variations[0]?.searchParameters
                  },
                  resolvedSearchParameters: {
                    ...updatedSearchFilters[searchFilterIndex].searchFilterParameter?.resolvedSearchParameters,
                    [parameterKey]: resolvedParams
                  }
                }
              };
              
              console.log('AIChatAssistant - Updated parsedJD with resolved parameters:', {
                parameterKey,
                resolvedParams,
                searchFilterId: parsedJD.searchFilters?.[0]?.id
              });
            }
            
            return {
              ...prev,
              searchFilters: updatedSearchFilters
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
        
        // Save enrichments to parsedJD state
        if (parsedJD?.searchFilters?.[0]?.id) {
          setParsedJD(prev => {
            if (!prev) return null;
            
            const updatedSearchFilters = [...(prev.searchFilters || [])];
            const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === parsedJD.searchFilters?.[0]?.id);
            
            if (searchFilterIndex !== -1) {
              updatedSearchFilters[searchFilterIndex] = {
                ...updatedSearchFilters[searchFilterIndex],
                enrichmentConfigs: result.enrichments
              };
              
              console.log('AIChatAssistant - Saved enrichments to parsedJD:', {
                searchFilterId: parsedJD.searchFilters?.[0]?.id,
                enrichmentsCount: result.enrichments.length,
                enrichments: result.enrichments.map(e => ({ id: e.id, name: e.name }))
              });
            }
            
            return {
              ...prev,
              searchFilters: updatedSearchFilters
            };
          });
        }
        
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
        setCurrentFilters(result);
        
        // Save filters to parsedJD state
        if (parsedJD?.searchFilters?.[0]?.id) {
          setParsedJD(prev => {
            if (!prev) return null;
            
            const updatedSearchFilters = [...(prev.searchFilters || [])];
            const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === parsedJD.searchFilters?.[0]?.id);
            
            if (searchFilterIndex !== -1) {
              updatedSearchFilters[searchFilterIndex] = {
                ...updatedSearchFilters[searchFilterIndex],
                columnFilters: result.handsontableFilters
              };
              
              console.log('AIChatAssistant - Saved filters to parsedJD:', {
                searchFilterId: parsedJD.searchFilters?.[0]?.id,
                filtersCount: result.handsontableFilters.length,
                filters: result.handsontableFilters.map(f => ({ column: f.column, type: f.type }))
              });
            }
            
            return {
              ...prev,
              searchFilters: updatedSearchFilters
            };
          });
        }
        
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

  const handleGenerateSorts = useCallback(async () => {
    if (!parsedJD?.searchFilters?.[0]?.id) {
      enqueueSnackBar('No search filter found. Please create a search filter first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    // Check if we have the required data (either in local state or in parsedJD)
    const hasSearchParams = currentSearchParameters || hasExistingSearchParameters();
    const hasEnrichments = currentEnrichments || hasExistingEnrichments();
    
    if (!hasSearchParams || !hasEnrichments) {
      enqueueSnackBar('No search parameters or enrichments found. Please generate search parameters and enrichments first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      // If we don't have local state but have existing data, we need to regenerate
      // the missing pieces to get the proper response objects
      let searchParametersToUse = currentSearchParameters;
      let enrichmentsToUse = currentEnrichments;
      
      // If we have existing enrichments but no local state, regenerate enrichments to get the response object
      if (!enrichmentsToUse && hasExistingEnrichments()) {
        console.log('Regenerating enrichments to get response object for sorts generation');
        enrichmentsToUse = await searchPlanGeneration.generateEnrichments(parsedJD.searchFilters[0].id);
        if (enrichmentsToUse) {
          setCurrentEnrichments(enrichmentsToUse);
        }
      }
      
      // If we have existing search parameters but no local state, regenerate search parameters to get the response object
      if (!searchParametersToUse && hasExistingSearchParameters()) {
        console.log('Regenerating search parameters to get response object for sorts generation');
        // We need to determine the search type and category from the existing data
        const validSearchCategory = searchConfig.searchCategory === 'posts' ? 'people' : searchConfig.searchCategory;
        searchParametersToUse = await searchPlanGeneration.generateSearchParameters(
          parsedJD.searchFilters[0].id,
          searchConfig.searchType,
          validSearchCategory as 'people' | 'companies' | 'jobs'
        );
        if (searchParametersToUse) {
          setCurrentSearchParameters(searchParametersToUse);
        }
      }
      
      if (!searchParametersToUse || !enrichmentsToUse) {
        enqueueSnackBar('Unable to retrieve search parameters or enrichments. Please regenerate them.', {
          variant: SnackBarVariant.Error,
        });
        return;
      }

      const result = await searchPlanGeneration.generateSorts(
        parsedJD.searchFilters[0].id,
        searchParametersToUse,
        enrichmentsToUse,
        // We need filters for sorts generation, but we can create a minimal one if not available
        { 
          filterStrategy: { name: 'Default', description: 'Default filter strategy', targetShortlistSize: 50, priority: 'balanced' as const, reasoning: 'Default strategy' },
          handsontableFilters: [],
          candidateSearchFilters: [],
          reasoning: 'Default filters',
          metadata: { generatedAt: new Date().toISOString(), hasDataDistribution: false, dataDistributionFields: [] }
        }
      );

      console.log (`handleGenerateSorts - Result: ${JSON.stringify(result, null, 2)}`);

      if (result) {
        setCurrentSorts(result);
        
        // Save sorts to parsedJD state
        if (parsedJD?.searchFilters?.[0]?.id) {
          setParsedJD(prev => {
            if (!prev) return null;
            
            const updatedSearchFilters = [...(prev.searchFilters || [])];
            const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === parsedJD.searchFilters?.[0]?.id);
            
            if (searchFilterIndex !== -1) {
              updatedSearchFilters[searchFilterIndex] = {
                ...updatedSearchFilters[searchFilterIndex],
                // Store flattened sort data
                sortColumns: result.sortStrategy.sortColumns,
                sortStrategyName: result.sortStrategy.name,
                sortStrategyDescription: result.sortStrategy.description,
                sortStrategyReasoning: result.sortStrategy.reasoning,
                // Keep legacy structure for backward compatibility
                searchStrategy: result.sortStrategy
              };
              
              console.log('AIChatAssistant - Saved sorts to parsedJD:', {
                searchFilterId: parsedJD.searchFilters?.[0]?.id,
                sortColumnsCount: result.sortStrategy.sortColumns.length,
                sortStrategy: result.sortStrategy.name
              });
            }
            
            return {
              ...prev,
              searchFilters: updatedSearchFilters
            };
          });
        }
        
        await addMessage({
          type: 'sorts',
          content: `Generated multi-column sorting strategy with ${result.sortStrategy.sortColumns.length} sort columns. The sorting configuration prioritizes candidates based on ${result.sortStrategy.name}.`,
          metadata: {
            sorts: result,
            actionButtons: [
              {
                id: 'apply-sorts',
                label: 'Apply Sorting',
                action: 'apply_sorts',
                disabled: false
              }
            ]
          }
        });
      }
    } catch (error) {
      console.error('Error generating sorts:', error);
      enqueueSnackBar('Failed to generate sorts', {
        variant: SnackBarVariant.Error,
      });
    }
  }, [parsedJD?.searchFilters, currentSearchParameters, currentEnrichments, searchPlanGeneration, addMessage, enqueueSnackBar, hasExistingSearchParameters, hasExistingEnrichments, searchConfig]);

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
        
        // Convert searchType to camelCase to match backend parameter key construction
        const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
        const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
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

  const handleApplySorts = useCallback(async () => {
    console.log("handleApplySorts called");
    console.log("currentSorts:", JSON.stringify(currentSorts, null, 2));
    console.log("applyGeneratedSorts:", JSON.stringify(applyGeneratedSorts, null, 2));
    
    if (!currentSorts) {
      enqueueSnackBar('No sorting configuration available to apply', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    if (!applyGeneratedSorts) {
      enqueueSnackBar('DataTable is not ready yet. Please ensure the candidate table is loaded and try again.', {
        variant: SnackBarVariant.Warning,
      });
      console.warn('DataTable applyGeneratedSorts function not available yet');
      console.warn('This might happen if the AIChatAssistant is in a modal and the DataTable is not mounted yet');
      return;
    }

    try {
      // Apply the generated sorts to the DataTable
      applyGeneratedSorts(currentSorts);
      
      enqueueSnackBar(`Sorting strategy "${currentSorts.sortStrategy.name}" applied successfully`, {
        variant: SnackBarVariant.Success,
      });
      
      console.log('Applied sorts:', currentSorts);
    } catch (error) {
      console.error('Error applying sorts:', error);
      enqueueSnackBar('Failed to apply sorting configuration', {
        variant: SnackBarVariant.Error,
      });
    }
  }, [currentSorts, applyGeneratedSorts, enqueueSnackBar]);
  
  const handleChatSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessing) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsProcessing(true);

    // Add user message to chat
    await addMessage({
      type: 'user',
      content: userMessage,
    });

    try {
      if (!parsedJD?.searchFilters?.[0]?.id) {
        await addMessage({
          type: 'assistant',
          content: 'Please create a search filter first before I can help you generate search components.',
        });
        setIsProcessing(false);
        return;
      }

      if (!tokenPair?.accessToken?.token) {
        await addMessage({
          type: 'assistant',
          content: 'Authentication token not found. Please refresh the page and try again.',
        });
        setIsProcessing(false);
        return;
      }

      // Call the message endpoint
      const response = await fetch(process.env.REACT_APP_SERVER_BASE_URL+'/candidate-search/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenPair.accessToken.token}`,
        },
        body: JSON.stringify({
          searchFilterId: parsedJD.searchFilters[0].id,
          message: userMessage,
          parsedJD: parsedJD.parsedJobDescription,
          searchType: searchConfig.searchType || 'classic',
          searchCategory: searchConfig.searchCategory || 'people',
          sampleResults: [], // TODO: Add sample results if available
          dataDistribution: {}, // TODO: Add data distribution if available
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Handle different response types
        switch (result.type) {
          case 'search_parameters':
            if (result.data?.generatedSearchParameters) {
              setCurrentSearchParameters(result.data);
              
              // Update parsedJD with search parameters
              setParsedJD(prev => {
                if (!prev) return null;
                
                const updatedSearchFilters = [...(prev.searchFilters || [])];
                const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === parsedJD.searchFilters?.[0]?.id);
                
                if (searchFilterIndex !== -1) {
                  updatedSearchFilters[searchFilterIndex] = {
                    ...updatedSearchFilters[searchFilterIndex],
                    searchFilterParameter: {
                      ...updatedSearchFilters[searchFilterIndex].searchFilterParameter,
                      generatedSearchParameters: result.data.generatedSearchParameters,
                      resolvedSearchParameters: result.data.resolvedSearchParameters,
                    }
                  };
                }
                
                return {
                  ...prev,
                  searchFilters: updatedSearchFilters
                };
              });
            }
            
            await addMessage({
              type: 'search_parameters',
              content: result.chatMessage,
              metadata: {
                searchParameters: result.data,
                actionButtons: [
                  {
                    id: 'generate-enrichments',
                    label: 'Generate Enrichments',
                    action: 'generate_enrichments'
                  }
                ]
              }
            });
            break;

          case 'enrichments':
            if (result.data) {
              setCurrentEnrichments(result.data);
              
              // Update parsedJD with enrichments
              setParsedJD(prev => {
                if (!prev) return null;
                
                const updatedSearchFilters = [...(prev.searchFilters || [])];
                const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === parsedJD.searchFilters?.[0]?.id);
                
                if (searchFilterIndex !== -1) {
                  updatedSearchFilters[searchFilterIndex] = {
                    ...updatedSearchFilters[searchFilterIndex],
                    enrichmentConfigs: result.data.enrichments
                  };
                }
                
                return {
                  ...prev,
                  searchFilters: updatedSearchFilters
                };
              });
            }
            
            await addMessage({
              type: 'enrichments',
              content: result.chatMessage,
              metadata: {
                enrichments: result.data,
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
            break;

          case 'filters':
            if (result.data) {
              setCurrentFilters(result.data);
              
              // Update parsedJD with filters
              setParsedJD(prev => {
                if (!prev) return null;
                
                const updatedSearchFilters = [...(prev.searchFilters || [])];
                const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === parsedJD.searchFilters?.[0]?.id);
                
                if (searchFilterIndex !== -1) {
                  updatedSearchFilters[searchFilterIndex] = {
                    ...updatedSearchFilters[searchFilterIndex],
                    columnFilters: result.data.handsontableFilters
                  };
                }
                
                return {
                  ...prev,
                  searchFilters: updatedSearchFilters
                };
              });
            }
            
            await addMessage({
              type: 'filters',
              content: result.chatMessage,
              metadata: {
                filters: result.data,
                actionButtons: [
                  {
                    id: 'apply-filters',
                    label: 'Apply Filters',
                    action: 'apply_filters'
                  },
                  {
                    id: 'generate-sorts',
                    label: 'Generate Sorts',
                    action: 'generate_sorts'
                  }
                ]
              }
            });
            break;

          case 'sorts':
            if (result.data) {
              setCurrentSorts(result.data);
              
              // Update parsedJD with sorts
              setParsedJD(prev => {
                if (!prev) return null;
                
                const updatedSearchFilters = [...(prev.searchFilters || [])];
                const searchFilterIndex = updatedSearchFilters.findIndex(sf => sf.id === parsedJD.searchFilters?.[0]?.id);
                
                if (searchFilterIndex !== -1) {
                  updatedSearchFilters[searchFilterIndex] = {
                    ...updatedSearchFilters[searchFilterIndex],
                    // Note: columnSortConfigs might need to be added to the type definition
                    columnSortConfigs: result.data.sortStrategy
                  } as any;
                }
                
                return {
                  ...prev,
                  searchFilters: updatedSearchFilters
                };
              });
            }
            
            await addMessage({
              type: 'sorts',
              content: result.chatMessage,
              metadata: {
                sorts: result.data,
                actionButtons: [
                  {
                    id: 'apply-sorts',
                    label: 'Apply Sorts',
                    action: 'apply_sorts'
                  }
                ]
              }
            });
            break;

          case 'complete_plan':
            // Handle complete plan response
            await addMessage({
              type: 'assistant',
              content: result.chatMessage,
              metadata: {
                actionButtons: [
                  {
                    id: 'view-results',
                    label: 'View Results',
                    action: 'view_results'
                  }
                ]
              }
            });
            break;

          default:
            await addMessage({
              type: 'assistant',
              content: result.chatMessage || 'I processed your request successfully.',
            });
        }
      } else {
        await addMessage({
          type: 'assistant',
          content: result.chatMessage || 'Sorry, I encountered an error processing your request.',
        });
      }
    } catch (error) {
      console.error('Error processing chat message:', error);
      await addMessage({
        type: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [chatInput, isProcessing, addMessage, parsedJD, tokenPair, searchConfig, setParsedJD]);

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
          onApplySorts={handleApplySorts}
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
              disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id || (!currentSearchParameters && !hasExistingSearchParameters())}
              title="Generate enrichment configurations for candidate evaluation"
            >
              🧠 Enrichments
            </StyledActionButton>
            
            <StyledActionButton
              onClick={handleGenerateFilters}
              disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id || (!currentEnrichments && !hasExistingEnrichments())}
              title="Generate filter configurations for candidate shortlisting"
            >
              🔧 Filters
            </StyledActionButton>
            
            <StyledActionButton
              onClick={handleGenerateSorts}
              disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id || (!currentSearchParameters && !hasExistingSearchParameters()) || (!currentEnrichments && !hasExistingEnrichments())}
              title="Generate multi-column sorting strategy for candidate prioritization"
            >
              📊 Sorting
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
