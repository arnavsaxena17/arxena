import { enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSearchPlanFilters } from '@/candidate-search/hooks/useSearchPlanFilters';
import { useSearchPlanManager } from '@/candidate-search/hooks/useSearchPlanManager';
import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { SearchPlanDisplay } from '../SearchPanel/SearchPlanDisplay';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { LinkedInRequestStatus } from './LinkedInRequestStatus';

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
};

export const AIChatAssistant = ({
  parsedJD,
  onJDUpload,
  onEnrichmentCreate,
}: AIChatAssistantProps) => {
  const [enrichments] = useRecoilState(enrichmentsState);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedJD, setUploadedJD] = useState<File | null>(null);
  const [editingEnrichment, setEditingEnrichment] = useState<number | null>(null);
  const [editingInput, setEditingInput] = useState('');
  const searchPlanManager = useSearchPlanManager();
  const searchPlanFilters = useSearchPlanFilters();
  const tokenPair = useRecoilValue(tokenPairState);

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
  }, [chatMessages.length]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newMessage]);
  }, []);

  // Handle natural language enrichment editing
  const handleEnrichmentEdit = useCallback(async (enrichmentIndex: number, userInput: string) => {
    if (!parsedJD.searchFilterId || !tokenPair?.accessToken?.token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${parsedJD.searchFilterId}/message`, {
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
      addMessage({ type: 'assistant', content: result.response });
      
      // Refresh search plan - no need to fetch as it's already in state
    } catch (error) {
      console.error('Error editing enrichment:', error);
      addMessage({ 
        type: 'assistant', 
        content: 'Sorry, I encountered an error while editing the enrichment. Please try again.' 
      });
    }
  }, [parsedJD.searchFilterId, parsedJD.id, tokenPair, addMessage, searchPlanManager]);

  // Handle filter editing
  const handleFilterEdit = useCallback(async (userInput: string) => {
    if (!parsedJD.searchFilterId || !tokenPair?.accessToken?.token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${parsedJD.searchFilterId}/message`, {
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
      addMessage({ type: 'assistant', content: result.response });
      
      // Refresh search plan and trigger DataTable filter update
      if (searchPlanManager.currentSearchPlan) {
        searchPlanFilters.applySearchPlanFilters(searchPlanManager.currentSearchPlan);
      }
    } catch (error) {
      console.error('Error editing filters:', error);
      addMessage({ 
        type: 'assistant', 
        content: 'Sorry, I encountered an error while editing the filters. Please try again.' 
      });
    }
  }, [parsedJD.searchFilterId, parsedJD.id, tokenPair, addMessage, searchPlanManager, searchPlanFilters]);

  // Handle token computation
  const handleComputeTokens = useCallback(async (enrichmentIndex: number) => {
    if (!parsedJD.searchFilterId || !tokenPair?.accessToken?.token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/compute-tokens`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${tokenPair.accessToken.token}` 
        },
        body: JSON.stringify({ 
          searchFilterId: parsedJD.searchFilterId,
          enrichmentIndex: enrichmentIndex,
        }),
      });
      
      const result = await response.json();
      addMessage({ 
        type: 'assistant', 
        content: `Token analysis for enrichment: ${JSON.stringify(result, null, 2)}` 
      });
    } catch (error) {
      console.error('Error computing tokens:', error);
      addMessage({ 
        type: 'assistant', 
        content: 'Sorry, I encountered an error while computing tokens. Please try again.' 
      });
    }
  }, [parsedJD.searchFilterId, tokenPair, addMessage]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return;
    
    setUploadedJD(file);
    addMessage({
      type: 'user',
      content: `Uploaded: ${file.name}`,
      metadata: { fileName: file.name, fileSize: file.size }
    });

    try {
      if (onJDUpload) {
        await onJDUpload(file);
      }
      
      addMessage({
        type: 'assistant',
        content: 'Job description uploaded successfully! I\'m analyzing it to create a search plan...',
      });

      // Generate search plan from the uploaded JD
      try {
        const searchPlan = await searchPlanManager.generateSearchPlanFromJD(parsedJD);
        searchPlanManager.createSearchPlan(searchPlan);
        
        addMessage({
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
        addMessage({
          type: 'assistant',
          content: `I created a basic search plan, but encountered an error during analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
      
    } catch (error) {
      addMessage({
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

    addMessage({
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
      addMessage({
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

        {/* LinkedIn Request Status */}
        <LinkedInRequestStatus />

        {/* JD Preview */}
        {/* <JDPreview parsedJobDescription={parsedJD.parsedJobDescription} /> */}

        {/* Search Plan Display */}
        <SearchPlanDisplay
          searchPlans={searchPlanManager.searchPlans}
          currentSearchPlan={searchPlanManager.currentSearchPlan}
          onPlanSelect={(plan) => searchPlanManager.setCurrentSearchPlan(plan)}
          onApplyPlan={(plan) => {
            searchPlanManager.applySearchPlan(plan);
            searchPlanFilters.applySearchPlanFilters(plan);
          }}
          onCreateEnrichments={(plan) => searchPlanManager.createEnrichmentsFromPlan(plan)}
        />

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
