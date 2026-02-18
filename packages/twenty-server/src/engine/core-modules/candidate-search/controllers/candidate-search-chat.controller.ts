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
import { CandidateSearchHandlerService } from '../services/candidate-search-handler.service';
import { extractApiToken } from '../utils/auth.utils';

@Controller('candidate-search')
export class CandidateSearchChatController {
  private readonly logger = new Logger(CandidateSearchChatController.name);

  constructor(
    private readonly candidateSearchHandlerService: CandidateSearchHandlerService,
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
      let isProcessingComplete = false;
      const abortHandler = () => {
        if (isProcessingComplete) {
          console.log('Connection closed after processing completed - this is normal');
          // Connection closed after processing completed - this is normal
          return;
        }
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

      const result = await this.candidateSearchHandlerService.handleMessageStream(
        body,
        apiToken,
        sendEvent,
      );

      if (isAborted) {
        this.logger.log('Request aborted before finalizing');
        res.end();
        return;
      }

      await this.candidateSearchHandlerService.addChatMessage(
        body.searchFilterId,
        'user',
        body.message,
        apiToken,
      );

      const finalAssistantMessage =
        result.response?.chatMessage ??
        (accumulatedChatMessages.length > 0
          ? accumulatedChatMessages[accumulatedChatMessages.length - 1]
          : null) ??
        result.assistantMessage;

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
        }
      } else {
        this.logger.warn(
          `No assistant message found to save. Response: ${JSON.stringify(result.response)}, Accumulated: ${accumulatedChatMessages.length}`,
        );
      }

      sendEvent('done', { success: true });
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

