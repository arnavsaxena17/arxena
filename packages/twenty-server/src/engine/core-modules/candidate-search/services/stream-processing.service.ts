import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { TokenUsage } from '../utils/token-tracking.util';

export type StreamProcessingResult = {
  content: string;
  usage?: TokenUsage;
};

@Injectable()
export class StreamProcessingService {
  private readonly logger = new Logger(StreamProcessingService.name);

  /**
   * Create a streaming OpenAI chat completion
   */
  async createStreamingCompletion(
    openaiClient: OpenAI,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    responseFormat: ReturnType<typeof zodResponseFormat>,
    model: string = 'gpt-5.1-chat-latest',
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    return openaiClient.chat.completions.create({
      model,
      messages,
      stream: true,
      response_format: responseFormat,
    });
  }

  /**
   * Process stream chunks and accumulate content
   * Returns both content and token usage information
   */
  async processStreamChunks(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    sendEvent?: (event: string, data: any) => boolean | void,
    timeoutMs: number = 60000, // 60 second timeout
  ): Promise<StreamProcessingResult> {
    let fullContent = '';
    let usage: TokenUsage | undefined;
    
    const timeoutPromise = new Promise<StreamProcessingResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Stream timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const streamPromise = (async (): Promise<StreamProcessingResult> => {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          // Check if aborted after processing chunk
          const eventSent = sendEvent?.('chunk', { content: delta });
          if (eventSent === false) {
            this.logger.log('Stream aborted during chunk processing');
            break;
          }
        }

        // Capture usage information from the final chunk (silently, no event sent)
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0,
            cachedTokens: (chunk.usage as any).cached_tokens || undefined,
          };
        }
      }
      return { content: fullContent, usage };
    })();

    try {
      return await Promise.race([streamPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error(`Stream processing error: ${error}`);
      // If we have content, check if it's valid JSON
      // If it would cause a parse error, return empty string to trigger default handling
      if (fullContent && fullContent.trim().length > 0) {
        try {
          // Try to extract and parse JSON
          const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            JSON.parse(jsonMatch[0]);
            // Valid JSON found, return it
            return { content: fullContent, usage };
          }
        } catch (parseError) {
          // Content exists but can't be parsed - return empty
          this.logger.warn(`Partial content cannot be parsed, returning empty`);
          return { content: '', usage };
        }
      }
      // No content or empty content
      return { content: '', usage };
    }
  }



  /**
   * Process stream chunks with candidate-specific context for parallel scoring display
   */
  async processStreamChunksForCandidate(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    candidateIndex: number,
    totalCandidates: number,
    candidateName: string,
    sendEvent?: (event: string, data: any) => boolean | void,
    timeoutMs: number = 60000, // 60 second timeout
  ): Promise<StreamProcessingResult> {
    let fullContent = '';
    let usage: TokenUsage | undefined;
    let consecutiveWhitespaceChunks = 0;
    const maxWhitespaceChunks = 50; // If we get 50 consecutive whitespace-only chunks, assume stuck
    let lastNonWhitespaceTime = Date.now();
    const maxIdleTime = 5000; // 5 seconds without non-whitespace content
    
    const timeoutPromise = new Promise<StreamProcessingResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Stream timeout after ${timeoutMs}ms for candidate ${candidateName}`));
      }, timeoutMs);
    });

    const streamPromise = (async (): Promise<StreamProcessingResult> => {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          const isWhitespaceOnly = /^\s*$/.test(delta);
          
          if (isWhitespaceOnly) {
            consecutiveWhitespaceChunks++;
            // If we have valid JSON already, stop on excessive whitespace
            if (consecutiveWhitespaceChunks > maxWhitespaceChunks && fullContent.trim().length > 0) {
              // Try to extract JSON - if we have valid JSON, return it
              const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                try {
                  JSON.parse(jsonMatch[0]);
                  this.logger.log(`Stream appears complete (excessive whitespace) for candidate ${candidateName}, returning existing JSON`);
                  return { content: fullContent, usage };
                } catch {
                  // Not valid JSON yet, continue
                }
              }
            }
          } else {
            consecutiveWhitespaceChunks = 0;
            lastNonWhitespaceTime = Date.now();
          }
          
          fullContent += delta;
          
          // Check if we have complete JSON and can exit early
          if (fullContent.trim().length > 50) {
            const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const testJson = JSON.parse(jsonMatch[0]);
                // If JSON is complete and has all required fields, we can exit early
                if (testJson.relevanceScore !== undefined && testJson.relevanceLabel !== undefined) {
                  return { content: fullContent, usage };
                }
              } catch {
                // Not complete JSON yet, continue
              }
            }
          }
          
          // Check for idle timeout (no non-whitespace content for too long)
          const idleTime = Date.now() - lastNonWhitespaceTime;
          if (idleTime > maxIdleTime && fullContent.trim().length > 0) {
            // Try to extract valid JSON before giving up
            const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                JSON.parse(jsonMatch[0]);
                this.logger.log(`Stream idle timeout for candidate ${candidateName}, but valid JSON found, returning`);
                return { content: fullContent, usage };
              } catch {
                // Not valid JSON, continue waiting
              }
            }
          }
          
          // Send candidate-specific chunk event so frontend can show reasoning per candidate
          const eventSent = sendEvent?.('candidateScoringChunk', {
            candidateIndex: candidateIndex + 1,
            totalCandidates,
            candidateName,
            content: delta,
            message: `Analyzing candidate ${candidateIndex + 1}/${totalCandidates}: ${candidateName}...`,
          });
          if (eventSent === false) {
            this.logger.log('Stream aborted during candidate chunk processing');
            break;
          }
        }

        // Capture usage information from the final chunk
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens || 0,
            completionTokens: chunk.usage.completion_tokens || 0,
            totalTokens: chunk.usage.total_tokens || 0,
            cachedTokens: (chunk.usage as any).cached_tokens || undefined,
          };
        }
      }
      return { content: fullContent, usage };
    })();

    try {
      return await Promise.race([streamPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error(`Stream processing error for candidate ${candidateName}: ${error}`);
      // If we have content, check if it's valid JSON
      // If it would cause a parse error, return empty string to trigger default score
      if (fullContent && fullContent.trim().length > 0) {
        try {
          // Try to extract and parse JSON
          const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            JSON.parse(jsonMatch[0]);
            // Valid JSON found, return it
            return { content: fullContent, usage };
          }
        } catch (parseError) {
          // Content exists but can't be parsed - return empty to trigger default score
          this.logger.warn(`Partial content for candidate ${candidateName} cannot be parsed, returning empty to use default score`);
          return { content: '', usage };
        }
      }
      // No content or empty content
      return { content: '', usage };
    }
  }
}

