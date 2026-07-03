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
