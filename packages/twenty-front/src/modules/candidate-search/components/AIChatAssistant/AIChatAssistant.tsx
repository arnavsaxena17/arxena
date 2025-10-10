import { useUploadAttachmentFile } from '@/activities/files/hooks/useUploadAttachmentFile';
import { enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSearchPlanFilters } from '@/candidate-search/hooks/useSearchPlanFilters';
import { useSearchPlanManager } from '@/candidate-search/hooks/useSearchPlanManager';
import { chatMessagesSelector } from '@/candidate-table/states/states';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useDestroyOneRecord } from '@/object-record/hooks/useDestroyOneRecord';
import { useFindManyAttachments } from '@/object-record/hooks/useFindManyAttachments';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { LinkedInRequestStatus } from '../search-components/LinkedInRequestStatus';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { JDAttachmentStrip } from './JDAttachmentStrip';

const StyledChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: any;
}

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
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedJD, setUploadedJD] = useState<File | null>(null);
  const [editingEnrichment, setEditingEnrichment] = useState<number | null>(null);
  const [editingInput, setEditingInput] = useState('');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const searchPlanManager = useSearchPlanManager();
  const searchPlanFilters = useSearchPlanFilters();
  const tokenPair = useRecoilValue(tokenPairState);

  // Fetch attachments for the current job
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
        console.log('AIChatAssistant - Fetched attachments:', fetchedAttachments);
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
        content: 'Welcome! I can help you create search plans, upload job descriptions, and set up enrichments. What would you like to do?',
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
        metadata: { fileName: file.name, fileSize: file.size }
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

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    
    setUploadedJD(file);
    await addMessage({
      type: 'user',
      content: `Uploaded: ${file.name}`,
      metadata: { fileName: file.name, fileSize: file.size }
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
          metadata: { searchPlan }
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
  }, [chatInput, isProcessing, addMessage, searchPlanManager, searchPlanFilters, editingEnrichment, handleEnrichmentEdit, handleFilterEdit]);


  return (
    <>
      <ChatHeader />
      <StyledChatContainer>
        <ChatMessages messages={chatMessages} />

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
