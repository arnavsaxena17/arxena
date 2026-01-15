import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatMessageRequest } from 'src/engine/core-modules/candidate-search/types/search-plan.types';
import { SearchParametersPrompts } from '../prompts/search-parameters-prompts';
import { CandidateSearchHandlerService } from '../services/candidate-search-handler.service';
import { SearchGenerationService } from '../services/search-generation.service';
import { extractApiToken } from '../utils/auth.utils';

@Controller('candidate-search')
export class CandidateSearchChatController {
  private readonly logger = new Logger(CandidateSearchChatController.name);

  constructor(
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly searchGenerationService: SearchGenerationService,
    private readonly searchParametersPrompts: SearchParametersPrompts,
  ) {}

  /**
   * Process chat messages with streaming support
   */
  @Post('message/stream')
  async processMessageStream(
    @Body() body: ChatMessageRequest,
    @Headers() headers: any,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    // Track if request is aborted - declare outside try block for catch block access
    let isAborted = false;
    // Track accumulated chat messages - declare outside try block for catch block access
    const accumulatedChatMessages: string[] = [];
    // Extract API token - declare outside try block for catch block access
    let apiToken: string | null = null;
    
    try {
      this.logger.log(`Processing streaming chat message for searchFilterId: ${body.searchFilterId}`);
      
      apiToken = extractApiToken(headers);
      if (!apiToken) {
        throw new Error('API token is required');
      }

      // Set up Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Track if request is aborted - listen to both response and request events
      const abortHandler = () => {
        isAborted = true;
        this.logger.log('Request aborted, stopping stream processing');
      };

      // Listen to response close event
      res.on('close', abortHandler);
      
      // Listen to request abort events (when client cancels via AbortController)
      req.on('close', abortHandler);
      req.on('aborted', abortHandler);

      const sendEvent = (event: string, data: any) => {
        // Check if request is aborted before sending
        // For SSE, focus on response and socket state, not request.destroyed
        // (request can be marked destroyed after body parsing, but response is still valid)
        if (isAborted) {
          this.logger.log(`Skipping event ${event} - request aborted (isAborted flag)`);
          return false;
        }
        
        // Check response state (most important for SSE)
        if (res.closed || res.destroyed) {
          this.logger.log(`Skipping event ${event} - response closed or destroyed`);
          isAborted = true;
          return false;
        }
        
        // Check socket state (indicates actual connection state)
        const socket = req.socket || res.socket;
        if (socket && (socket.destroyed || socket.readyState === 'closed')) {
          this.logger.log(`Skipping event ${event} - socket destroyed or closed`);
          isAborted = true;
          return false;
        }
        
        // Check if request was explicitly aborted
        if (req.aborted) {
          this.logger.log(`Skipping event ${event} - request aborted`);
          isAborted = true;
          return false;
        }
        
        // Capture chatMessage or message from event data for saving to chat history
        // Handle both 'chatMessage' (used in message events) and 'message' (used in clarification events)
        if (data?.chatMessage && typeof data.chatMessage === 'string') {
          accumulatedChatMessages.push(data.chatMessage);
          this.logger.log(`Captured chatMessage from ${event} event: ${data.chatMessage.substring(0, 100)}...`);
        } else if (data?.message && typeof data.message === 'string' && (event === 'clarification' || event === 'message')) {
          // Capture message field for clarification and message events
          accumulatedChatMessages.push(data.message);
          this.logger.log(`Captured message from ${event} event: ${data.message.substring(0, 100)}...`);
        }
        
        try {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
          return true;
        } catch (error) {
          // Connection closed or destroyed - catch write errors
          isAborted = true;
          this.logger.log(`Failed to send event ${event} - connection closed: ${error instanceof Error ? error.message : String(error)}`);
          return false;
        }
      };

      // Get search filter to access chat history and JD context
      const searchFilter = await this.candidateSearchHandlerService.getSearchFilter(body.searchFilterId, apiToken);
      const chatHistory = searchFilter.chatHistory || [];
      
      // Get raw JD text if available for context
      let rawJDText = '';
      if (body.includeJd !== false) {
        try {
          const jobId = searchFilter.jobId;
          if (jobId) {
            // Get JD content if available using the same pattern as handler service
            const candidateSearchStreamingService = this.candidateSearchHandlerService['candidateSearchStreamingService'];
            if (candidateSearchStreamingService) {
              rawJDText = await candidateSearchStreamingService['jobDescriptionService']?.getJDContentFromJobAttachments(jobId, apiToken) || '';
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch JD content: ${error.message}`);
        }
      }

      // Classify the message with chat history and JD context
      const messageClassification = await this.searchGenerationService.classifyMessage(
        body.message,
        apiToken,
        chatHistory,
        rawJDText,
      );
      
      if (isAborted) {
        this.logger.log('Request aborted after classification');
        res.end();
        return;
      }
      
      this.logger.log(`Message classified as: ${messageClassification.type} (confidence: ${messageClassification.confidence})`);
      
      if (!sendEvent('classification', {
        type: messageClassification.type,
        confidence: messageClassification.confidence,
        reasoning: messageClassification.reasoning
      })) {
        this.logger.log('Event send failed, request aborted');
        res.end();
        return;
      }

      let response: any = {};
      let assistantMessage: string | null = null; // Track assistant message to save to backend

      switch (messageClassification.type) {
        case 'clarification_response':
          // User is responding to clarification questions
          // Get the stored clarification questions
          const pendingClarification = searchFilter.searchFilterParameter?.pendingClarification;
          const clarificationQuestions = pendingClarification?.questions || [];
          
          // Combine the original query from chat history with the clarification response
          // so query understanding can merge them properly
          const previousUserMessages = chatHistory
            .filter((msg: any) => msg.role === 'user');
          // Get the last user message (which should be the original query before clarification)
          // If there are multiple user messages, get the one before the current one
          // If there's only one, that's the original query
          const originalQuery = previousUserMessages.length > 1 
            ? previousUserMessages[previousUserMessages.length - 2]?.content 
            : previousUserMessages[previousUserMessages.length - 1]?.content || body.message;
          
          // Combine original query with clarification response
          // Query understanding will use isClarificationResponse flag to merge them
          const combinedQuery = this.searchParametersPrompts.buildClarificationResponseCombinedUserQuery(
            originalQuery,
            body.message,
          );

          response = await this.candidateSearchHandlerService.handleSearchParametersAndResultsGenerationStream(
            body.searchFilterId,
            body.parsedJD,
            body.searchType || 'classic',
            body.searchCategory || 'people',
            apiToken,
            combinedQuery,
            sendEvent,
            body.includeJd !== false,
            true,
          );
          // Extract chatMessage from response
          if (response?.chatMessage) {
            assistantMessage = response.chatMessage;
          }
          break;

        case 'search_parameters':
          // Query understanding will automatically detect if clarification is needed
          // and handle it as part of the search_parameters flow
          response = await this.candidateSearchHandlerService.handleSearchParametersAndResultsGenerationStream(
            body.searchFilterId,
            body.parsedJD,
            body.searchType || 'classic',
            body.searchCategory || 'people',
            apiToken,
            body.message,
            sendEvent,
            body.includeJd !== false,
          );
          // Extract chatMessage from response
          if (response?.chatMessage) {
            assistantMessage = response.chatMessage;
          }
          break;

        case 'enrichments':
          break;

        case 'filters':
          break;

        case 'sorts':
          break;

        case 'complete_plan':
          break;

        case 'general_help':
          assistantMessage = 'I can help you with candidate search and recruitment workflows! Here\'s what I can do:\n\n' +
            '🔍 **Search Parameters** - Generate LinkedIn search criteria to find candidates\n' +
            '📊 **Enrichments** - Add AI-powered insights to candidate profiles\n' +
            '🔧 **Filters** - Create filtering strategies to narrow down candidate lists\n' +
            '📈 **Sorts** - Design sorting strategies to prioritize the best candidates\n' +
            '🎯 **Complete Plan** - Generate all components at once for a comprehensive search strategy\n\n' +
            'Try saying "generate search parameters" or "create enrichments" to get started!';
          sendEvent('message', {
            success: true,
            type: 'general_help',
            chatMessage: assistantMessage,
          });
          break;

        default:
          assistantMessage = 'I didn\'t understand your request. Please try asking for search parameters, enrichments, filters, sorts, or a complete plan.';
          sendEvent('message', {
            success: false,
            error: assistantMessage,
            chatMessage: assistantMessage,
          });
      }

      // Check if aborted before finalizing
      if (isAborted) {
        this.logger.log('Request aborted before finalizing');
        res.end();
        return;
      }

      // Add user message to chat history
      await this.candidateSearchHandlerService.addChatMessage(body.searchFilterId, 'user', body.message, apiToken);

      // Determine the final assistant message to save
      // Priority: 1) response.chatMessage, 2) last accumulated chatMessage from sendEvent, 3) assistantMessage variable
      let finalAssistantMessage: string | null = null;
      
      if (response?.chatMessage) {
        finalAssistantMessage = response.chatMessage;
        this.logger.log(`Using chatMessage from response object`);
      } else if (accumulatedChatMessages.length > 0) {
        // Use the last accumulated message (most recent)
        finalAssistantMessage = accumulatedChatMessages[accumulatedChatMessages.length - 1];
        this.logger.log(`Using last accumulated chatMessage from sendEvent calls (${accumulatedChatMessages.length} messages captured)`);
      } else if (assistantMessage) {
        finalAssistantMessage = assistantMessage;
        this.logger.log(`Using assistantMessage variable`);
      }

      // Add assistant message to chat history if we have one
      if (finalAssistantMessage) {
        try {
          await this.candidateSearchHandlerService.addChatMessage(
            body.searchFilterId,
            'assistant',
            finalAssistantMessage,
            apiToken,
          );
          this.logger.log(`Saved assistant message to chat history for searchFilterId: ${body.searchFilterId}`);
        } catch (error) {
          this.logger.error(`Failed to save assistant message to chat history: ${error.message}`);
          // Don't fail the request if saving assistant message fails
        }
      } else {
        this.logger.warn(`No assistant message found to save to chat history. Response: ${JSON.stringify(response)}, Accumulated: ${accumulatedChatMessages.length}, AssistantMessage: ${assistantMessage}`);
      }

      // Send final event with accumulated token usage and costs if available
      // Note: Token usage is sent via 'tokenUsage' events during processing
      // This final event can include summary if needed
      sendEvent('done', { 
        success: true,
        // Token usage summary will be accumulated from individual tokenUsage events
      });
      res.end();
    } catch (error) {
      this.logger.error('Error processing streaming chat message:', error);
      
      // Try to save any accumulated chat messages even on error
      if (accumulatedChatMessages.length > 0 && apiToken) {
        try {
          const lastMessage = accumulatedChatMessages[accumulatedChatMessages.length - 1];
          await this.candidateSearchHandlerService.addChatMessage(
            body.searchFilterId,
            'assistant',
            lastMessage,
            apiToken,
          );
          this.logger.log(`Saved accumulated assistant message to chat history after error`);
        } catch (saveError) {
          this.logger.error(`Failed to save accumulated assistant message after error: ${saveError.message}`);
        }
      }
      
      // Only send error if connection is still open
      if (!isAborted && !res.closed && !res.destroyed) {
        try {
          const errorMessage = error.message || 'Failed to process message';
          res.write(`event: error\n`);
          res.write(`data: ${JSON.stringify({ error: errorMessage, chatMessage: `Sorry, I encountered an error: ${errorMessage}` })}\n\n`);
          
          // Also try to save the error message to chat history if we have an API token
          if (apiToken) {
            try {
              await this.candidateSearchHandlerService.addChatMessage(
                body.searchFilterId,
                'assistant',
                `Sorry, I encountered an error: ${errorMessage}`,
                apiToken,
              );
              this.logger.log(`Saved error message to chat history`);
            } catch (saveError) {
              this.logger.error(`Failed to save error message to chat history: ${saveError.message}`);
            }
          }
        } catch (writeError) {
          this.logger.log('Failed to write error event - connection closed');
        }
      }
      
      res.end();
    }
  }

}

