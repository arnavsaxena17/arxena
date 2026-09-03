import { Injectable, Logger } from '@nestjs/common';

import { graphQltoUpdateOneCandidate, graphqlQueryToRemoveMessages } from 'twenty-shared';
import { isDefined } from 'twenty-shared/utils';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { OutreachInboundReplyWindowService } from 'src/engine/core-modules/outreach-command/jobs/outreach-inbound-reply-window.job';
import { OutreachCommandMaterializeService } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';

export type OutreachMockResetTarget = 'CONNECTION_SENT' | 'QUEUED';

@Injectable()
export class OutreachMockLifecycleService {
  private readonly logger = new Logger(OutreachMockLifecycleService.name);

  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly materializeService: OutreachCommandMaterializeService,
    private readonly inboundReplyWindowService: OutreachInboundReplyWindowService,
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
}
