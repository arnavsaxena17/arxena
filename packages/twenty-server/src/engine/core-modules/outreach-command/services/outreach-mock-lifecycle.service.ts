import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { graphQltoUpdateOneCandidate, graphqlQueryToRemoveMessages } from 'twenty-shared';
import { isDefined, isValidUuid } from 'twenty-shared/utils';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { OutreachInboundReplyWindowService } from 'src/engine/core-modules/outreach-command/jobs/outreach-inbound-reply-window.job';
import { OutreachCandidateJourneyService } from 'src/engine/core-modules/outreach-command/services/outreach-candidate-journey.service';
import { OutreachCommandMaterializeService } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';
import { UploadProfilesService } from 'src/engine/core-modules/outreach-command/services/upload-profiles.service';
import {
  buildOutreachMockUploadPeople,
  resolveOutreachMockUploadCount,
} from 'src/engine/core-modules/outreach-command/utils/build-outreach-mock-upload-people.util';

export type OutreachMockResetTarget = 'CONNECTION_SENT' | 'QUEUED';

export type OutreachMockHitlDecision = 'approve' | 'reject' | 'edit';

@Injectable()
export class OutreachMockLifecycleService {
  private readonly logger = new Logger(OutreachMockLifecycleService.name);

  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly materializeService: OutreachCommandMaterializeService,
    private readonly inboundReplyWindowService: OutreachInboundReplyWindowService,
    private readonly outreachCandidateJourneyService: OutreachCandidateJourneyService,
    private readonly uploadProfilesService: UploadProfilesService,
  ) {}

  async acceptConnection({
    candidateId,
    apiToken,
  }: {
    candidateId: string;
    apiToken: string;
  }): Promise<{ ok: true; candidateId: string; event: 'connection_accepted' }> {
    await this.materializeService.applyCandidateEvent({
      candidateId,
      event: 'connection_accepted',
      apiToken,
      messagingChannel: 'LINKEDIN_CONNECT',
    });

    this.logger.log(
      `OUTREACH_MOCK: connection_accepted for candidate ${candidateId}`,
    );

    return { ok: true, candidateId, event: 'connection_accepted' };
  }

  async injectReply({
    workspaceId,
    candidateId,
    apiToken,
    text,
    delayMinutes = 0,
  }: {
    workspaceId: string;
    candidateId: string;
    apiToken: string;
    text: string;
    delayMinutes?: number;
  }): Promise<{
    ok: true;
    candidateId: string;
    delayMinutes: number;
  }> {
    const content = text.trim();
    const resolvedDelayMinutes =
      typeof delayMinutes === 'number' && Number.isFinite(delayMinutes)
        ? delayMinutes
        : 0;

    await this.inboundReplyWindowService.schedule({
      workspaceId,
      candidateId,
      apiToken,
      kind: 'outreach',
      channel: 'LINKEDIN',
      delayMinutes: resolvedDelayMinutes,
      turn: {
        role: 'user',
        content,
        externalMessageId: `mock-inbound-${candidateId}-${Date.now()}`,
        receivedAt: new Date().toISOString(),
      },
    });

    this.logger.log(
      `OUTREACH_MOCK: scheduled inbound reply for candidate ${candidateId} delay=${resolvedDelayMinutes}m`,
    );

    return {
      ok: true,
      candidateId,
      delayMinutes: resolvedDelayMinutes,
    };
  }

  async decideHitlForm({
    workspaceId,
    candidateId,
    apiToken,
    decision,
    editedBody,
    startsAt,
    endsAt,
    projectId: projectIdOverride,
  }: {
    workspaceId: string;
    candidateId: string;
    apiToken: string;
    decision: OutreachMockHitlDecision;
    editedBody?: string;
    startsAt?: string;
    endsAt?: string;
    projectId?: string;
  }) {
    const projectId =
      projectIdOverride ??
      (await this.resolveCandidateProjectId({ candidateId, apiToken }));

    const result =
      await this.outreachCandidateJourneyService.decidePendingHitlForm({
        workspaceId,
        projectId,
        candidateId,
        decision,
        editedBody,
        startsAt,
        endsAt,
      });

    this.logger.log(
      `OUTREACH_MOCK: HITL ${result.decision} for candidate ${candidateId} run=${result.workflowRunId} step=${result.stepId}`,
    );

    return {
      ok: true as const,
      candidateId,
      projectId,
      ...result,
    };
  }

  async resetFromConnectionRequest({
    workspaceId,
    candidateId,
    apiToken,
    to = 'CONNECTION_SENT',
  }: {
    workspaceId: string;
    candidateId: string;
    apiToken: string;
    to?: OutreachMockResetTarget;
  }): Promise<{
    ok: true;
    candidateId: string;
    outreachSequenceStage: OutreachMockResetTarget;
  }> {
    await this.inboundReplyWindowService.clearInboundWindow(
      workspaceId,
      candidateId,
    );

    await this.staticGraphQLService.executeGraphQL(
      graphqlQueryToRemoveMessages,
      {
        filter: {
          candidateId: { eq: candidateId },
        },
      },
      apiToken,
    );

    await this.staticGraphQLService.executeGraphQL(
      graphQltoUpdateOneCandidate,
      {
        idToUpdate: candidateId,
        input: {
          outreachSequenceStage: to,
          outreachConversationStage: 'NONE',
        },
      },
      apiToken,
    );

    this.logger.log(
      `OUTREACH_MOCK: reset candidate ${candidateId} to ${to}`,
    );

    return {
      ok: true,
      candidateId,
      outreachSequenceStage: to,
    };
  }

  resolveResetTarget(to: string | undefined): OutreachMockResetTarget {
    if (to === 'queued' || to === 'QUEUED') {
      return 'QUEUED';
    }

    if (
      !isDefined(to) ||
      to === 'connection_sent' ||
      to === 'CONNECTION_SENT'
    ) {
      return 'CONNECTION_SENT';
    }

    throw new Error(
      `Invalid reset target "${to}". Use CONNECTION_SENT or QUEUED.`,
    );
  }

  resolveHitlDecision(decision: string | undefined): OutreachMockHitlDecision {
    const normalized = (decision ?? 'approve').trim().toLowerCase();

    if (normalized === 'yes' || normalized === 'approve') {
      return 'approve';
    }

    if (normalized === 'no' || normalized === 'reject') {
      return 'reject';
    }

    if (normalized === 'edit' || normalized === 'change') {
      return 'edit';
    }

    throw new Error(
      `Invalid HITL decision "${decision}". Use approve|reject|edit (or yes|no|change).`,
    );
  }

  // Queue N synthetic LinkedIn profiles onto a project for Stage B/C path testing.
  async uploadMockProfiles({
    workspaceId,
    projectId,
    count,
  }: {
    workspaceId: string;
    projectId: string;
    count?: number;
  }): Promise<{
    ok: true;
    projectId: string;
    count: number;
    queued: number;
    uploadSessionId?: string;
  }> {
    if (!isValidUuid(projectId)) {
      throw new Error('projectId must be a valid UUID');
    }

    const resolvedCount = resolveOutreachMockUploadCount(count);
    const people = buildOutreachMockUploadPeople({
      count: resolvedCount,
      projectId,
    });

    const result = await this.uploadProfilesService.execute({
      workspaceId,
      input: {
        projectId,
        people,
      },
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to upload mock profiles');
    }

    this.logger.log(
      `OUTREACH_MOCK: uploaded ${result.queued} mock profiles to project ${projectId}`,
    );

    return {
      ok: true,
      projectId,
      count: resolvedCount,
      queued: result.queued,
      uploadSessionId: result.uploadSessionId,
    };
  }

  private async resolveCandidateProjectId({
    candidateId,
    apiToken,
  }: {
    candidateId: string;
    apiToken: string;
  }): Promise<string> {
    const result = await this.staticGraphQLService.executeGraphQL<{
      candidates?: {
        edges?: Array<{ node?: { projectsId?: string | null } }>;
      };
    }>(
      `query FindCandidateProject($filter: CandidateFilterInput!) {
        candidates(filter: $filter, first: 1) {
          edges {
            node {
              projectsId
            }
          }
        }
      }`,
      { filter: { id: { eq: candidateId } } },
      apiToken,
    );

    const projectId = result?.candidates?.edges?.[0]?.node?.projectsId;

    if (!isNonEmptyString(projectId)) {
      throw new Error(
        `Candidate ${candidateId} has no projectsId — pass projectId explicitly`,
      );
    }

    return projectId;
  }
}
