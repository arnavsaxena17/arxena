import { Injectable, Logger } from '@nestjs/common';

import { graphQltoUpdateOneCandidate } from 'twenty-shared';
import {
  buildCandidateAnalyticsUpdate,
  buildCompanyAnalyticsRollup,
  parseOutreachAnalytics,
  resolveOutreachFirstContactAt,
  resolveOutreachFirstOutboundAt,
  resolveOutreachLastInboundAt,
  resolveOutreachLastOutboundAt,
} from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import {
  buildCandidateEventUpdate,
  computeAttentionReason,
  computeCoverageBucket,
  mapCandidateEventToOutreachActionTimestampsEvent,
  mapMessagingChannelToOutreachChannel,
  normalizeLinkedinUrl,
  resolveCompanyIdFromCandidate,
  rollupOutreachFunnelStage,
  type OutreachCandidateEventKind,
  type OutreachChannel,
  type OutreachTouchKind,
} from 'src/engine/core-modules/outreach-command/utils/outreach-command-materialize.util';
import { buildDeferredResumeFields } from 'src/engine/core-modules/outreach-command/services/outreach-deferred-resume.service';

type GraphqlEnvelope = {
  data?: {
    data?: Record<string, unknown>;
  };
};

// Materializes Outreach dashboard fields from live outreach/chat actions.
// Best-effort: never throws to callers — dashboards degrade to stale rollups.

@Injectable()
export class OutreachCommandMaterializeService {
  private readonly logger = new Logger(OutreachCommandMaterializeService.name);

  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

