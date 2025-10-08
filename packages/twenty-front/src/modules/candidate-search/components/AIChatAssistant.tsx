import { useFetchCandidateFields } from '@/arx-enrich/hooks/useFetchCandidateFields';
import { enrichmentsState, isArxEnrichModalMinimizedState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSearchPlanFilters } from '@/candidate-search/hooks/useSearchPlanFilters';
import { useSearchPlanManager } from '@/candidate-search/hooks/useSearchPlanManager';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import styled from '@emotion/styled';
import { IconEdit } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { IconCheck, IconRobot, IconSend, IconUpload, IconX } from 'twenty-ui';
import { LinkedInRequestStatus } from './LinkedInRequestStatus';

const StyledPanelHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
`;

const StyledPanelTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledChatMessages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(2)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledMessage = styled.div<{ isUser?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
  ${({ isUser }) => isUser && 'flex-direction: row-reverse;'}
`;

const StyledMessageContent = styled.div<{ isUser?: boolean }>`
  background-color: ${({ isUser, theme }) => 
    isUser ? theme.color.blue10 : theme.background.secondary};
  border: 1px solid ${({ isUser, theme }) => 
    isUser ? theme.color.blue20 : theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  max-width: 80%;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
`;

const StyledMessageIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.background.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const StyledChatInput = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  background-color: ${({ theme }) => theme.background.secondary};
`;

const StyledInput = styled.input`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background-color: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.font.color.inverted};
  cursor: pointer;
  
  &:hover {
    background-color: ${({ theme }) => theme.color.blue50};
  }
  
  &:disabled {
    background-color: ${({ theme }) => theme.color.gray20};
    cursor: not-allowed;
  }
