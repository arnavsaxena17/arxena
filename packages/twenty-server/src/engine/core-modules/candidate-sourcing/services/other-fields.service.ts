import { Injectable } from '@nestjs/common';
import {
  CandidateWithCustomFields,
  FindOneJob,
  getResolvedOtherFields,
  graphqlToFetchAllCandidateDataWithFieldValues,
  graphQltoUpdateOneCandidate,
  isOtherFieldsEmpty,
  mergeOtherFields,
  OtherFieldsRecord,
  questionsRequireAnswerRemap,
  remapOtherFieldsForQuestionChanges,
  UpdateOneJob
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';

type CandidateNodeResponse = CandidateWithCustomFields & {
  id?: string;
};

@Injectable()
export class OtherFieldsService {
  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

  resolveOtherFields(candidate: CandidateWithCustomFields): OtherFieldsRecord {
    return getResolvedOtherFields(candidate);
  }

  async fetchCandidateById(
    candidateId: string,
    apiToken: string,
  ): Promise<CandidateNodeResponse | undefined> {
    const response = await this.staticGraphQLService.executeGraphQL(
      graphqlToFetchAllCandidateDataWithFieldValues,
      { filter: { id: { eq: candidateId } }, limit: 1 },
      apiToken,
    );

    return response?.data?.data?.candidates?.edges?.[0]?.node as
      | CandidateNodeResponse
      | undefined;
  }

  async fetchCandidateOtherFields(
    candidateId: string,
    apiToken: string,
  ): Promise<OtherFieldsRecord> {
    const candidate = await this.fetchCandidateById(candidateId, apiToken);

    return candidate ? this.resolveOtherFields(candidate) : {};
  }

  async patchCandidateOtherFields(
    candidateId: string,
    patch: Record<string, unknown>,
    apiToken: string,
    existingOtherFields?: OtherFieldsRecord,
  ): Promise<OtherFieldsRecord> {
    const current =
      existingOtherFields ??
      (await this.fetchCandidateOtherFields(candidateId, apiToken));
    const merged = mergeOtherFields(current, patch);

    await this.staticGraphQLService.executeGraphQL(
      graphQltoUpdateOneCandidate,
      {
        idToUpdate: candidateId,
        input: { otherFields: merged },
      },
      apiToken,
    );

    return merged;
  }

  async lazyMigrateCandidateOtherFields(
    candidate: CandidateNodeResponse,
    apiToken: string,
  ): Promise<OtherFieldsRecord> {
    const resolved = this.resolveOtherFields(candidate);

    if (!candidate?.id || !isOtherFieldsEmpty(candidate.otherFields)) {
      return resolved;
    }

    if (isOtherFieldsEmpty(resolved)) {
      return {};
    }

    await this.staticGraphQLService.executeGraphQL(
      graphQltoUpdateOneCandidate,
      {
        idToUpdate: candidate.id,
        input: { otherFields: resolved },
      },
      apiToken,
    );

    return resolved;
  }

  async lazyMigrateCandidates(
    candidates: CandidateNodeResponse[],
    apiToken: string,
  ): Promise<CandidateNodeResponse[]> {
    const migratedCandidates: CandidateNodeResponse[] = [];

    for (const candidate of candidates) {
      try {
        const otherFields = await this.lazyMigrateCandidateOtherFields(
          candidate,
          apiToken,
        );

        migratedCandidates.push({
          ...candidate,
          otherFields,
        });
      } catch (error) {
        console.error(
          `Failed to lazy-migrate otherFields for candidate ${candidate?.id}:`,
          error,
        );

        migratedCandidates.push({
          ...candidate,
          otherFields: this.resolveOtherFields(candidate),
        });
      }
    }

    return migratedCandidates;
  }

  async fetchJobChatQuestions(
    jobId: string,
    apiToken: string,
  ): Promise<string[]> {
    const response = await this.staticGraphQLService.executeGraphQL(
      FindOneJob,
      { objectRecordId: jobId },
      apiToken,
    );

    const job = response?.data?.data?.job as
      | { chatQuestions?: string[] | null }
      | undefined;

    return Array.isArray(job?.chatQuestions)
      ? job.chatQuestions.filter((question) => question?.trim())
      : [];
  }

  async updateJobChatQuestions(
    jobId: string,
    chatQuestions: string[],
    apiToken: string,
    previousQuestions: string[] = [],
  ): Promise<string[]> {
    const normalizedQuestions = chatQuestions
      .map((question) => question.trim())
      .filter(Boolean);

    await this.staticGraphQLService.executeGraphQL(
      UpdateOneJob,
      {
        idToUpdate: jobId,
        input: { chatQuestions: normalizedQuestions },
      },
      apiToken,
    );

    if (
      previousQuestions.length > 0 &&
      questionsRequireAnswerRemap(previousQuestions, normalizedQuestions)
    ) {
      await this.remapCandidateAnswersForQuestionChanges(
        jobId,
        previousQuestions,
        normalizedQuestions,
        apiToken,
      );
    }

    return normalizedQuestions;
  }

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
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    return uuidRegex.test(id);
  }

  async processAiFilterResults(
    enrichmentResults: Array<{
      candidateId: string;
      enrichedData: Record<string, unknown>;
    }>,
    aiFilterFields: string[],
    apiToken: string,
    batchSize: number = 50,
  ): Promise<void> {
    console.log('Processing enrichment results to update candidate.otherFields');

    const validResults = enrichmentResults.filter((result) => {
      if (this.isValidUUID(result.candidateId)) {
        return true;
      }

      console.warn(
        `Skipping enrichment result with invalid candidate ID: ${result.candidateId}`,
      );

      return false;
    });

    if (validResults.length === 0) {
      console.warn('No valid enrichment results with proper candidate ID format found');
      return;
    }

    if (validResults.length !== enrichmentResults.length) {
      console.warn(
        `Filtered out ${enrichmentResults.length - validResults.length} enrichment results with invalid candidate ID format`,
      );
    }

    for (let index = 0; index < validResults.length; index += batchSize) {
      const batch = validResults.slice(index, index + batchSize);
      console.log(
        `Processing enrichment batch ${Math.floor(index / batchSize) + 1} with ${batch.length} candidates`,
      );

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

          const candidate = await this.fetchCandidateById(
            result.candidateId,
            apiToken,
          );

          if (candidate) {
            await this.lazyMigrateCandidateOtherFields(candidate, apiToken);
          }

          await this.patchCandidateOtherFields(
            result.candidateId,
            patch,
            apiToken,
            candidate ? this.resolveOtherFields(candidate) : undefined,
          );
        }),
      );
    }

    console.log('Completed processing enrichment results');
  }

  private async remapCandidateAnswersForQuestionChanges(
    jobId: string,
    oldQuestions: string[],
    newQuestions: string[],
    apiToken: string,
  ): Promise<void> {
    let lastCursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateDataWithFieldValues,
        {
          lastCursor,
          limit: 100,
          filter: { jobsId: { eq: jobId } },
        },
        apiToken,
      );

      const candidates = response?.data?.data?.candidates;
      const edges = candidates?.edges ?? [];

      for (const edge of edges) {
        const candidate = edge?.node as CandidateNodeResponse | undefined;

        if (!candidate?.id) {
          continue;
        }

        const resolved = this.resolveOtherFields(candidate);
        const remapped = remapOtherFieldsForQuestionChanges(
          resolved,
          oldQuestions,
          newQuestions,
        );

        if (JSON.stringify(remapped) !== JSON.stringify(resolved)) {
          await this.staticGraphQLService.executeGraphQL(
            graphQltoUpdateOneCandidate,
            {
              idToUpdate: candidate.id,
              input: { otherFields: remapped },
            },
            apiToken,
          );
        }
      }

      hasNextPage = candidates?.pageInfo?.hasNextPage ?? false;
      lastCursor = candidates?.pageInfo?.endCursor ?? null;
    }
  }
}
