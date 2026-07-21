import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Sema } from 'async-sema';
import { OpenAI } from 'openai';
import {
  getValueFromCandidateRecord,
  hasMeaningfulCandidateFieldValue,
} from 'twenty-shared';

export interface AiFilterField {
  name: string;
  type: string;
  description?: string;
}

export interface AiFilterConfig {
  modelName: string;
  prompt: string;
  selectedModel: string;
  fields: AiFilterField[];
  selectedMetadataFields: string[];
  embeddingsModel?: boolean;
  includeResume?: boolean;
}

// Mapping from frontend model values to actual OpenAI model names
const MODEL_MAPPING: Record<string, string> = {
  'gpt35turbo': 'gpt-3.5-turbo',
  'gpt51chatlatest': 'gpt-5.1-chat-latest',
  'gpt54mini': 'gpt-5.4-mini',
  'gpt4o': 'gpt-4o',
  'gpt4omini': 'gpt-4o-mini',
  'gpt4ominisearchpreview': 'gpt-4o-mini-search-preview',
};

export interface CandidateData {
  id: string;
  [key: string]: any;
}

export interface AiFilterResult {
  candidateId: string;
  enrichedData: Record<string, any>;
}

@Injectable()
export class AiFilteringProcessorService {
  private openaiClient: OpenAI;
  private semaphore: Sema;

  constructor(private configService: ConfigService) {
    // Initialize semaphore with 10 concurrent requests
    this.semaphore = new Sema(10);
  }

  /**
   * Maps frontend model values to actual OpenAI model names
   */
  private mapModelName(frontendModel: string): string {
    const mappedModel = MODEL_MAPPING[frontendModel] || frontendModel || 'gpt-5.1-chat-latest';

    if (frontendModel && !MODEL_MAPPING[frontendModel]) {
    } else if (frontendModel && MODEL_MAPPING[frontendModel]) {
    }

    return mappedModel;
  }

  private initializeOpenAI(apiKey: string) {
    if (!this.openaiClient || this.openaiClient.apiKey !== apiKey) {
      this.openaiClient = new OpenAI({
        apiKey: apiKey,
      });
    }
  }

  async processAiFilters(
    candidates: CandidateData[],
    aiFilters: AiFilterConfig[],
    openaiApiKey: string,
    progressCallback?: (progress: number, current: number, total: number) => void | Promise<void>
  ): Promise<AiFilterResult[]> {
    this.initializeOpenAI(openaiApiKey);

    const results: AiFilterResult[] = [];
    const totalOperations = candidates.length * aiFilters.length;
    let currentOperation = 0;

    console.log(`Processing ${aiFilters.length} AI filters for ${candidates.length} candidates with parallel requests`);

    // Create all tasks upfront for parallel processing
    const allTasks: Array<{
      candidate: CandidateData;
      aiFilter: AiFilterConfig;
      taskId: string;
    }> = [];

    for (const aiFilter of aiFilters) {
      for (const candidate of candidates) {
        allTasks.push({
          candidate,
          aiFilter,
          taskId: `${candidate.id}-${aiFilter.modelName}`
        });
      }
    }

    // Process all tasks in parallel with semaphore controlling concurrency
    const taskPromises = allTasks.map(async (task) => {
      await this.semaphore.acquire();
      console.log("processing tasks for candidate name::%s", task.candidate.name);
      try {
        const filterData = await this.processSingleAiFilter(task.candidate, task.aiFilter);
        currentOperation++;

        // Report progress periodically
        if (progressCallback && currentOperation % 5 === 0) {
          const progress = Math.round((currentOperation / totalOperations) * 100);
          await progressCallback(progress, currentOperation, totalOperations);
        }

        return {
          candidateId: task.candidate.id,
          filterName: task.aiFilter.modelName,
          data: filterData
        };
      } catch (error) {
        console.error(`Error processing task ${task.taskId}:`, error);
        currentOperation++;
        return {
          candidateId: task.candidate.id,
          filterName: task.aiFilter.modelName,
          data: {}
        };
      } finally {
        this.semaphore.release();
      }
    });

    // Wait for all tasks to complete
    const taskResults = await Promise.all(taskPromises);

    // Merge results by candidate
    for (const taskResult of taskResults) {
      let existingResult = results.find(r => r.candidateId === taskResult.candidateId);

      if (!existingResult) {
        existingResult = { candidateId: taskResult.candidateId, enrichedData: {} };
        results.push(existingResult);
      }

      // Merge the filter data
      Object.assign(existingResult.enrichedData, taskResult.data);
    }

    // Final progress update
    if (progressCallback) {
      await progressCallback(100, totalOperations, totalOperations);
    }

    console.log(`Completed processing ${totalOperations} AI filter tasks`);
    return results;
  }

  private buildUserInput(
    candidate: CandidateData,
    aiFilter: AiFilterConfig,
  ): string {
    const candidateRecord = candidate as Record<string, unknown>;
    const parts = (aiFilter.selectedMetadataFields || [])
      .map((field) => {
        const value = getValueFromCandidateRecord(candidateRecord, field);
        if (!hasMeaningfulCandidateFieldValue(value)) {
          return '';
        }

        const stringValue =
          typeof value === 'object' ? JSON.stringify(value) : String(value);

        return `${field}: ${stringValue}`;
      })
      .filter(Boolean);

    if (
      aiFilter.includeResume &&
      hasMeaningfulCandidateFieldValue(candidate.resume)
    ) {
      parts.push(`resume: ${candidate.resume}`);
    }

    return parts.join('; ');
  }

