import { Injectable } from '@nestjs/common';
import { graphQltoUpdateOneCandidate, mergeOtherFields } from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { OtherFieldsService } from './other-fields.service';

export interface EnrichmentFieldData {
  name: string;
  type: string;
  description?: string;
}

@Injectable()
export class CandidateFieldValueService {
  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly otherFieldsService: OtherFieldsService,
  ) {}

  private shouldCreateOtherFieldValue(value: unknown): boolean {
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

  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

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

  async processAiFilterResults(
    enrichmentResults: Array<{ candidateId: string; enrichedData: Record<string, any> }>,
    aiFilterFields: string[],
    apiToken: string,
    batchSize: number = 50
  ): Promise<void> {
    console.log('Processing enrichment results to update candidate.otherFields');

    try {
      const validResults = this.filterValidCandidateIds(enrichmentResults);
      
      if (validResults.length === 0) {
        console.warn('No valid enrichment results with proper candidate ID format found');
        return;
      }
      
      if (validResults.length !== enrichmentResults.length) {
        console.warn(`Filtered out ${enrichmentResults.length - validResults.length} enrichment results with invalid candidate ID format`);
      }

      for (let i = 0; i < validResults.length; i += batchSize) {
        const batch = validResults.slice(i, i + batchSize);
        console.log(`Processing enrichment batch ${Math.floor(i / batchSize) + 1} with ${batch.length} candidates`);

        await Promise.all(
          batch.map(async (result) => {
            const patch: Record<string, unknown> = {};

            for (const fieldName of aiFilterFields) {
              const fieldValue = result.enrichedData[fieldName];

              if (!this.shouldCreateOtherFieldValue(fieldValue)) {
                continue;
              }

              patch[fieldName] = fieldValue;
            }

            if (Object.keys(patch).length === 0) {
              return;
            }

            const candidate = await this.otherFieldsService.fetchCandidateById(
              result.candidateId,
              apiToken,
            );

            if (candidate) {
              await this.otherFieldsService.lazyMigrateCandidateOtherFields(
                candidate,
                apiToken,
              );
            }

            const current = candidate
              ? this.otherFieldsService.resolveOtherFields(candidate)
              : {};
            const merged = mergeOtherFields(current, patch);

            await this.staticGraphQLService.executeGraphQL(
              graphQltoUpdateOneCandidate,
              {
                idToUpdate: result.candidateId,
                input: { otherFields: merged },
              },
              apiToken,
            );
          }),
        );
      }

      console.log('Completed processing enrichment results');
    } catch (error) {
      console.error('Error processing enrichment results:', error);
      throw error;
    }
  }
}
