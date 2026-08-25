import { Injectable, Logger } from '@nestjs/common';

import { graphQltoUpdateOneCandidate } from 'twenty-shared';
import { isDefined } from 'twenty-shared/utils';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import {
  buildCandidateEventUpdate,
  computeAttentionReason,
  computeCoverageBucket,
  computeDaysBetween,
  computeTimeBucket,
  mapMessagingChannelToGtmChannel,
  normalizeLinkedinUrl,
  resolveCompanyIdFromCandidate,
  rollupGtmFunnelStage,
  type GtmCandidateEventKind,
  type GtmChannel,
  type GtmOutreachTouchKind,
} from 'src/engine/core-modules/gtm-command/utils/gtm-command-materialize.util';

type GraphqlEnvelope = {
  data?: {
    data?: Record<string, unknown>;
  };
};

// Materializes GTM Command dashboard fields from live outreach/chat actions.
// Best-effort: never throws to callers — dashboards degrade to stale rollups.

@Injectable()
export class GtmCommandMaterializeService {
  private readonly logger = new Logger(GtmCommandMaterializeService.name);

  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

  async applyCandidateEvent({
    candidateId,
    event,
    apiToken,
    messagingChannel,
    existingFirstOutboundAt,
    companyId,
    companyCreatedAt,
    classifiedOutreachStage,
  }: {
    candidateId: string;
    event: GtmCandidateEventKind;
    apiToken: string;
    messagingChannel?: string | null;
    existingFirstOutboundAt?: string | null;
    companyId?: string | null;
    companyCreatedAt?: string | null;
    classifiedOutreachStage?: string | null;
  }): Promise<void> {
    try {
      const input = buildCandidateEventUpdate({
        event,
        messagingChannel,
        existingFirstOutboundAt,
        classifiedOutreachStage,
      });

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
          firstContactChannel: mapMessagingChannelToGtmChannel(messagingChannel),
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
    existingFirstOutboundAt,
    companyId,
    companyCreatedAt,
    messagingChannel,
  }: {
    candidateId: string;
    touch: GtmOutreachTouchKind;
    apiToken: string;
    existingFirstOutboundAt?: string | null;
    companyId?: string | null;
    companyCreatedAt?: string | null;
    messagingChannel?: string | null;
  }): Promise<void> {
    const eventByTouch: Record<GtmOutreachTouchKind, GtmCandidateEventKind> = {
      outbound: 'outbound_message',
      inbound: 'inbound_reply',
      meeting_booked: 'meeting_booked',
      meeting_held: 'meeting_held',
    };

    await this.applyCandidateEvent({
      candidateId,
      event: eventByTouch[touch],
      apiToken,
      existingFirstOutboundAt,
      companyId,
      companyCreatedAt,
      messagingChannel,
    });
  }

