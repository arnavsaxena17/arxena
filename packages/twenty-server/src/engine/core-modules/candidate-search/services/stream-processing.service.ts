import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';

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
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    return openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      stream: true,
      response_format: responseFormat,
    });
  }

  /**
   * Process stream chunks and accumulate content
   */
  async processStreamChunks(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    sendEvent?: (event: string, data: any) => boolean | void,
    timeoutMs: number = 60000, // 60 second timeout
  ): Promise<string> {
    let fullContent = '';
    
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Stream timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const streamPromise = (async () => {
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
      }
      return fullContent;
    })();

    try {
      return await Promise.race([streamPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error(`Stream processing error: ${error}`);
      // Return partial content if available, otherwise empty
      return fullContent || '';
    }
  }

  /**
   * Create a streaming OpenAI chat completion with tool calling support
   */
  async createStreamingCompletionWithTools(
    openaiClient: OpenAI,
    messages: Array<{ role: 'system' | 'user' | 'tool'; content: string; tool_call_id?: string }>,
    responseFormat: ReturnType<typeof zodResponseFormat>,
    tools: OpenAI.Chat.Completions.ChatCompletionTool[],
    toolChoice?: 'auto' | 'required' | { type: 'function'; function: { name: string } },
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    return openaiClient.chat.completions.create({
      model: 'gpt-4.1',
      messages: messages as any,
      stream: true,
      response_format: responseFormat,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: toolChoice,
    });
  }

  /**
   * Process stream chunks with tool call handling
   * Handles tool calls in streaming responses and executes them
   */
  async processStreamChunksWithTools(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    executeTool: (toolName: string, args: any) => Promise<string>,
    sendEvent?: (event: string, data: any) => boolean | void,
    timeoutMs: number = 120000, // 120 second timeout for tool calls
  ): Promise<{ content: string; toolCalls: Array<{ id: string; name: string; args: any; result: string }> }> {
    let fullContent = '';
    const toolCalls: Array<{ id: string; name: string; args: any; result: string }> = [];
    const pendingToolCalls = new Map<string, { name: string; args: any }>();

    const timeoutPromise = new Promise<{ content: string; toolCalls: typeof toolCalls }>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Stream timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const streamPromise = (async () => {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        
        // Handle content delta
        if (delta?.content) {
          fullContent += delta.content;
          const eventSent = sendEvent?.('chunk', { content: delta.content });
          if (eventSent === false) {
            this.logger.log('Stream aborted during chunk processing');
            break;
          }
        }

        // Handle tool call deltas
        if (delta?.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            if (toolCallDelta.id) {
              if (!pendingToolCalls.has(toolCallDelta.id)) {
                pendingToolCalls.set(toolCallDelta.id, {
                  name: toolCallDelta.function?.name || '',
                  args: {},
                });
              }

              const pending = pendingToolCalls.get(toolCallDelta.id)!;
              if (toolCallDelta.function?.name) {
                pending.name = toolCallDelta.function.name;
              }
              if (toolCallDelta.function?.arguments) {
                try {
                  const currentArgs = JSON.parse(pending.args as any || '{}');
                  const newArgs = JSON.parse(toolCallDelta.function.arguments);
                  pending.args = JSON.stringify({ ...currentArgs, ...newArgs });
                } catch {
                  // If not JSON yet, accumulate as string
                  pending.args = (pending.args as any || '') + toolCallDelta.function.arguments;
                }
              }
            }
          }
        }
      }

      // Execute all pending tool calls
      for (const [id, toolCall] of pendingToolCalls.entries()) {
        try {
          const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args;
          const result = await executeTool(toolCall.name, args);
          toolCalls.push({
            id,
            name: toolCall.name,
            args,
            result,
          });
          this.logger.log(`Executed tool call: ${toolCall.name}`);
        } catch (error) {
          this.logger.error(`Failed to execute tool call ${toolCall.name}: ${error}`);
          toolCalls.push({
            id,
            name: toolCall.name,
            args: toolCall.args,
            result: JSON.stringify({ error: `Tool execution failed: ${error}` }),
          });
        }
      }

      return { content: fullContent, toolCalls };
    })();

    try {
      return await Promise.race([streamPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error(`Stream processing error: ${error}`);
      return { content: fullContent || '', toolCalls };
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
    timeoutMs: number = 30000, // 30 second timeout (reduced from 60s)
  ): Promise<string> {
    let fullContent = '';
    let consecutiveWhitespaceChunks = 0;
    const maxWhitespaceChunks = 50; // If we get 50 consecutive whitespace-only chunks, assume stuck
    let lastNonWhitespaceTime = Date.now();
    const maxIdleTime = 5000; // 5 seconds without non-whitespace content
    
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Stream timeout after ${timeoutMs}ms for candidate ${candidateName}`));
      }, timeoutMs);
    });

    const streamPromise = (async () => {
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
                  return fullContent;
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
                  this.logger.log(`Complete JSON detected early for candidate ${candidateName}, exiting stream`);
                  return fullContent;
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
                return fullContent;
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
      }
      return fullContent;
    })();

    try {
      return await Promise.race([streamPromise, timeoutPromise]);
    } catch (error) {
      this.logger.error(`Stream processing error for candidate ${candidateName}: ${error}`);
      // Return partial content if available, otherwise empty
      return fullContent || '';
    }
  }
}

