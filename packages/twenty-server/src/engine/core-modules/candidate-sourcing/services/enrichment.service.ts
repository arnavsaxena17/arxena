import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    Enrichment,
    mutationToCreateOneCandidateEnrichment,
} from 'twenty-shared';

import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WebSocketGateway } from 'src/modules/websocket/websocket.gateway';
import { CandidateDataService } from './candidate-data.service';
import { CandidateFieldValueService } from './candidate-field-value.service';
import { EnrichmentConfig, EnrichmentProcessorService } from './enrichment-processor.service';

export interface ProcessEnrichmentsRequest {
  enrichments: Enrichment[];
  objectNameSingular: string;
  availableSortDefinitions: any[];
  availableFilterDefinitions: any[];
  objectRecordId: string;
  selectedRecordIds: string[];
  jobId: string;
}

export interface ProcessEnrichmentsResponse {
  status: 'Success' | 'Failed';
  error?: any;
}

@Injectable()
export class EnrichmentService {
  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly configService: ConfigService,
    private readonly webSocketGateway: WebSocketGateway,
    private readonly candidateDataService: CandidateDataService,
    private readonly candidateFieldValueService: CandidateFieldValueService,
    private readonly enrichmentProcessorService: EnrichmentProcessorService,
  ) {}

  async processEnrichments(
    request: ProcessEnrichmentsRequest,
    apiToken: string,
    origin: string,
    jobObject: any,
  ): Promise<ProcessEnrichmentsResponse> {
    let recruiterId: string | null = null;

    try {
      console.log('Processing enrichments locally in TypeScript service');
      
      // Validate input
      if (!request) {
        throw new Error('Request object is required');
      }
      
      if (!apiToken || apiToken.trim().length === 0) {
        throw new Error('API token is required');
      }
      
      const {
        enrichments,
        jobId,
        selectedRecordIds,
      } = request;

      if (!enrichments || !Array.isArray(enrichments)) {
        throw new Error('Enrichments array is required');
      }

      if (!jobId || jobId.trim().length === 0) {
        throw new Error('Job ID is required');
      }

      console.log('enrichments:', enrichments?.length);
      console.log('selectedRecordIds:', selectedRecordIds?.length);

      // Get current user to get recruiter ID for progress reporting
      try {
        const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
        recruiterId = currentUser?.workspaceMember?.id;
      } catch (userError) {
        console.warn('Could not get current user for progress reporting:', userError.message);
      }

      // Filter out enrichments with empty model names
      const validEnrichments = enrichments.filter(e => 
        e && 
        e.modelName && 
        e.modelName.trim() !== '' &&
        e.prompt &&
        e.prompt.trim() !== ''
      );
      
      if (validEnrichments.length === 0) {
        console.log('No valid enrichments to process');
        return { status: 'Success' };
      }

      console.log(`Processing ${validEnrichments.length} valid enrichments out of ${enrichments.length} total`);

      // Create enrichments in database
      for (const enrichment of validEnrichments) {
        try {
          const response = await this.createOneEnrichment(
            enrichment,
            jobObject,
            apiToken,
          );
          console.log('Response from create enrichment:', response?.id || 'Created');
        } catch (createError) {
          console.error('Error creating enrichment:', createError.message);
          // Continue with other enrichments
        }
      }

      // Report enrichment started via WebSocket
      if (recruiterId && this.webSocketGateway?.webSocketService) {
        try {
          this.webSocketGateway.webSocketService.sendToUser(recruiterId, 'enrichment-progress', {
            step: 'started',
            message: 'Enrichment processing started',
            progress_percentage: 0,
            total_enrichments: validEnrichments.length,
            current_enrichment: 0,
            timestamp: new Date().toISOString()
          });
        } catch (wsError) {
          console.warn('WebSocket notification failed:', wsError.message);
        }
      }

      // Fetch candidates data
      console.log('Fetching candidates data');
      const candidates = await this.candidateDataService.fetchCandidatesForJob(
        jobId,
        selectedRecordIds,
        apiToken
      );

      if (candidates.length === 0) {
        console.log('No candidates found for processing');
        return { status: 'Success' };
      }

      console.log(`Found ${candidates.length} candidates to process`);

      // Get OpenAI API key from environment or configuration
      const openaiApiKey = this.configService.get<string>('OPENAI_KEY') || process.env.OPENAI_KEY;
      if (!openaiApiKey) {
        throw new Error('OpenAI API key not configured. Please set OPENAI_KEY environment variable.');
      }

      // Convert enrichments to the format expected by the processor
      const enrichmentConfigs: EnrichmentConfig[] = validEnrichments.map(e => ({
        modelName: e.modelName,
        prompt: e.prompt,
        selectedModel: e.selectedModel || 'gpt-4o',
        fields: e.fields || [],
        selectedMetadataFields: e.selectedMetadataFields || [],
        embeddingsModel: false // TODO: Add embeddingsModel support if needed
      }));

      // Validate enrichment configs
      for (const config of enrichmentConfigs) {
        if (!config.fields || config.fields.length === 0) {
          throw new Error(`Enrichment "${config.modelName}" has no output fields defined`);
        }
        
        if (!config.selectedMetadataFields || config.selectedMetadataFields.length === 0) {
          throw new Error(`Enrichment "${config.modelName}" has no input fields selected`);
        }
      }

      // Process enrichments with progress reporting
      const enrichmentResults = await this.enrichmentProcessorService.processEnrichments(
        candidates,
        enrichmentConfigs,
        openaiApiKey,
        (progress, current, total) => {
          if (recruiterId && this.webSocketGateway?.webSocketService) {
            try {
              this.webSocketGateway.webSocketService.sendToUser(recruiterId, 'enrichment-progress', {
                step: 'processing',
                message: `Processing enrichments: ${current}/${total}`,
                progress_percentage: progress,
                total_records: candidates.length,
                processed_records: current,
                total_enrichments: validEnrichments.length,
                timestamp: new Date().toISOString()
              });
            } catch (wsError) {
              console.warn('WebSocket progress notification failed:', wsError.message);
            }
          }
        }
      );

      console.log(`Enrichment processing completed. Got ${enrichmentResults.length} results`);

      // Extract all field names from enrichments
      const allFieldNames = new Set<string>();
      enrichmentConfigs.forEach(config => {
        config.fields.forEach(field => allFieldNames.add(field.name));
      });

      if (allFieldNames.size === 0) {
        console.warn('No field names found in enrichment configs');
      } else {
        // Create candidate field values
        try {
          await this.candidateFieldValueService.processEnrichmentResults(
            enrichmentResults,
            Array.from(allFieldNames),
            apiToken
          );
        } catch (fieldError) {
          console.error('Error processing field values:', fieldError.message);
          // Don't fail the entire process for field value errors
        }
      }

      // Report completion via WebSocket
      if (recruiterId && this.webSocketGateway?.webSocketService) {
        try {
          this.webSocketGateway.webSocketService.sendToUser(recruiterId, 'enrichment-progress', {
            step: 'completed',
            message: 'Enrichment processing completed successfully',
            progress_percentage: 100,
            total_records: candidates.length,
            processed_records: candidates.length,
            total_enrichments: validEnrichments.length,
            timestamp: new Date().toISOString()
          });
        } catch (wsError) {
          console.warn('WebSocket completion notification failed:', wsError.message);
        }
      }

      console.log('Enrichment processing completed successfully');
      return { status: 'Success' };
    } catch (err) {
      console.error('Error in enrichment service:', err);
      
      // Report error via WebSocket
      if (recruiterId && this.webSocketGateway?.webSocketService) {
        try {
          this.webSocketGateway.webSocketService.sendToUser(recruiterId, 'enrichment-progress', {
            step: 'error',
            message: `Enrichment processing failed: ${err.message}`,
            progress_percentage: 0,
            timestamp: new Date().toISOString()
          });
        } catch (wsError) {
          console.warn('WebSocket error notification failed:', wsError.message);
        }
      }

      return { status: 'Failed', error: err.message || 'Unknown error occurred' };
    }
  }

  async createOneEnrichment(
    enrichment: Enrichment,
    jobObject: any,
    apiToken: string,
  ): Promise<any> {
    const graphqlVariables = {
      input: {
        name: enrichment.modelName,
        modelName: enrichment.modelName,
        prompt: enrichment.prompt,
        selectedModel: enrichment.selectedModel,
        fields: enrichment.fields,
        selectedMetadataFields: enrichment.selectedMetadataFields,
        jobId: jobObject?.id,
      },
    };

    const response = await this.staticGraphQLService.executeGraphQL(
      mutationToCreateOneCandidateEnrichment,
      graphqlVariables,
      apiToken
    );

    return response.data;
  }

  async computeTokens(
    request: ProcessEnrichmentsRequest,
    apiToken: string
  ): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    estimatedCost: number;
    totalCandidates: number;
  }> {
    try {
      const { enrichments, jobId, selectedRecordIds } = request;

      // Filter out enrichments with empty model names
      const validEnrichments = enrichments.filter(e => e.modelName && e.modelName.trim() !== '');

      if (validEnrichments.length === 0) {
        return {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          estimatedCost: 0,
          totalCandidates: 0
        };
      }

      // Fetch candidates data
      const candidates = await this.candidateDataService.fetchCandidatesForJob(
        jobId,
        selectedRecordIds,
        apiToken
      );

      if (candidates.length === 0) {
        return {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          estimatedCost: 0,
          totalCandidates: 0
        };
      }

      // Convert enrichments to the format expected by the processor
      const enrichmentConfigs: EnrichmentConfig[] = validEnrichments.map(e => ({
        modelName: e.modelName,
        prompt: e.prompt,
        selectedModel: e.selectedModel || 'gpt-4o',
        fields: e.fields || [],
        selectedMetadataFields: e.selectedMetadataFields || [],
        embeddingsModel: false // TODO: Add embeddingsModel support if needed
      }));

      // Compute tokens
      const tokenAnalysis = await this.enrichmentProcessorService.computeTokensForEnrichment(
        candidates,
        enrichmentConfigs
      );

      return tokenAnalysis;
    } catch (error) {
      console.error('Error computing tokens:', error);
      throw error;
    }
  }
}