  async applyCandidateEvent({
    candidateId,
    event,
    apiToken,
    messagingChannel,
    companyId,
    companyCreatedAt,
    classifiedOutreachStage,
    extractedTimeHint,
    outboundMessageKind,
    existingConvertedOnMessageKind,
    existingLastOutboundMessageKind,
  }: {
    candidateId: string;
    event: OutreachCandidateEventKind;
    apiToken: string;
    messagingChannel?: string | null;
    companyId?: string | null;
    companyCreatedAt?: string | null;
    classifiedOutreachStage?: string | null;
    extractedTimeHint?: string | null;
    outboundMessageKind?: string | null;
    existingConvertedOnMessageKind?: string | null;
    existingLastOutboundMessageKind?: string | null;
  }): Promise<void> {
    try {
      const actionTimestampsEvent =
        mapCandidateEventToOutreachActionTimestampsEvent(event);
      const candidateSnapshot =
        actionTimestampsEvent !== null
          ? await this.fetchCandidateMaterializeSnapshot(candidateId, apiToken)
          : null;

      const snapshotAnalytics = parseOutreachAnalytics(
        candidateSnapshot?.outreachAnalytics,
      );
      let convertedOn =
        existingConvertedOnMessageKind ?? snapshotAnalytics?.convertedOnMessageKind;
      let lastOutboundKind =
        existingLastOutboundMessageKind ??
        snapshotAnalytics?.lastOutboundMessageKind;

      if (
        (event === 'inbound_reply_flush' || event === 'meeting_booked') &&
        (convertedOn === undefined || lastOutboundKind === undefined)
      ) {
        const messageKinds = await this.fetchCandidateMessageKinds(
          candidateId,
          apiToken,
        );

        convertedOn = convertedOn ?? messageKinds.convertedOnMessageKind;
        lastOutboundKind =
          lastOutboundKind ?? messageKinds.lastOutboundMessageKind;
      }

      const input = buildCandidateEventUpdate({
        event,
        messagingChannel,
        classifiedOutreachStage,
        outboundMessageKind,
      });

      if (event === 'inbound_reply_flush' && classifiedOutreachStage) {
        Object.assign(
          input,
          buildDeferredResumeFields({
            classifiedStage: classifiedOutreachStage,
            extractedTimeHint: extractedTimeHint ?? undefined,
            currentStage: candidateSnapshot?.outreachSequenceStage,
            existingAnalytics: candidateSnapshot?.outreachAnalytics,
          }),
        );
      }

      if (actionTimestampsEvent !== null && candidateSnapshot) {
        Object.assign(
          input,
          buildCandidateAnalyticsUpdate({
            // Prefer deferred-patched analytics so resumeAt / stageBeforeDefer survive
            existingAnalytics:
              (input as { outreachAnalytics?: unknown }).outreachAnalytics ??
              candidateSnapshot.outreachAnalytics,
            event: actionTimestampsEvent,
            enrolledAt: candidateSnapshot.createdAt,
            outboundMessageKind,
            existingConvertedOnMessageKind: convertedOn,
            existingLastOutboundMessageKind: lastOutboundKind,
          }),
        );
      }

      if (Object.keys(input).length > 0) {
        await this.staticGraphQLService.executeGraphQL(
          graphQltoUpdateOneCandidate,
          {
            idToUpdate: candidateId,
            input,
          },
          apiToken,
        );
      }

      const resolvedCompanyId =
        companyId ??
        (await this.fetchCandidateCompanyId(candidateId, apiToken));

      if (resolvedCompanyId && event !== 'inbound_reply') {
        await this.recomputeCompanyRollup({
          companyId: resolvedCompanyId,
          companyCreatedAt,
          event,
          apiToken,
          firstContactChannel: mapMessagingChannelToOutreachChannel(messagingChannel),
        });
      }
    } catch (error) {
      this.logger.warn(
        `GTM materialize candidate event ${event} failed for ${candidateId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async recordCandidateTouch({
    candidateId,
    touch,
    apiToken,
    companyId,
    companyCreatedAt,
    messagingChannel,
  }: {
    candidateId: string;
    touch: OutreachTouchKind;
    apiToken: string;
    companyId?: string | null;
    companyCreatedAt?: string | null;
    messagingChannel?: string | null;
  }): Promise<void> {
    const eventByTouch: Record<OutreachTouchKind, OutreachCandidateEventKind> = {
      outbound: 'outbound_message',
      inbound: 'inbound_reply',
      meeting_booked: 'meeting_booked',
      meeting_held: 'meeting_held',
    };

    await this.applyCandidateEvent({
      candidateId,
      event: eventByTouch[touch],
      apiToken,
      companyId,
      companyCreatedAt,
      messagingChannel,
    });
  }

  async markOpportunityFromOutreach({
    opportunityId,
    apiToken,
    projectIds,
    companyId,
  }: {
    opportunityId: string;
    apiToken: string;
    projectIds?: string | null;
    companyId?: string | null;
  }): Promise<void> {
    try {
      await this.staticGraphQLService.executeGraphQL(
        `mutation UpdateOpportunity($id: ID!, $data: OpportunityUpdateInput!) {
          updateOpportunity(id: $id, data: $data) { id }
        }`,
        {
          id: opportunityId,
          data: {
            sourcedFromOutreach: true,
            ...(projectIds ? { projectId: projectIds } : {}),
          },
        },
        apiToken,
      );

      if (companyId) {
        await this.recomputeCompanyRollup({
          companyId,
          event: 'opportunity_created',
          apiToken,
        });
      }
    } catch (error) {
      this.logger.warn(
        `GTM opportunity attribution failed for ${opportunityId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async findCandidateIdByLinkedinUrl({
    linkedinUrl,
    apiToken,
  }: {
    linkedinUrl: string;
    apiToken: string;
  }): Promise<string | null> {
    const normalized = normalizeLinkedinUrl(linkedinUrl);

    if (!normalized) {
      return null;
    }

    try {
      const slug = normalized.split('/').pop() ?? normalized;
      const response = (await this.staticGraphQLService.executeGraphQL(
        `query Candidates($filter: CandidateFilterInput) {
          candidates(first: 5, filter: $filter) {
            edges {
              node {
                id
                linkedinUrl { primaryLinkUrl }
                people { linkedinLink { primaryLinkUrl } }
              }
            }
          }
        }`,
        {
          filter: {
            or: [
              {
                linkedinUrl: {
                  primaryLinkUrl: { ilike: `%${slug}%` },
                },
              },
            ],
          },
        },
        apiToken,
      )) as GraphqlEnvelope;

      const edges =
        (
          response?.data?.data?.candidates as {
            edges?: Array<{
              node: {
                id: string;
                linkedinUrl?: { primaryLinkUrl?: string };
                people?: { linkedinLink?: { primaryLinkUrl?: string } };
              };
            }>;
          }
        )?.edges ?? [];

      const match = edges.find((edge) => {
        const candidateUrl = normalizeLinkedinUrl(
          edge.node.linkedinUrl?.primaryLinkUrl,
        );
        const personUrl = normalizeLinkedinUrl(
          edge.node.people?.linkedinLink?.primaryLinkUrl,
        );

        return (
          candidateUrl.includes(slug) ||
          personUrl.includes(slug) ||
          normalized.includes(candidateUrl) ||
          normalized.includes(personUrl)
        );
      });

      return match?.node.id ?? edges[0]?.node.id ?? null;
    } catch (error) {
      this.logger.warn(
        `GTM LinkedIn candidate lookup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  async applyEventByLinkedinUrl({
    linkedinUrl,
    event,
    apiToken,
    messagingChannel,
  }: {
    linkedinUrl: string;
    event: OutreachCandidateEventKind;
    apiToken: string;
    messagingChannel?: string | null;
  }): Promise<void> {
    const candidateId = await this.findCandidateIdByLinkedinUrl({
      linkedinUrl,
      apiToken,
    });

    if (!candidateId) {
      return;
    }

    await this.applyCandidateEvent({
      candidateId,
      event,
      apiToken,
      messagingChannel,
    });
  }

  async recomputeCompanyRollup({
    companyId,
    companyCreatedAt,
    event,
    apiToken,
    firstContactChannel,
  }: {
    companyId: string;
    companyCreatedAt?: string | null;
    event: OutreachCandidateEventKind;
    apiToken: string;
    firstContactChannel?: OutreachChannel | null;
  }): Promise<void> {
    try {
      const nowIso = new Date().toISOString();
      const company = await this.fetchCompany(companyId, apiToken);

      if (!company) {
        return;
      }

      const existingAnalytics = parseOutreachAnalytics(company.outreachAnalytics);
      const candidates = await this.fetchCompanyCandidates(companyId, apiToken);
      const peopleTargeted = candidates.length;
      const reachedCandidates = candidates.filter((candidate) =>
        isDefined(
          resolveOutreachFirstOutboundAt(candidate.outreachAnalytics),
        ),
      );
      const peopleReached = reachedCandidates.length;
      const earliestCandidateFirstContactMs = candidates.reduce(
        (earliest, candidate) => {
          const contactAt = resolveOutreachFirstContactAt(
            candidate.outreachAnalytics,
          );
          const contactMs = Date.parse(contactAt ?? '');

          if (!Number.isFinite(contactMs)) {
            return earliest;
          }

          return earliest === 0 ? contactMs : Math.min(earliest, contactMs);
        },
        0,
      );
      const aggregatedFirstContactAt =
        earliestCandidateFirstContactMs > 0
          ? new Date(earliestCandidateFirstContactMs).toISOString()
          : null;
      const channelsUsed = Array.from(
        new Set(
          candidates
            .map((candidate) =>
              mapMessagingChannelToOutreachChannel(candidate.messagingChannel),
            )
            .filter((channel) => channel !== 'OTHER'),
        ),
      );

      const firstContactAt =
        existingAnalytics?.firstContactAt ??
        (event === 'connection_accepted'
          ? nowIso
          : ['outbound_message', 'comment_posted'].includes(event)
            ? nowIso
            : aggregatedFirstContactAt);
      const firstReplyAt =
        existingAnalytics?.firstReplyAt ??
        (event === 'inbound_reply' ? nowIso : null);
      const meetingBookedAt =
        existingAnalytics?.meetingBookedAt ??
        (event === 'meeting_booked' || event === 'meeting_held'
          ? nowIso
          : null);
      const meetingHeldAt =
        existingAnalytics?.meetingHeldAt ??
        (event === 'meeting_held' ? nowIso : null);

      const latestTouchMs = candidates.reduce((max, candidate) => {
        const outbound = Date.parse(
          resolveOutreachLastOutboundAt(candidate.outreachAnalytics) ?? '',
        );
        const inbound = Date.parse(
          resolveOutreachLastInboundAt(candidate.outreachAnalytics) ?? '',
        );
        const touch = Math.max(
          Number.isFinite(outbound) ? outbound : 0,
          Number.isFinite(inbound) ? inbound : 0,
        );

        return Math.max(max, touch);
      }, 0);
      const daysSinceLastTouch =
        latestTouchMs > 0
          ? Math.round((Date.now() - latestTouchMs) / (24 * 60 * 60 * 1000))
          : 0;

      const worstCandidate = candidates[0];
      const attentionReason = computeAttentionReason({
        enrichStatus: worstCandidate?.enrichStatus,
        outreachSequenceStage: worstCandidate?.outreachSequenceStage,
        daysSinceLastTouch,
        hasReply: candidates.some((candidate) =>
          isDefined(resolveOutreachLastInboundAt(candidate.outreachAnalytics)),
        ),
      });

      const outreachFunnelStage = rollupOutreachFunnelStage({
        current: company.outreachFunnelStage,
        event,
        peopleReached,
      });

      const coverageBucket = computeCoverageBucket(peopleReached);
      const coverageScore = Math.min(
        100,
        Math.round((peopleReached / Math.max(peopleTargeted || 1, 1)) * 100),
      );
      const resolvedFirstContactChannel =
        existingAnalytics?.firstContactChannel ??
        (event === 'connection_accepted'
          ? 'LINKEDIN_CONNECT'
          : firstContactChannel ?? null);

      const analyticsUpdate = buildCompanyAnalyticsRollup({
        existingAnalytics: company.outreachAnalytics,
        companyCreatedAt: companyCreatedAt ?? company.createdAt,
        peopleTargeted,
        peopleReached,
        coverageScore,
        coverageBucket,
        channelsUsed,
        firstContactAt,
        firstReplyAt,
        meetingBookedAt,
        meetingHeldAt,
        firstContactChannel: resolvedFirstContactChannel,
      });

      await this.staticGraphQLService.executeGraphQL(
        `mutation UpdateCompany($id: ID!, $data: CompanyUpdateInput!) {
          updateCompany(id: $id, data: $data) { id }
        }`,
        {
          id: companyId,
          data: {
            ...analyticsUpdate,
            outreachFunnelStage,
            attentionReason:
              event === 'inbound_reply' || event === 'meeting_booked'
                ? 'NONE'
                : attentionReason,
          },
        },
        apiToken,
      );
    } catch (error) {
      this.logger.warn(
        `GTM materialize company rollup failed for ${companyId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // Kept for older call sites
  async recomputeCompanyRollupFromTouch({
    companyId,
    companyCreatedAt,
    touch,
    apiToken,
  }: {
    companyId: string;
    companyCreatedAt?: string | null;
    touch: OutreachTouchKind;
    apiToken: string;
  }): Promise<void> {
    const eventByTouch: Record<OutreachTouchKind, OutreachCandidateEventKind> = {
      outbound: 'outbound_message',
      inbound: 'inbound_reply',
      meeting_booked: 'meeting_booked',
      meeting_held: 'meeting_held',
    };

    await this.recomputeCompanyRollup({
      companyId,
      companyCreatedAt,
      event: eventByTouch[touch],
      apiToken,
    });
  }

  private async fetchCandidateMaterializeSnapshot(
    candidateId: string,
    apiToken: string,
  ): Promise<{
    createdAt?: string;
    outreachAnalytics?: unknown;
  } | null> {
    try {
      const response = (await this.staticGraphQLService.executeGraphQL(
        `query CandidateAnalyticsSnapshot($filter: CandidateFilterInput) {
          candidates(first: 1, filter: $filter) {
            edges {
              node {
                id
                createdAt
                outreachAnalytics
              }
            }
          }
        }`,
        { filter: { id: { eq: candidateId } } },
        apiToken,
      )) as GraphqlEnvelope;

      return (
        (
          response?.data?.data?.candidates as {
            edges?: Array<{
              node: {
                createdAt?: string;
                outreachAnalytics?: unknown;
              };
            }>;
          }
        )?.edges?.[0]?.node ?? null
      );
    } catch {
      return null;
    }
  }

  private async fetchCandidateMessageKinds(
    candidateId: string,
    apiToken: string,
  ): Promise<{
    lastOutboundMessageKind: string | null;
    convertedOnMessageKind: string | null;
  }> {
    try {
      const response = (await this.staticGraphQLService.executeGraphQL(
        `query CandidateMessageKinds($filter: CandidateFilterInput) {
          candidates(first: 1, filter: $filter) {
            edges {
              node {
                id
                outreachAnalytics
              }
            }
          }
        }`,
        { filter: { id: { eq: candidateId } } },
        apiToken,
      )) as GraphqlEnvelope;

      const analytics = parseOutreachAnalytics(
        (
          response?.data?.data?.candidates as {
            edges?: Array<{ node: { outreachAnalytics?: unknown } }>;
          }
        )?.edges?.[0]?.node?.outreachAnalytics,
      );

      return {
        lastOutboundMessageKind: analytics?.lastOutboundMessageKind ?? null,
        convertedOnMessageKind: analytics?.convertedOnMessageKind ?? null,
      };
    } catch {
      return {
        lastOutboundMessageKind: null,
        convertedOnMessageKind: null,
      };
    }
  }

  private async fetchCandidateCompanyId(
    candidateId: string,
    apiToken: string,
  ): Promise<string | null> {
    const response = (await this.staticGraphQLService.executeGraphQL(
      `query Candidate($filter: CandidateFilterInput) {
        candidates(first: 1, filter: $filter) {
          edges {
            node {
              id
              messagingChannel
              projects { companyId company { id } }
              people { companyId company { id } }
            }
          }
        }
      }`,
      { filter: { id: { eq: candidateId } } },
      apiToken,
    )) as GraphqlEnvelope;

    const node = (
      response?.data?.data?.candidates as {
        edges?: Array<{ node: Parameters<typeof resolveCompanyIdFromCandidate>[0] }>;
      }
    )?.edges?.[0]?.node;

    return node ? resolveCompanyIdFromCandidate(node) : null;
  }

  private async fetchCompany(
    companyId: string,
    apiToken: string,
  ): Promise<{
    id: string;
    createdAt?: string;
    outreachAnalytics?: unknown;
    outreachFunnelStage?: string | null;
    attentionReason?: string | null;
  } | null> {
    const response = (await this.staticGraphQLService.executeGraphQL(
      `query Company($filter: CompanyFilterInput) {
        companies(first: 1, filter: $filter) {
          edges {
            node {
              id
              createdAt
              outreachAnalytics
              outreachFunnelStage
              attentionReason
            }
          }
        }
      }`,
      { filter: { id: { eq: companyId } } },
      apiToken,
    )) as GraphqlEnvelope;

    return (
      (
        response?.data?.data?.companies as {
          edges?: Array<{ node: unknown }>;
        }
      )?.edges?.[0]?.node ?? null
    ) as {
      id: string;
      createdAt?: string;
      outreachAnalytics?: unknown;
      outreachFunnelStage?: string | null;
      attentionReason?: string | null;
    } | null;
  }

  private async fetchCompanyCandidates(
    companyId: string,
    apiToken: string,
  ): Promise<
    Array<{
      id: string;
      outreachAnalytics?: unknown;
      messagingChannel?: string | null;
      enrichStatus?: string | null;
      outreachSequenceStage?: string | null;
    }>
  > {
    const response = (await this.staticGraphQLService.executeGraphQL(
      `query Candidates($filter: CandidateFilterInput) {
        candidates(first: 200, filter: $filter) {
          edges {
            node {
              id
              outreachAnalytics
              messagingChannel
              enrichStatus
              outreachSequenceStage
            }
          }
        }
      }`,
      {
        filter: {
          or: [
            { projects: { companyId: { eq: companyId } } },
            { people: { companyId: { eq: companyId } } },
          ],
        },
      },
      apiToken,
    )) as GraphqlEnvelope;

    return (
      (
        response?.data?.data?.candidates as {
          edges?: Array<{ node: unknown }>;
        }
      )?.edges?.map((edge) => edge.node as {
        id: string;
        outreachAnalytics?: unknown;
        messagingChannel?: string | null;
        enrichStatus?: string | null;
        outreachSequenceStage?: string | null;
      }) ?? []
    );
  }
}

export const materializeCandidateTouchWithGraphQL = async ({
  staticGraphQLService,
  candidateId,
  touch,
  apiToken,
  companyId,
  companyCreatedAt,
  messagingChannel,
}: {
  staticGraphQLService: StaticGraphQLService;
  candidateId: string;
  touch: OutreachTouchKind;
  apiToken: string;
  companyId?: string | null;
  companyCreatedAt?: string | null;
  messagingChannel?: string | null;
}): Promise<void> => {
  const service = new OutreachCommandMaterializeService(staticGraphQLService);

  await service.recordCandidateTouch({
    candidateId,
    touch,
    apiToken,
    companyId,
    companyCreatedAt,
    messagingChannel,
  });
};

export const materializeCandidateEventWithGraphQL = async ({
  staticGraphQLService,
  candidateId,
  event,
  apiToken,
  messagingChannel,
  companyId,
}: {
  staticGraphQLService: StaticGraphQLService;
  candidateId: string;
  event: OutreachCandidateEventKind;
  apiToken: string;
  messagingChannel?: string | null;
  companyId?: string | null;
}): Promise<void> => {
  const service = new OutreachCommandMaterializeService(staticGraphQLService);

  await service.applyCandidateEvent({
    candidateId,
    event,
    apiToken,
    messagingChannel,
    companyId,
  });
};

export const materializeEventByLinkedinUrlWithGraphQL = async ({
  staticGraphQLService,
  linkedinUrl,
  event,
  apiToken,
  messagingChannel,
}: {
  staticGraphQLService: StaticGraphQLService;
  linkedinUrl: string;
  event: OutreachCandidateEventKind;
  apiToken: string;
  messagingChannel?: string | null;
}): Promise<void> => {
  const service = new OutreachCommandMaterializeService(staticGraphQLService);

  await service.applyEventByLinkedinUrl({
    linkedinUrl,
    event,
    apiToken,
    messagingChannel,
  });
};
