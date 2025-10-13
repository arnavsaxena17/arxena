import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSearchPlanFilters } from '@/candidate-search/hooks/useSearchPlanFilters';
import { useSearchPlanManager } from '@/candidate-search/hooks/useSearchPlanManager';
import { chatMessagesSelector, resolvedParametersSelector } from '@/candidate-table/states/states';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useDestroyOneRecord } from '@/object-record/hooks/useDestroyOneRecord';
import { useFindManyAttachments } from '@/object-record/hooks/useFindManyAttachments';
import { useSearchPlanGeneration } from '@/search-plan/hooks/useSearchPlanGeneration';
import { EnrichmentsResponse, FiltersResponse, SearchParametersResponse } from '@/search-plan/types/search-plan.types';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
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
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedJD, setUploadedJD] = useState<File | null>(null);
  const [editingEnrichment, setEditingEnrichment] = useState<number | null>(null);
  const [editingInput, setEditingInput] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedSearchVariation, setSelectedSearchVariation] = useState<string | null>(null);
  const [currentSearchParameters, setCurrentSearchParameters] = useState<SearchParametersResponse | null>(null);
  const [currentEnrichments, setCurrentEnrichments] = useState<EnrichmentsResponse | null>(null);
  const [currentFilters, setCurrentFilters] = useState<FiltersResponse | null>(null);
  const searchPlanManager = useSearchPlanManager();
  const searchPlanFilters = useSearchPlanFilters();
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
        await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${parsedJD.searchFilters[0].id}/message`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${tokenPair.accessToken.token}` 
          },
          body: JSON.stringify({ 
            message: message.content,
          }),
        });
      } catch (error) {
        console.error('Error saving chat message to backend:', error);
        // Don't show error to user as the message is still added locally
      }
    }
  }, [setChatMessages, parsedJD?.searchFilters, tokenPair?.accessToken?.token]);

  // Handle natural language enrichment editing
  const handleEnrichmentEdit = useCallback(async (enrichmentIndex: number, userInput: string) => {
    if (!parsedJD.searchFilters?.[0]?.id || !tokenPair?.accessToken?.token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${parsedJD.searchFilters[0].id}/message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${tokenPair.accessToken.token}` 
        },
        body: JSON.stringify({ 
          message: `Edit enrichment ${enrichmentIndex}: ${userInput}`,
        }),
      });
      
      const result = await response.json();
      await addMessage({ type: 'assistant', content: result.response });
      
      // Refresh search plan - no need to fetch as it's already in state
    } catch (error) {
      console.error('Error editing enrichment:', error);
      await addMessage({ 
        type: 'assistant', 
        content: 'Sorry, I encountered an error while editing the enrichment. Please try again.' 
      });
    }
  }, [parsedJD.searchFilters, parsedJD.id, tokenPair, addMessage, searchPlanManager]);

  // Handle filter editing
  const handleFilterEdit = useCallback(async (userInput: string) => {
    if (!parsedJD.searchFilters?.[0]?.id || !tokenPair?.accessToken?.token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${parsedJD.searchFilters[0].id}/message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${tokenPair.accessToken.token}` 
        },
        body: JSON.stringify({ 
          message: `Edit filters: ${userInput}`,
        }),
      });
      
      const result = await response.json();
      await addMessage({ type: 'assistant', content: result.response });
      
      // Refresh search plan and trigger DataTable filter update
      if (searchPlanManager.currentSearchPlan) {
        searchPlanFilters.applySearchPlanFilters(searchPlanManager.currentSearchPlan);
      }
    } catch (error) {
      console.error('Error editing filters:', error);
      await addMessage({ 
        type: 'assistant', 
        content: 'Sorry, I encountered an error while editing the filters. Please try again.' 
      });
    }
  }, [parsedJD.searchFilters, parsedJD.id, tokenPair, addMessage, searchPlanManager, searchPlanFilters]);

  // Handle token computation
  const handleComputeTokens = useCallback(async (enrichmentIndex: number) => {
    if (!parsedJD.searchFilters?.[0]?.id || !tokenPair?.accessToken?.token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/compute-tokens`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${tokenPair.accessToken.token}` 
        },
        body: JSON.stringify({ 
          searchFilterId: parsedJD.searchFilters[0].id,
          enrichmentIndex: enrichmentIndex,
        }),
      });
      
      const result = await response.json();
      await addMessage({ 
        type: 'assistant', 
        content: `Token analysis for enrichment: ${JSON.stringify(result, null, 2)}` 
      });
    } catch (error) {
      console.error('Error computing tokens:', error);
      await addMessage({ 
        type: 'assistant', 
        content: 'Sorry, I encountered an error while computing tokens. Please try again.' 
      });
    }
  }, [parsedJD.searchFilters, tokenPair, addMessage]);

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

      if (result) {
        setCurrentSearchParameters(result);
        
        // Update resolved parameters with the generated search parameters
        // This will make them available in the search form
        const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
        setResolvedParameters((prevResolved: any) => ({
          ...prevResolved,
          [parameterKey]: result.variations[0]?.searchParameters || {}
        }));
        
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

      if (result) {
        setCurrentFilters(result);
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
        const parameterKey = `${currentSearchParameters.metadata.searchType}${currentSearchParameters.metadata.searchCategory.charAt(0).toUpperCase() + currentSearchParameters.metadata.searchCategory.slice(1)}Search`;
        setResolvedParameters((prevResolved: any) => ({
          ...prevResolved,
          [parameterKey]: selectedVariation.searchParameters || {}
        }));
        
        enqueueSnackBar(`Search variation "${selectedVariation.name}" selected and applied to search form`, {
          variant: SnackBarVariant.Success,
        });
      }
    }
  }, [enqueueSnackBar, currentSearchParameters, setResolvedParameters]);

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

  const handleGenerateSearchPlan = useCallback(async () => {
    if (!parsedJD?.id) {
      enqueueSnackBar('No job description found. Please upload a job description first.', {
        variant: SnackBarVariant.Error,
      });
      return;
    }

    try {
      await addMessage({
        type: 'assistant',
        content: 'Generating initial search plan with AI analysis of your job description...',
      });

      // Call the backend endpoint to generate search plan
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/generate-search-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
        },
        body: JSON.stringify({
          jobId: parsedJD.id,
          parsedJD: parsedJD.parsedJobDescription || parsedJD,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        const searchPlanData = result.data;
        
        // Update parsedJD with the search plan data
        if (onParsedJDUpdate) {
          const updatedParsedJD = {
            ...parsedJD,
            searchFilters: searchPlanData?.searchFilterId ? [{
              id: searchPlanData.searchFilterId,
              name: 'search filter',
              searchFilterParameter: null,
              searchFilterName: 'generated_search_filter',
              searchFilterFields: null,
            }] : [],
            searchParameters: searchPlanData?.searchParameters || [],
            enrichmentConfigs: searchPlanData?.enrichmentConfigs,
            columnFilters: searchPlanData?.columnFilters,
            clarificationQuestions: searchPlanData?.clarificationQuestions,
            requestStatus: searchPlanData?.requestStatus,
          };
          onParsedJDUpdate(updatedParsedJD);
        }

        await addMessage({
          type: 'assistant',
          content: `🎯 Search plan generated successfully!

**Search Filter ID:** ${searchPlanData?.searchFilterId || 'N/A'}
**Enrichment Configs:** ${searchPlanData?.enrichmentConfigs?.length || 0} configurations
**Column Filters:** ${searchPlanData?.columnFilters?.length || 0} filters
**Clarification Questions:** ${searchPlanData?.clarificationQuestions?.length || 0} questions

Your search plan is now ready! You can use the other buttons to generate specific components or create a complete plan.`,
          metadata: {
            actionButtons: [
              {
                id: 'generate-complete-plan',
                label: 'Generate Complete Plan',
                action: 'generate_complete_plan'
              },
              {
                id: 'generate-search-parameters',
                label: 'Generate Search Parameters',
                action: 'generate_search_parameters'
              },
              {
                id: 'generate-enrichments',
                label: 'Generate Enrichments',
                action: 'generate_enrichments'
              }
            ]
          }
        });

        enqueueSnackBar('Search plan generated successfully!', {
          variant: SnackBarVariant.Success,
        });
      } else {
        throw new Error(result.error || 'Failed to generate search plan');
      }
    } catch (error) {
      console.error('Error generating search plan:', error);
      await addMessage({
        type: 'assistant',
        content: `Sorry, I encountered an error while generating the search plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      enqueueSnackBar('Failed to generate search plan', {
        variant: SnackBarVariant.Error,
      });
    }
  }, [parsedJD, tokenPair?.accessToken?.token, addMessage, enqueueSnackBar, onParsedJDUpdate]);

  const handleGenerateCompletePlan = useCallback(async (
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
      await addMessage({
        type: 'assistant',
        content: `Generating complete search plan for ${searchType} ${searchCategory} search. This will create search parameters, enrichments, and filters in one go...`,
      });

      const result = await searchPlanGeneration.generateCompletePlan(
        parsedJD.searchFilters[0].id,
        searchType,
        searchCategory
      );

      if (result) {
        // Update all the current states
        setCurrentSearchParameters(result.searchParameters);
        setCurrentEnrichments(result.enrichments);
        setCurrentFilters(result.filters);
        
        // Update resolved parameters with the generated search parameters
        const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
        setResolvedParameters((prevResolved: any) => ({
          ...prevResolved,
          [parameterKey]: result.searchParameters.variations[0]?.searchParameters || {}
        }));
        
        await addMessage({
          type: 'assistant',
          content: `🎉 Complete search plan generated successfully!

**Search Parameters:** ${result.searchParameters.variations.length} variations created
**Enrichments:** ${result.enrichments.enrichments.length} enrichment configurations
**Filters:** ${result.filters.handsontableFilters.length} Handsontable filters + ${result.filters.candidateSearchFilters.length} CandidateSearch filters

All components have been applied to your search form and are ready to use!`,
          metadata: {
            searchParameters: result.searchParameters,
            enrichments: result.enrichments,
            filters: result.filters,
            actionButtons: [
              {
                id: 'execute-enrichments',
                label: 'Execute Enrichments',
                action: 'execute_enrichments'
              },
              {
                id: 'apply-filters',
                label: 'Apply Filters',
                action: 'apply_filters'
              }
            ]
          }
        });

        enqueueSnackBar('Complete search plan generated successfully!', {
          variant: SnackBarVariant.Success,
        });
      }
    } catch (error) {
      console.error('Error generating complete plan:', error);
      await addMessage({
        type: 'assistant',
        content: 'Sorry, I encountered an error while generating the complete search plan. Please try again.',
      });
      enqueueSnackBar('Failed to generate complete search plan', {
        variant: SnackBarVariant.Error,
      });
    }
  }, [parsedJD?.searchFilters, searchPlanGeneration, addMessage, enqueueSnackBar, setResolvedParameters]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    
    setUploadedJD(file);
    await addMessage({
      type: 'user',
      content: `Uploaded: ${file.name}`,
    });

    try {
      if (onJDUpload) {
        await onJDUpload(file);
      }
      
      await addMessage({
        type: 'assistant',
        content: 'Job description uploaded successfully! I\'m analyzing it to create a search plan...',
      });

      // Generate search plan from the uploaded JD
      try {
        const searchPlan = await searchPlanManager.generateSearchPlanFromJD(parsedJD);
        await searchPlanManager.createSearchPlan(searchPlan, parsedJD);
        
        await addMessage({
          type: 'assistant',
          content: `Search plan "${searchPlan.name}" created! Here's what I found:

            **Filters Applied:**
            • Keywords: ${searchPlan.filters.keywords.join(', ')}
            • Job Title: ${searchPlan.filters.jobTitle}
            • Location: ${searchPlan.filters.location}
            • Industry: ${searchPlan.filters.industry}
            • Seniority: ${searchPlan.filters.seniority}

            **Enrichments:** ${searchPlan.enrichments.join(', ')}

            **Column Filters:** ${searchPlan.columnFilters} filters applied`,
          metadata: { }
        });
      } catch (error) {
        await addMessage({
          type: 'assistant',
          content: `I created a basic search plan, but encountered an error during analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
      
    } catch (error) {
      await addMessage({
        type: 'assistant',
        content: `Sorry, I couldn't process the job description. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }, [onJDUpload, addMessage, searchPlanManager, parsedJD]);

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
      // Check if this is a natural language edit command
      if (editingEnrichment !== null && userMessage.trim()) {
        await handleEnrichmentEdit(editingEnrichment, userMessage);
        setEditingEnrichment(null);
        setEditingInput('');
        setIsProcessing(false);
        return;
      }

      // Check if this is a filter edit command
      if (userMessage.toLowerCase().includes('filter') && (userMessage.toLowerCase().includes('change') || userMessage.toLowerCase().includes('update') || userMessage.toLowerCase().includes('modify'))) {
        await handleFilterEdit(userMessage);
        setIsProcessing(false);
        return;
      }

      // Check for complete plan generation commands
      if (userMessage.toLowerCase().includes('complete plan') || userMessage.toLowerCase().includes('generate complete')) {
        // Determine search type and category from the message
        let searchType: 'classic' | 'sales_navigator' | 'recruiter' = 'sales_navigator';
        let searchCategory: 'people' | 'companies' | 'jobs' = 'people';
        
        if (userMessage.toLowerCase().includes('classic')) {
          searchType = 'classic';
        } else if (userMessage.toLowerCase().includes('recruiter')) {
          searchType = 'recruiter';
        }
        
        if (userMessage.toLowerCase().includes('companies') || userMessage.toLowerCase().includes('company')) {
          searchCategory = 'companies';
        } else if (userMessage.toLowerCase().includes('jobs') || userMessage.toLowerCase().includes('job')) {
          searchCategory = 'jobs';
        }
        
        await handleGenerateCompletePlan(searchType, searchCategory);
        setIsProcessing(false);
        return;
      }

      // Simulate AI processing
      setTimeout(() => {
        let response = '';
        
        if (userMessage.toLowerCase().includes('search') || userMessage.toLowerCase().includes('find')) {
          response = 'I can help you search for candidates! Use the search parameters on the left to configure your search, then click the search button.';
        } else if (userMessage.toLowerCase().includes('enrichment') || userMessage.toLowerCase().includes('enrich')) {
          if (searchPlanManager.currentSearchPlan) {
            response = `I can help you set up enrichments based on your current search plan! Your plan includes: ${searchPlanManager.currentSearchPlan.enrichments.join(', ')}. Would you like me to create these enrichments?`;
          } else {
            response = 'I can help you set up enrichments! These will add new columns to your candidate data with AI-generated insights. First, upload a job description or create a search plan.';
          }
        } else if (userMessage.toLowerCase().includes('filter') || userMessage.toLowerCase().includes('column')) {
          response = 'Column filters help you narrow down candidates based on enriched data. I can create filters based on the enrichments we set up.';
        } else if (userMessage.toLowerCase().includes('upload') || userMessage.toLowerCase().includes('jd')) {
          response = 'You can upload a job description by clicking the upload button above. I\'ll analyze it and create a comprehensive search plan for you.';
        } else if (userMessage.toLowerCase().includes('plan') || userMessage.toLowerCase().includes('create plan')) {
          if (searchPlanManager.currentSearchPlan) {
            response = `You already have a search plan: "${searchPlanManager.currentSearchPlan.name}". You can modify it or create a new one. What would you like to change?`;
          } else {
            response = 'I can help you create a search plan! Upload a job description first, and I\'ll analyze it to create a comprehensive search strategy.';
          }
        } else if (userMessage.toLowerCase().includes('apply') || userMessage.toLowerCase().includes('use plan')) {
          if (searchPlanManager.currentSearchPlan) {
            searchPlanManager.applySearchPlan(searchPlanManager.currentSearchPlan);
            searchPlanFilters.applySearchPlanFilters(searchPlanManager.currentSearchPlan);
            response = `Applied search plan "${searchPlanManager.currentSearchPlan.name}"! The search parameters and table filters have been updated.`;
          } else {
            response = 'No search plan available to apply. Please create a search plan first.';
          }
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
  }, [chatInput, isProcessing, addMessage, searchPlanManager, searchPlanFilters, editingEnrichment, handleEnrichmentEdit, handleFilterEdit, handleGenerateCompletePlan, handleGenerateSearchPlan]);
  console.log('AIChatAssistant - parsedJD:', parsedJD);

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

        {/* JD Preview */}
        {/* <JDPreview parsedJobDescription={parsedJD.parsedJobDescription} /> */}

        {/* Search Plan Display */}
        {/* <SearchPlanDisplay
          searchPlans={searchPlanManager.searchPlans}
          currentSearchPlan={searchPlanManager.currentSearchPlan}
          onPlanSelect={(plan) => searchPlanManager.setCurrentSearchPlan(plan)}
          onApplyPlan={(plan) => {
            searchPlanManager.applySearchPlan(plan);
            searchPlanFilters.applySearchPlanFilters(plan);
          }}
          onCreateEnrichments={(plan) => searchPlanManager.createEnrichmentsFromPlan(plan)}
        /> */}

        {/* Enrichment Display */}
        {/* {enrichments && enrichments.length > 0 && (
          <div>
            <h4>Generated Enrichments</h4>
            {enrichments.map((enrichment, index) => (
              <EnrichmentCard
                key={index}
                enrichment={enrichment}
                enrichmentIndex={index}
                onEdit={setEditingEnrichment}
                onComputeTokens={handleComputeTokens}
              />
            ))}
          </div>
        )} */}

        {/* Record Action Bar */}
        <StyledActionBar>
          <StyledActionButton
            onClick={handleGenerateSearchPlan}
            disabled={searchPlanGeneration.isGenerating || isProcessing || !parsedJD?.id}
            title="Generate initial search plan with AI analysis of your job description"
          >
            🎯 Generate Search Plan
          </StyledActionButton>
          
          <StyledActionButton
            onClick={() => handleGenerateCompletePlan('sales_navigator', 'people')}
            disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id}
            title="Generate complete search plan (parameters + enrichments + filters) for LinkedIn Sales Navigator people search"
          >
            🚀 Complete Plan (Sales Navigator)
          </StyledActionButton>
          
          <StyledActionButton
            onClick={() => handleGenerateCompletePlan('classic', 'people')}
            disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id}
            title="Generate complete search plan (parameters + enrichments + filters) for LinkedIn Classic people search"
          >
            🚀 Complete Plan (Classic)
          </StyledActionButton>
          
          <StyledActionButton
            onClick={() => handleGenerateCompletePlan('recruiter', 'people')}
            disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id}
            title="Generate complete search plan (parameters + enrichments + filters) for LinkedIn Recruiter people search"
          >
            🚀 Complete Plan (Recruiter)
          </StyledActionButton>
          
          <StyledActionButton
            onClick={() => handleGenerateCompletePlan('sales_navigator', 'companies')}
            disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id}
            title="Generate complete search plan (parameters + enrichments + filters) for LinkedIn Sales Navigator companies search"
          >
            🏢 Complete Plan (Companies)
          </StyledActionButton>
          
          <StyledActionButton
            onClick={() => handleGenerateCompletePlan('classic', 'jobs')}
            disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id}
            title="Generate complete search plan (parameters + enrichments + filters) for LinkedIn Classic jobs search"
          >
            💼 Complete Plan (Jobs)
          </StyledActionButton>
          
          <StyledActionButton
            onClick={() => handleGenerateSearchParameters('sales_navigator', 'people')}
            disabled={searchPlanGeneration.isGenerating || !parsedJD?.searchFilters?.[0]?.id}
            title="Generate search parameters for LinkedIn Sales Navigator people search"
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
