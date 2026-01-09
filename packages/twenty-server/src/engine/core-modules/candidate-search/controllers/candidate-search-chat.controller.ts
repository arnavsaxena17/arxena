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
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import { CandidateSearchHandlerService } from '../services/candidate-search-handler.service';
import { SearchGenerationService } from '../services/search-generation.service';
import { extractApiToken } from '../utils/auth.utils';

@Controller('candidate-search')
export class CandidateSearchChatController {
  private readonly logger = new Logger(CandidateSearchChatController.name);

  constructor(
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly searchGenerationService: SearchGenerationService,
    private readonly workspaceQueryService: WorkspaceQueryService,
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
    
    try {
      this.logger.log(`Processing streaming chat message for searchFilterId: ${body.searchFilterId}`);
      
      const apiToken = extractApiToken(headers);
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
        // Event send failed, request aborted
        res.end();
        return;
      }

      let response: any = {};

      switch (messageClassification.type) {
        case 'clarification_response':
          // User is responding to clarification questions
          // Combine the original query from chat history with the clarification response
          // so query understanding can merge them properly
          const previousUserMessages = chatHistory
            .filter((msg: any) => msg.role === 'user')
            .slice(-2, -1); // Get the message before the current one
          const originalQuery = previousUserMessages[0]?.content || body.message;
          
          // Combine original query with clarification response
          // Query understanding will use isClarificationResponse flag to merge them
          const combinedQuery = `ORIGINAL USER QUERY (preserve ALL information from this):
          "${originalQuery}"

          USER'S CLARIFICATION ANSWERS (merge these with the original query):
          "${body.message}"

          INSTRUCTIONS:
          - Extract and preserve ALL information from the original query (role, company, industry, etc.)
          - Extract answers from the clarification response and merge them with the original query
          - The combined result should have ALL information from both the original query AND the clarification
          - Do NOT lose any information from the original query when merging`;

          response = await this.candidateSearchHandlerService.handleSearchParametersAndResultsGenerationStream(
            body.searchFilterId,
            body.parsedJD,
            body.searchType || 'classic',
            body.searchCategory || 'people',
            apiToken,
            combinedQuery,
            messageClassification.reasoning,
            sendEvent,
            body.includeJd !== false,
            undefined, // precomputedQueryUnderstanding
            false, // skipClarificationCheck
            true, // isClarificationResponse - IMPORTANT: This tells query understanding not to ask for more clarification
          );
          break;

        case 'refinement':
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
            messageClassification.reasoning,
            sendEvent,
            body.includeJd !== false,
          );
          break;

        case 'enrichments':
          // response = await this.candidateSearchHandlerService.handleEnrichmentsGenerationStream(
          //   body.searchFilterId,
          //   body.parsedJD,
          //   body.sampleResults,
          //   apiToken,
          //   sendEvent
          // );
          break;

        case 'filters':
          // response = await this.candidateSearchHandlerService.handleFiltersGenerationStream(
          //   body.searchFilterId,
          //   body.parsedJD,
          //   body.sampleResults,
          //   body.dataDistribution,
          //   apiToken,
          //   sendEvent
          // );
          break;

        case 'sorts':
          // response = await this.candidateSearchHandlerService.handleSortsGenerationStream(
          //   body.searchFilterId,
          //   body.parsedJD,
          //   body.sampleResults,
          //   apiToken,
          //   sendEvent
          // );
          break;

        case 'complete_plan':
          // response = await this.candidateSearchHandlerService.handleCompletePlanGenerationStream(
          //   body.searchFilterId,
          //   body.parsedJD,
          //   body.searchType || 'classic',
          //   body.searchCategory || 'people',
          //   body.sampleResults,
          //   body.dataDistribution,
          //   apiToken,
          //   body.message,
          //   messageClassification.reasoning,
          //   sendEvent
          // );
          break;

        case 'general_help':
          sendEvent('message', {
            success: true,
            type: 'general_help',
            chatMessage: 'I can help you with candidate search and recruitment workflows! Here\'s what I can do:\n\n' +
              '🔍 **Search Parameters** - Generate LinkedIn search criteria to find candidates\n' +
              '📊 **Enrichments** - Add AI-powered insights to candidate profiles\n' +
              '🔧 **Filters** - Create filtering strategies to narrow down candidate lists\n' +
              '📈 **Sorts** - Design sorting strategies to prioritize the best candidates\n' +
              '🎯 **Complete Plan** - Generate all components at once for a comprehensive search strategy\n\n' +
              'Try saying "generate search parameters" or "create enrichments" to get started!'
          });
          break;

        default:
          sendEvent('message', {
            success: false,
            error: 'I didn\'t understand your request. Please try asking for search parameters, enrichments, filters, sorts, or a complete plan.',
            chatMessage: 'I didn\'t understand your request. Please try asking for search parameters, enrichments, filters, sorts, or a complete plan.'
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

      // Send final event
      sendEvent('done', { success: true });
      res.end();
    } catch (error) {
      this.logger.error('Error processing streaming chat message:', error);
      
      // Only send error if connection is still open
      if (!isAborted && !res.closed && !res.destroyed) {
        try {
          res.write(`event: error\n`);
          res.write(`data: ${JSON.stringify({ error: error.message || 'Failed to process message' })}\n\n`);
        } catch (writeError) {
          this.logger.log('Failed to write error event - connection closed');
        }
      }
      
      res.end();
    }
  }

  /**
   * Process chat messages and route to appropriate services
   */
  // @Post('message')
  // async processMessage(
  //   @Body() body: ChatMessageRequest,
  //   @Headers() headers: any
  // ): Promise<ChatMessageResponse> {
  //   try {
  //     this.logger.log(`Processing chat message for searchFilterId: ${body.searchFilterId}`);
      
  //     const apiToken = extractApiToken(headers);
  //     if (!apiToken) {
  //       throw new Error('API token is required');
  //     }

  //     // Classify the message to determine what action to take
  //     const messageClassification = await this.searchGenerationService.classifyMessage(body.message, apiToken);
  //     this.logger.log(`Message classified as: ${messageClassification.type} (confidence: ${messageClassification.confidence})`);
  //     this.logger.log(`Classification reasoning: ${messageClassification.reasoning}`);

  //     let response: any = {};

  //     switch (messageClassification.type) {
  //       case 'search_parameters':
  //         // response = await this.candidateSearchHandlerService.handleSearchParametersGeneration(
  //         //   body.searchFilterId,
  //         //   body.parsedJD,
  //         //   body.searchType || 'classic',
  //         //   body.searchCategory || 'people',
  //         //   apiToken,
  //         //   body.message,
  //         //   messageClassification.reasoning
  //         // );
  //         break;

  //       case 'enrichments':
  //         // response = await this.candidateSearchHandlerService.handleEnrichmentsGeneration(
  //         //   body.searchFilterId,
  //         //   body.parsedJD,
  //         //   body.sampleResults,
  //         //   apiToken
  //         // );
  //         break;

  //       case 'filters':
  //         // response = await this.candidateSearchHandlerService.handleFiltersGeneration(
  //         //   body.searchFilterId,
  //         //   body.parsedJD,
  //         //   body.sampleResults,
  //         //   body.dataDistribution,
  //         //   apiToken
  //         // );
  //         break;

  //       case 'sorts':
  //         // response = await this.candidateSearchHandlerService.handleSortsGeneration(
  //         //   body.searchFilterId,
  //         //   body.parsedJD,
  //         //   body.sampleResults,
  //         //   apiToken
  //         // );
  //         break;

  //       case 'complete_plan':
  //         // response = await this.candidateSearchHandlerService.handleCompletePlanGeneration(
  //         //   body.searchFilterId,
  //         //   body.parsedJD,
  //         //   body.searchType || 'classic',
  //         //   body.searchCategory || 'people',
  //         //   body.sampleResults,
  //         //   body.dataDistribution,
  //         //   apiToken,
  //         //   body.message,
  //         //   messageClassification.reasoning
  //         // );
  //         break;

  //       case 'general_help':
  //         response = {
  //           success: true,
  //           type: 'general_help',
  //           chatMessage: 'I can help you with candidate search and recruitment workflows! Here\'s what I can do:\n\n' +
  //             '🔍 **Search Parameters** - Generate LinkedIn search criteria to find candidates\n' +
  //             '📊 **Enrichments** - Add AI-powered insights to candidate profiles\n' +
  //             '🔧 **Filters** - Create filtering strategies to narrow down candidate lists\n' +
  //             '📈 **Sorts** - Design sorting strategies to prioritize the best candidates\n' +
  //             '🎯 **Complete Plan** - Generate all components at once for a comprehensive search strategy\n\n' +
  //             'Try saying "generate search parameters" or "create enrichments" to get started!'
  //         };
  //         break;

  //       default:
  //         response = {
  //           success: false,
  //           error: 'I didn\'t understand your request. Please try asking for search parameters, enrichments, filters, sorts, or a complete plan.',
  //           chatMessage: 'I didn\'t understand your request. Please try asking for search parameters, enrichments, filters, sorts, or a complete plan.'
  //         };
  //     }

  //     // Add user message to chat history
  //     await this.candidateSearchHandlerService.addChatMessage(body.searchFilterId, 'user', body.message, apiToken);

  //     return response;

  //   } catch (error) {
  //     this.logger.error('Error processing chat message:', error);
  //     return {
  //       success: false,
  //       error: `Failed to process message: ${error.message}`,
  //       chatMessage: `Sorry, I encountered an error: ${error.message}`
  //     };
  //   }
  // }
}

