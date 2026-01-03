import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ChatMessageRequest } from 'src/engine/core-modules/candidate-search/types/search-plan.types';
import { CandidateSearchHandlerService } from '../services/candidate-search-handler.service';
import { SearchGenerationService } from '../services/search-generation.service';
import { extractApiToken } from '../utils/auth.utils';

@Controller('candidate-search')
export class CandidateSearchChatController {
  private readonly logger = new Logger(CandidateSearchChatController.name);

  constructor(
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
    private readonly searchGenerationService: SearchGenerationService,
  ) {}

  /**
   * Process chat messages with streaming support
   */
  @Post('message/stream')
  async processMessageStream(
    @Body() body: ChatMessageRequest,
    @Headers() headers: any,
    @Res() res: Response
  ): Promise<void> {
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

      const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Classify the message
      const messageClassification = await this.searchGenerationService.classifyMessage(body.message, apiToken);
      this.logger.log(`Message classified as: ${messageClassification.type} (confidence: ${messageClassification.confidence})`);
      
      sendEvent('classification', {
        type: messageClassification.type,
        confidence: messageClassification.confidence,
        reasoning: messageClassification.reasoning
      });

      let response: any = {};

      switch (messageClassification.type) {
        case 'clarification_response':
          // Check if there's pending clarification
          const searchFilter = await this.candidateSearchHandlerService.getSearchFilter(body.searchFilterId, apiToken);
          const pendingClarification = searchFilter.searchFilterParameter?.pendingClarification;
          
          if (pendingClarification) {
            response = await this.candidateSearchHandlerService.handleClarificationResponse(
              body.searchFilterId,
              body.parsedJD,
              body.searchType || 'classic',
              body.searchCategory || 'people',
              body.message,
              apiToken,
              sendEvent,
              body.includeJd !== false,
            );
          } else {
            // No pending clarification, treat as regular search
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
          }
          break;

        case 'refinement':
        case 'search_parameters':
          response = await this.candidateSearchHandlerService.handleSearchParametersAndResultsGenerationStream(
            body.searchFilterId,
            body.parsedJD,
            body.searchType || 'classic',
            body.searchCategory || 'people',
            apiToken,
            body.message,
            messageClassification.reasoning,
            sendEvent,
            body.includeJd !== false, // Default to true if not specified
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

      // Add user message to chat history
      await this.candidateSearchHandlerService.addChatMessage(body.searchFilterId, 'user', body.message, apiToken);

      // Send final event
      sendEvent('done', { success: true });
      res.end();
    } catch (error) {
      this.logger.error('Error processing streaming chat message:', error);
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ error: error.message || 'Failed to process message' })}\n\n`);
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