  async markOpportunityFromGtm({
    opportunityId,
    apiToken,
    gtmRunKey,
    companyId,
  }: {
    opportunityId: string;
    apiToken: string;
    gtmRunKey?: string | null;
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
            sourcedFromGtm: true,
            ...(gtmRunKey ? { gtmRunKey } : {}),
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
    event: GtmCandidateEventKind;
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
    event: GtmCandidateEventKind;
    apiToken: string;
    firstContactChannel?: GtmChannel | null;
  }): Promise<void> {
    try {
      const nowIso = new Date().toISOString();
      const company = await this.fetchCompany(companyId, apiToken);

      if (!company) {
        return;
      }

      const candidates = await this.fetchCompanyCandidates(companyId, apiToken);
      const peopleTargeted = candidates.length;
      const reachedCandidates = candidates.filter((candidate) =>
        isDefined(candidate.firstOutboundAt),
      );
      const peopleReached = reachedCandidates.length;
      const channelsUsed = Array.from(
        new Set(
          candidates
            .map((candidate) =>
              mapMessagingChannelToGtmChannel(candidate.messagingChannel),
            )
            .filter((channel) => channel !== 'OTHER'),
        ),
      );

      const firstContactAt =
        company.firstContactAt ??
        (['outbound_message', 'connection_sent', 'comment_posted'].includes(
          event,
        )
          ? nowIso
          : company.firstContactAt);
      const firstReplyAt =
        company.firstReplyAt ??
        (event === 'inbound_reply' ? nowIso : company.firstReplyAt);
      const meetingBookedAt =
        company.meetingBookedAt ??
        (event === 'meeting_booked' || event === 'meeting_held'
          ? nowIso
          : company.meetingBookedAt);
      const meetingHeldAt =
        company.meetingHeldAt ??
        (event === 'meeting_held' ? nowIso : company.meetingHeldAt);

      const daysToFirstContact =
        company.daysToFirstContact ??
        computeDaysBetween(
          companyCreatedAt ?? company.createdAt,
          firstContactAt,
        );
      const daysToMeetingBooked =
        company.daysToMeetingBooked ??
        computeDaysBetween(
          companyCreatedAt ?? company.createdAt,
          meetingBookedAt,
        );

      const latestTouchMs = candidates.reduce((max, candidate) => {
        const outbound = Date.parse(candidate.lastOutboundAt ?? '');
        const inbound = Date.parse(candidate.lastInboundAt ?? '');
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
          isDefined(candidate.lastInboundAt),
        ),
      });

      const gtmFunnelStage = rollupGtmFunnelStage({
        current: company.gtmFunnelStage,
        event,
        peopleReached,
      });

      await this.staticGraphQLService.executeGraphQL(
        `mutation UpdateCompany($id: ID!, $data: CompanyUpdateInput!) {
          updateCompany(id: $id, data: $data) { id }
        }`,
        {
          id: companyId,
          data: {
            peopleTargeted,
            peopleReached,
            coverageBucket: computeCoverageBucket(peopleReached),
            coverageScore: Math.min(
              100,
              Math.round(
                (peopleReached / Math.max(peopleTargeted || 1, 1)) * 100,
              ),
            ),
            channelsUsed,
            firstContactAt,
            firstReplyAt,
            meetingBookedAt,
            meetingHeldAt,
            daysToFirstContact,
            daysToMeetingBooked,
            timeToFirstContactBucket: computeTimeBucket(daysToFirstContact),
            timeToMeetingBucket: computeTimeBucket(daysToMeetingBooked),
            firstContactChannel:
              company.firstContactChannel ?? firstContactChannel ?? null,
            gtmFunnelStage,
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
    touch: GtmOutreachTouchKind;
    apiToken: string;
  }): Promise<void> {
    const eventByTouch: Record<GtmOutreachTouchKind, GtmCandidateEventKind> = {
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
              firstOutboundAt
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
    peopleReached?: number;
    firstContactAt?: string | null;
    firstReplyAt?: string | null;
    meetingBookedAt?: string | null;
    meetingHeldAt?: string | null;
    daysToFirstContact?: number | null;
    daysToMeetingBooked?: number | null;
    gtmFunnelStage?: string | null;
    attentionReason?: string | null;
    firstContactChannel?: string | null;
  } | null> {
    const response = (await this.staticGraphQLService.executeGraphQL(
      `query Company($filter: CompanyFilterInput) {
        companies(first: 1, filter: $filter) {
          edges {
            node {
              id
              createdAt
              peopleReached
              firstContactAt
              firstReplyAt
              meetingBookedAt
              meetingHeldAt
              daysToFirstContact
              daysToMeetingBooked
              gtmFunnelStage
              attentionReason
              firstContactChannel
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
      peopleReached?: number;
      firstContactAt?: string | null;
      firstReplyAt?: string | null;
      meetingBookedAt?: string | null;
      meetingHeldAt?: string | null;
      daysToFirstContact?: number | null;
      daysToMeetingBooked?: number | null;
      gtmFunnelStage?: string | null;
      attentionReason?: string | null;
      firstContactChannel?: string | null;
    } | null;
  }

  private async fetchCompanyCandidates(
    companyId: string,
    apiToken: string,
  ): Promise<
    Array<{
      id: string;
      firstOutboundAt?: string | null;
      lastOutboundAt?: string | null;
      lastInboundAt?: string | null;
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
              firstOutboundAt
              lastOutboundAt
              lastInboundAt
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
        firstOutboundAt?: string | null;
        lastOutboundAt?: string | null;
        lastInboundAt?: string | null;
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
  existingFirstOutboundAt,
  companyId,
  companyCreatedAt,
  messagingChannel,
}: {
  staticGraphQLService: StaticGraphQLService;
  candidateId: string;
  touch: GtmOutreachTouchKind;
  apiToken: string;
  existingFirstOutboundAt?: string | null;
  companyId?: string | null;
  companyCreatedAt?: string | null;
  messagingChannel?: string | null;
}): Promise<void> => {
  const service = new GtmCommandMaterializeService(staticGraphQLService);

  await service.recordCandidateTouch({
    candidateId,
    touch,
    apiToken,
    existingFirstOutboundAt,
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
  existingFirstOutboundAt,
  companyId,
}: {
  staticGraphQLService: StaticGraphQLService;
  candidateId: string;
  event: GtmCandidateEventKind;
  apiToken: string;
  messagingChannel?: string | null;
  existingFirstOutboundAt?: string | null;
  companyId?: string | null;
}): Promise<void> => {
  const service = new GtmCommandMaterializeService(staticGraphQLService);

  await service.applyCandidateEvent({
    candidateId,
    event,
    apiToken,
    messagingChannel,
    existingFirstOutboundAt,
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
  event: GtmCandidateEventKind;
  apiToken: string;
  messagingChannel?: string | null;
}): Promise<void> => {
  const service = new GtmCommandMaterializeService(staticGraphQLService);

  await service.applyEventByLinkedinUrl({
    linkedinUrl,
    event,
    apiToken,
    messagingChannel,
  });
};