`;

const StyledUploadArea = styled.div`
  border: 2px dashed ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
  word-wrap: break-word;
  overflow-wrap: break-word;
  
  &:hover {
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

// New styled components for enrichment display
const StyledEnrichmentCard = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(3)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledEnrichmentHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;



const StyledEditButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  
  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledEnrichmentDetail = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  
  strong {
    color: ${({ theme }) => theme.font.color.primary};
    font-weight: ${({ theme }) => theme.font.weight.semiBold};
  }
`;

const StyledFieldList = styled.ul`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  padding-left: ${({ theme }) => theme.spacing(3)};
  
  li {
    margin-bottom: ${({ theme }) => theme.spacing(1)};
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

const StyledTokenButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.color.blue};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  
  &:hover {
    background-color: ${({ theme }) => theme.color.blue20};
  }
`;

const StyledJDPreview = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(3)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledJDTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledJDDetails = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledJDDetail = styled.div`
  strong {
    color: ${({ theme }) => theme.font.color.primary};
    font-weight: ${({ theme }) => theme.font.weight.semiBold};
  }
  
  span {
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

const StyledChip = styled.span<{ clickable?: boolean }>`
  display: inline-block;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin: ${({ theme }) => theme.spacing(1)};
  ${({ clickable }) => clickable && 'cursor: pointer;'}
  
  ${({ clickable, theme }) => clickable && `
    &:hover {
      background-color: ${theme.color.blue20};
    }
  `}
`;

const StyledSearchPlanSelector = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  
  select {
    width: 100%;
    padding: ${({ theme }) => theme.spacing(2)};
    border: 1px solid ${({ theme }) => theme.border.color.medium};
    border-radius: ${({ theme }) => theme.border.radius.sm};
    background-color: ${({ theme }) => theme.background.primary};
    color: ${({ theme }) => theme.font.color.primary};
    font-size: ${({ theme }) => theme.font.size.sm};
  }
`;

const StyledSearchPlan = styled.div`
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledSearchPlanTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledSearchPlanContent = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: break-word;
`;

const StyledEnrichmentSection = styled.div`
  margin-top: ${({ theme }) => theme.spacing(2)};
  padding-top: ${({ theme }) => theme.spacing(2)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledEnrichmentTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
`;

// const StyledEnrichmentTitle = styled.h4`
//   font-size: ${({ theme }) => theme.font.size.md};
//   font-weight: ${({ theme }) => theme.font.weight.semiBold};
//   color: ${({ theme }) => theme.font.color.primary};
//   margin: 0;
// `;

const StyledEnrichmentList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledEnrichmentItem = styled.li`
  padding: ${({ theme }) => theme.spacing(0.5)} 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  
  &::before {
    content: '•';
    color: ${({ theme }) => theme.color.blue};
    font-weight: bold;
  }
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
  const [isMinimized] = useRecoilState(isArxEnrichModalMinimizedState);
  const { enqueueSnackBar } = useSnackBar();
  const { candidateFields, fetchCandidateFields } = useFetchCandidateFields();
  // const { enrichmentProgress, isConnected, error: sseError, reconnect } = useEnrichmentProgress();
  const enrichmentProgress = null;
  const isConnected = false;
  const sseError = null;
  const reconnect = () => {};

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedJD, setUploadedJD] = useState<File | null>(null);
  const [displayedEnrichments, setDisplayedEnrichments] = useState<any[]>([]);
  const [selectedEnrichment, setSelectedEnrichment] = useState<string | null>(null);
  const [editingEnrichment, setEditingEnrichment] = useState<string | null>(null);
  const [editingInput, setEditingInput] = useState('');
  
  const chatMessagesRef = useRef<HTMLDivElement>(null);
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

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, newMessage]);
  }, []);

  // Handle natural language enrichment editing
  const handleEnrichmentEdit = useCallback(async (enrichmentId: string, userInput: string) => {
    if (!parsedJD.searchFilterId || !tokenPair?.accessToken?.token) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${parsedJD.searchFilterId}/message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${tokenPair.accessToken.token}` 
        },
        body: JSON.stringify({ 
          message: `Edit enrichment ${enrichmentId}: ${userInput}`,
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
  const handleComputeTokens = useCallback(async (enrichmentId: string) => {
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
          enrichmentId: enrichmentId,
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

  // Render enrichment card
  const renderEnrichmentCard = useCallback((enrichment: any) => (
    <StyledEnrichmentCard key={enrichment.id}>
      <StyledEnrichmentHeader>
        <StyledEnrichmentTitle>{enrichment.modelName}</StyledEnrichmentTitle>
        <StyledEditButton onClick={() => setEditingEnrichment(enrichment.id)}>
          <IconEdit size={16} />
          Edit
        </StyledEditButton>
      </StyledEnrichmentHeader>
      
      <StyledEnrichmentDetail>
        <strong>Filter Description:</strong> {enrichment.filterDescription}
      </StyledEnrichmentDetail>
      
      <StyledEnrichmentDetail>
        <strong>Prompt:</strong> {enrichment.prompt}
      </StyledEnrichmentDetail>
      
      <StyledEnrichmentDetail>
        <strong>Model:</strong> {enrichment.selectedModel}
      </StyledEnrichmentDetail>
      
      <StyledEnrichmentDetail>
        <strong>Output Columns:</strong>
        <StyledFieldList>
          {enrichment.fields?.map((field: any) => (
            <li key={field.name}>
              {field.name} ({field.type}): {field.description}
            </li>
          ))}
        </StyledFieldList>
      </StyledEnrichmentDetail>
      
      <StyledEnrichmentDetail>
        <strong>Input Fields:</strong> {enrichment.selectedMetadataFields?.join(', ')}
      </StyledEnrichmentDetail>
      
      <StyledTokenButton onClick={() => handleComputeTokens(enrichment.id)}>
        Compute Tokens
      </StyledTokenButton>
    </StyledEnrichmentCard>
  ), [handleComputeTokens]);

  // Render JD preview
  const renderJDPreview = useCallback(() => {
    if (!parsedJD.parsedJobDescription) return null;

    const jd = parsedJD.parsedJobDescription;
    return (
      <StyledJDPreview>
        <StyledJDTitle>Job Description Preview</StyledJDTitle>
        <StyledJDDetails>
          <StyledJDDetail>
            <strong>Title:</strong> <span>{jd.jobTitle}</span>
          </StyledJDDetail>
          <StyledJDDetail>
            <strong>Company:</strong> <span>{jd.company}</span>
          </StyledJDDetail>
          <StyledJDDetail>
            <strong>Location:</strong> <span>{jd.location}</span>
          </StyledJDDetail>
          <StyledJDDetail>
            <strong>Experience:</strong> <span>{jd.experienceLevel}</span>
          </StyledJDDetail>
        </StyledJDDetails>
        {jd.keywords && jd.keywords.length > 0 && (
          <div>
            <strong>Keywords:</strong>
            <div>
              {jd.keywords.map((keyword: string, index: number) => (
                <StyledChip key={index} clickable>
                  {keyword}
                </StyledChip>
              ))}
            </div>
          </div>
        )}
      </StyledJDPreview>
    );
  }, [parsedJD.parsedJobDescription]);

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
      if (editingEnrichment && userMessage.trim()) {
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

  const handleCreateEnrichments = useCallback(() => {
    if (onEnrichmentCreate && enrichments.length > 0) {
      onEnrichmentCreate(enrichments);
      addMessage({
        type: 'assistant',
        content: `Created ${enrichments.length} enrichments! These will add new columns to your candidate data.`,
      });
    }
  }, [onEnrichmentCreate, enrichments, addMessage]);

  return (
    <>
      <StyledPanelHeader>
        <IconRobot size={20} />
        <StyledPanelTitle>AI Search Assistant</StyledPanelTitle>
      </StyledPanelHeader>
      <StyledChatContainer>
        <StyledChatMessages ref={chatMessagesRef}>
          {chatMessages.map((message) => (
            <StyledMessage key={message.id} isUser={message.type === 'user'}>
              <StyledMessageIcon>
                {message.type === 'user' ? '👤' : '🤖'}
              </StyledMessageIcon>
              <StyledMessageContent isUser={message.type === 'user'}>
                {message.content}
              </StyledMessageContent>
            </StyledMessage>
          ))}
        </StyledChatMessages>

        {/* Upload Area */}
        <StyledUploadArea onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.doc,.docx';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleFileUpload(file);
          };
          input.click();
        }}>
          <IconUpload size={24} />
          <div>Upload Job Description</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            PDF, DOC, DOCX files supported
          </div>
        </StyledUploadArea>

        {/* LinkedIn Request Status */}
        <LinkedInRequestStatus />

        {/* JD Preview */}
        {renderJDPreview()}

        {/* Search Plan Selector */}
        {searchPlanManager.searchPlans.length > 1 && (
          <StyledSearchPlanSelector>
            <select
              value={searchPlanManager.currentSearchPlan?.id || ''}
              onChange={(e) => {
                const selectedPlan = searchPlanManager.searchPlans.find(plan => plan.id === e.target.value);
                if (selectedPlan) {
                  searchPlanManager.setCurrentSearchPlan(selectedPlan);
                }
              }}
            >
              {searchPlanManager.searchPlans.map(plan => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </StyledSearchPlanSelector>
        )}

        {/* Search Plan Display */}
        {searchPlanManager.currentSearchPlan && (
          <StyledSearchPlan>
            <StyledSearchPlanTitle>Current Search Plan: {searchPlanManager.currentSearchPlan.name}</StyledSearchPlanTitle>
            <StyledSearchPlanContent>
              <div><strong>Keywords:</strong> {searchPlanManager.currentSearchPlan.filters.keywords.join(', ')}</div>
              <div><strong>Job Title:</strong> {searchPlanManager.currentSearchPlan.filters.jobTitle}</div>
              <div><strong>Location:</strong> {searchPlanManager.currentSearchPlan.filters.location}</div>
              <div><strong>Industry:</strong> {searchPlanManager.currentSearchPlan.filters.industry}</div>
              <div><strong>Seniority:</strong> {searchPlanManager.currentSearchPlan.filters.seniority}</div>
            </StyledSearchPlanContent>
            
            <StyledEnrichmentSection>
              <StyledEnrichmentTitle>Enrichments</StyledEnrichmentTitle>
              <StyledEnrichmentList>
                {searchPlanManager.currentSearchPlan.enrichments.map((enrichment: string, index: number) => (
                  <StyledEnrichmentItem key={index}>{enrichment}</StyledEnrichmentItem>
                ))}
              </StyledEnrichmentList>
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
                {searchPlanManager.currentSearchPlan.columnFilters} column filters applied
              </div>
            </StyledEnrichmentSection>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              marginTop: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  if (searchPlanManager.currentSearchPlan) {
                    searchPlanManager.applySearchPlan(searchPlanManager.currentSearchPlan);
                    searchPlanFilters.applySearchPlanFilters(searchPlanManager.currentSearchPlan);
                  }
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Apply Plan
              </button>
              <button
                onClick={() => searchPlanManager.createEnrichmentsFromPlan(searchPlanManager.currentSearchPlan!)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Create Enrichments
              </button>
            </div>
          </StyledSearchPlan>
        )}

        {/* Enrichment Display */}
        {enrichments && enrichments.length > 0 && (
          <div>
            <h4>Generated Enrichments</h4>
            {enrichments.map(renderEnrichmentCard)}
          </div>
        )}

        {/* Editing Mode */}
        {editingEnrichment && (
          <div style={{ 
            padding: '16px', 
            backgroundColor: '#f3f4f6', 
            border: '1px solid #d1d5db', 
            borderRadius: '8px',
            margin: '16px 0'
          }}>
            <h4>Edit Enrichment</h4>
            <p>Describe how you want to modify this enrichment:</p>
            <input
              type="text"
              value={editingInput}
              onChange={(e) => setEditingInput(e.target.value)}
              placeholder="e.g., Change the prompt to focus more on teamwork skills"
              style={{ width: '100%', padding: '8px', marginBottom: '8px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  if (editingInput.trim()) {
                    handleEnrichmentEdit(editingEnrichment, editingInput);
                    setEditingEnrichment(null);
                    setEditingInput('');
                  }
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <IconCheck size={16} />
                Save
              </button>
              <button
                onClick={() => {
                  setEditingEnrichment(null);
                  setEditingInput('');
                }}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <IconX size={16} />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Enrichment Integration */}
        {/* {enrichments.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <ArxEnrichRightSideContainer
              closeModal={() => {}}
              objectNameSingular="job"
              objectRecordId={parsedJD.id || '0'}
              candidateFields={candidateFields}
              isLoadingFields={false}
              apiError={null}
              enrichmentProgress={enrichmentProgress}
              isConnected={isConnected}
              sseError={sseError}
              reconnect={reconnect}
              onRefresh={() => {}}
            />
          </div>
        )} */}

        {/* Chat Input */}
        <StyledChatInput>
          <StyledInput
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Refine your search..."
            disabled={isProcessing}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                handleChatSubmit(e);
              }
            }}
          />
          <StyledButton
            onClick={handleChatSubmit}
            disabled={!chatInput.trim() || isProcessing}
          >
            <IconSend size={16} />
          </StyledButton>
        </StyledChatInput>
      </StyledChatContainer>
    </>
  );
};
