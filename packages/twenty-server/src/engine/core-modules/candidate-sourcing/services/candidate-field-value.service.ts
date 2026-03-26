import { Injectable } from '@nestjs/common';
import {
    CreateManyCandidateFieldValues,
    createOneCandidateField,
    graphqlQueryToFindManyCandidateFields,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';

export interface CandidateFieldValue {
  candidateId: string;
  candidateFieldsId: string;
  name: string;
}

export interface EnrichmentFieldData {
  name: string;
  type: string;
  description?: string;
}

@Injectable()
export class CandidateFieldValueService {
  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  private shouldCreateCandidateFieldValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      const normalizedValue = value.trim();

      return normalizedValue !== '' && normalizedValue !== '0';
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }

    return true;
  }

  async checkCandidateFieldExists(fieldName: string, apiToken: string): Promise<string | null> {
    console.log(`Checking if field exists: ${fieldName}`);
    
    try {
      const variables = {
        filter: {
          name: { eq: fieldName }
        },
        limit: 1
      };

      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlQueryToFindManyCandidateFields,
        variables,
        apiToken
      );

      if (response.data?.errors) {
        console.error(`Error checking field existence:`, response.data.errors);
        return null;
      }

      const edges = response.data?.data?.candidateFields?.edges || [];
      
      if (edges.length > 0 && edges[0].node) {
        const fieldId = edges[0].node.id;
        console.log(`Field ${fieldName} exists with ID: ${fieldId}`);
        return fieldId;
      }

      console.log(`Field ${fieldName} does not exist`);
      return null;
    } catch (error) {
      console.error(`Error checking if field exists:`, error);
      return null;
    }
  }

  async createCandidateField(fieldName: string, apiToken: string): Promise<string | null> {
    console.log(`Creating candidate field: ${fieldName}`);
    
    try {
      const variables = {
        input: {
          name: fieldName,
          candidateFieldType: 'Text' // Default type
        }
      };

      const response = await this.staticGraphQLService.executeGraphQL(
        createOneCandidateField,
        variables,
        apiToken
      );

      if (response.data?.errors) {
        console.error(`Error creating candidate field:`, response.data.errors);
        return null;
      }

      const fieldId = response.data?.data?.createCandidateField?.id;
      
      if (fieldId) {
        console.log(`Created field ${fieldName} with ID: ${fieldId}`);
        return fieldId;
      } else {
        console.error(`Failed to create field ${fieldName}: No ID returned`);
        return null;
      }
    } catch (error) {
      console.error(`Error creating candidate field ${fieldName}:`, error);
      return null;
    }
  }

  async ensureFieldExists(fieldName: string, apiToken: string): Promise<string | null> {
    // First check if field exists
    let fieldId = await this.checkCandidateFieldExists(fieldName, apiToken);
    
    // If not, create it
    if (!fieldId) {
      fieldId = await this.createCandidateField(fieldName, apiToken);
    }
    
    return fieldId;
  }

  /**
   * Filters enrichment results to only include those with valid UUID candidate IDs
   */
  private filterValidCandidateIds(
    enrichmentResults: Array<{ candidateId: string; enrichedData: Record<string, any> }>
  ): Array<{ candidateId: string; enrichedData: Record<string, any> }> {
    return enrichmentResults.filter(result => {
      if (this.isValidUUID(result.candidateId)) {
        return true;
      } else {
        console.warn(`Skipping enrichment result with invalid candidate ID: ${result.candidateId}`);
        return false;
      }
    });
  }

  /**
   * Checks if a string is a valid UUID format
   */
  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  async createFieldValuesBatch(
    fieldValues: CandidateFieldValue[],
    apiToken: string
  ): Promise<boolean> {
    if (!fieldValues || fieldValues.length === 0) {
      console.log('No field values to create in batch');
      return true;
    }

    console.log(`Creating batch of ${fieldValues.length} field values`);

    try {
      const variables = {
        data: fieldValues
      };

      const response = await this.staticGraphQLService.executeGraphQL(
        CreateManyCandidateFieldValues,
        variables,
        apiToken
      );

      if (response.data?.errors) {
        console.error('Error creating field values batch:', response.data.errors);
        return false;
      }

      const createdCount = response.data?.data?.createCandidateFieldValues?.length || 0;
      console.log(`Successfully created ${createdCount} field values`);
      return true;
    } catch (error) {
      console.error('Error creating field values batch:', error);
      return false;
    }
  }

  async processAiFilterResults(
    enrichmentResults: Array<{ candidateId: string; enrichedData: Record<string, any> }>,
    aiFilterFields: string[],
    apiToken: string,
    batchSize: number = 50
  ): Promise<void> {
    console.log('Processing enrichment results to create candidate field values');

    try {
      // Filter out results with invalid candidate IDs
      const validResults = this.filterValidCandidateIds(enrichmentResults);
      
      if (validResults.length === 0) {
        console.warn('No valid enrichment results with proper candidate ID format found');
        return;
      }
      
      if (validResults.length !== enrichmentResults.length) {
        console.warn(`Filtered out ${enrichmentResults.length - validResults.length} enrichment results with invalid candidate ID format`);
      }

      // Ensure all fields exist and get their IDs
      const fieldIdMap = new Map<string, string>();
      
      for (const fieldName of aiFilterFields) {
        const fieldId = await this.ensureFieldExists(fieldName, apiToken);
        if (fieldId) {
          fieldIdMap.set(fieldName, fieldId);
        } else {
          console.error(`Failed to ensure field exists: ${fieldName}`);
        }
      }

      // Prepare all field values to create
      const allFieldValues: CandidateFieldValue[] = [];

      for (const result of validResults) {
        for (const [fieldName, fieldValue] of Object.entries(result.enrichedData)) {
          const fieldId = fieldIdMap.get(fieldName);
          
          if (!fieldId) {
            console.warn(`Skipping field ${fieldName} - no field ID found`);
            continue;
          }

          if (!this.shouldCreateCandidateFieldValue(fieldValue)) {
            continue;
          }

          allFieldValues.push({
            candidateId: result.candidateId,
            candidateFieldsId: fieldId,
            name: String(fieldValue)
          });
        }
      }

      console.log(`Processing ${allFieldValues.length} field values in batches of ${batchSize}`);

      // Process in batches
      for (let i = 0; i < allFieldValues.length; i += batchSize) {
        const batch = allFieldValues.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} with ${batch.length} field values`);
        
        const success = await this.createFieldValuesBatch(batch, apiToken);
        
        if (!success) {
          console.error(`Failed to create batch ${Math.floor(i / batchSize) + 1}`);
        }
      }

      console.log('Completed processing enrichment results');
    } catch (error) {
      console.error('Error processing enrichment results:', error);
      throw error;
    }
  }
}