  private async processSingleAiFilter(
    candidate: CandidateData,
    aiFilter: AiFilterConfig
  ): Promise<Record<string, any>> {
    try {
      const userInput = this.buildUserInput(candidate, aiFilter);

      if (!userInput.trim()) {
        console.warn(`No input data for candidate ${candidate.id} with AI filter ${aiFilter.modelName}`);
        return {};
      }

      // Get response from OpenAI
      const response = await this.getOpenAIResponse(
        aiFilter.prompt,
        userInput,
        aiFilter.selectedModel,
        aiFilter.fields
      );

      return response;
    } catch (error) {
      console.error(`Error processing AI filter for candidate ${candidate.id}:`, error);
      return {};
    }
  }

  private async getOpenAIResponse(
    systemPrompt: string,
    userInput: string,
    model: string,
    expectedFields: AiFilterField[]
  ): Promise<Record<string, any>> {
    const fieldDescriptions = expectedFields.map(f =>
      `"${f.name}": ${f.type}${f.description ? ` (${f.description})` : ''}`
    ).join(', ');

    const messages = [
      {
        role: 'system' as const,
        content: `${systemPrompt}\n\nReturn the response in JSON format with the following fields: {${fieldDescriptions}}. Make sure all field names match exactly.`
      },
      {
        role: 'user' as const,
        content: userInput
      }
    ];
    console.log("messages for getOpenAIResponse: ", messages);

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const mappedModel = this.mapModelName(model);
        const completion = await this.openaiClient.chat.completions.create({
          model: mappedModel,
          messages: messages,
          temperature: 0,
          response_format: { type: 'json_object' },
          // max_tokens: 1000,
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
          console.warn(`Empty response from OpenAI (attempt ${attempt})`);
          continue;
        }

        try {
          const parsedResponse = JSON.parse(responseText);

          // Validate and type-cast response according to field types
          const validatedResponse: Record<string, any> = {};

          for (const field of expectedFields) {
            let value = parsedResponse[field.name];

            // Try alternative key formats if exact match not found
            if (value === undefined) {
              const altKeys = [
                field.name.toLowerCase(),
                field.name.replace(/([A-Z])/g, '_$1').toLowerCase(),
                field.name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
              ];

              for (const altKey of altKeys) {
                if (parsedResponse.hasOwnProperty(altKey)) {
                  value = parsedResponse[altKey];
                  break;
                }
              }
            }

            if (value !== undefined) {
              switch (field.type.toLowerCase()) {
                case 'number':
                  const numValue = parseFloat(String(value));
                  validatedResponse[field.name] = isNaN(numValue) ? null : numValue;
                  break;
                case 'boolean':
                  if (typeof value === 'string') {
                    validatedResponse[field.name] = value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
                  } else {
                    validatedResponse[field.name] = Boolean(value);
                  }
                  break;
                case 'text':
                case 'string':
                default:
                  validatedResponse[field.name] = String(value || '');
                  break;
              }
            } else {
              // Set default values for missing fields
              switch (field.type.toLowerCase()) {
                case 'number':
                  validatedResponse[field.name] = null;
                  break;
                case 'boolean':
                  validatedResponse[field.name] = false;
                  break;
                default:
                  validatedResponse[field.name] = '';
                  break;
              }
            }
          }

          return validatedResponse;
        } catch (parseError) {
          console.error(`Error parsing OpenAI response (attempt ${attempt}):`, parseError);
          console.error('Raw response:', responseText);
          lastError = parseError;
          continue;
        }
      } catch (error) {
        console.error(`Error calling OpenAI (attempt ${attempt}):`, error);
        lastError = error;

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    console.error(`Failed to get valid response after ${maxRetries} attempts. Last error:`, lastError);
    return {};
  }

  async computeTokensForAiFilters(
    candidates: CandidateData[],
    aiFilters: AiFilterConfig[]
  ): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCost: number;
    totalCandidates: number;
  }> {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const totalCandidates = candidates.length;

    // Rough token estimation (1 token ≈ 4 characters)
    for (const aiFilter of aiFilters) {
      for (const candidate of candidates) {
        const userInput = this.buildUserInput(candidate, aiFilter);

        const inputTokens = Math.ceil((aiFilter.prompt.length + userInput.length) / 4);
        const outputTokens = Math.ceil(aiFilter.fields.length * 50 / 4); // Estimate 50 chars per field

        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;
      }
    }

    // Rough cost estimation for GPT-4o (as of 2024)
    const inputCostPer1K = 0.005; // $0.005 per 1K input tokens
    const outputCostPer1K = 0.015; // $0.015 per 1K output tokens

    const estimatedCost =
      (totalInputTokens / 1000) * inputCostPer1K +
      (totalOutputTokens / 1000) * outputCostPer1K;

    return {
      totalInputTokens,
      totalOutputTokens,
      estimatedCost,
      totalCandidates
    };
  }
}
