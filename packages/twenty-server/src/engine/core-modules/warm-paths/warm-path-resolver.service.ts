import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

import { extractTargetProviderId } from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-profile-context.util';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import type { LinkedInNetworkDistanceType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';
import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

import type {
  ResolveWarmPathsParams,
  WarmPathEntry,
  WarmPathNetworkCluster,
  WarmPathNetworkPerson,
  WarmPathRankedBridge,
  WarmPathResolveResponse,
} from './warm-paths.types';
import {
  clusterLabelFromHeadline,
  scoreBridgeRelevance,
  sharedOverlapStrength,
} from './utils/warm-path-rank.util';
import {
  buildLinkedinProfileUrl,
  extractLinkedinIdentifierFromUrl,
  mapProfileRecordToPerson,
  mapSearchResultToPerson,
  normalizeNetworkDistanceLabel,
} from './utils/warm-path-person.util';

@Injectable()
export class WarmPathResolverService {
  private readonly logger = new Logger(WarmPathResolverService.name);

  constructor(
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
  ) {}

  async resolve(params: ResolveWarmPathsParams): Promise<WarmPathResolveResponse> {
    const targetIdentifier = extractLinkedinIdentifierFromUrl(
      params.targetLinkedinUrl,
    );
    if (!targetIdentifier) {
      throw new BadRequestException('Valid target LinkedIn URL is required');
    }

    const accountId = await this.resolveAccountId(params);
    const targetProfile = await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
      accountId,
      targetIdentifier,
      { linkedinSections: ['*'] },
    );

    if (!targetProfile) {
      throw new BadRequestException(
        `Could not load LinkedIn profile for ${targetIdentifier}`,
      );
    }

    const targetProviderId = extractTargetProviderId(
      targetProfile,
      targetIdentifier,
    );
    const targetPerson = mapProfileRecordToPerson(targetProfile, targetIdentifier);
    const targetHeadline = targetPerson.headline;
    const targetCompany = this.readCurrentCompany(targetProfile);

    const ownerProfile =
      await this.linkedinUnipileRequestService.fetchLinkedinOwnerProfile(
        accountId,
      );
    const ownerRecord = (ownerProfile ?? {}) as Record<string, unknown>;
    const hasSalesNavigator = ownerProfile?.sales_navigator != null;

    const viewerName = this.readViewerName(ownerRecord);
    const viewerLinkedinUrl = this.readViewerLinkedinUrl(ownerRecord);

    const directMutualItems = await this.searchConnectionsOf(
      accountId,
      targetProviderId,
      'classic',
      [1],
      params.workspaceId,
      25,
    );
    const directMutuals = directMutualItems.map(mapSearchResultToPerson);

    const bridgeApi: 'classic' | 'sales_navigator' = hasSalesNavigator
      ? 'sales_navigator'
      : 'classic';
    const bridgeNetworkDistance: LinkedInNetworkDistanceType[] = hasSalesNavigator
      ? [2]
      : [2];

    let bridgeItems: LinkedInPeopleSearchResult[] = [];
    try {
      bridgeItems = await this.searchConnectionsOf(
        accountId,
        targetProviderId,
        bridgeApi,
        bridgeNetworkDistance,
        params.workspaceId,
        params.maxBridges ?? 25,
      );
    } catch (error) {
      this.logger.warn(
        `Bridge search via ${bridgeApi} failed, falling back to classic: ${
          error instanceof Error ? error.message : error
        }`,
      );
      if (bridgeApi === 'sales_navigator') {
        bridgeItems = await this.searchConnectionsOf(
          accountId,
          targetProviderId,
          'classic',
          [2],
          params.workspaceId,
          params.maxBridges ?? 25,
        );
      }
    }

    const expandConnectors = params.expandViewerConnectors !== false;
    const bridges = await this.buildRankedBridges(
      bridgeItems,
      targetHeadline,
      targetCompany,
      accountId,
      params.workspaceId,
      expandConnectors,
    );

    const viewerPerson: WarmPathNetworkPerson = {
      publicIdentifier:
        typeof ownerRecord.public_identifier === 'string'
          ? ownerRecord.public_identifier
          : '',
      fullName: viewerName,
      headline:
        typeof ownerRecord.occupation === 'string'
          ? ownerRecord.occupation
          : null,
      linkedinUrl: viewerLinkedinUrl ?? '',
      providerId:
        typeof ownerRecord.provider_id === 'string'
          ? ownerRecord.provider_id
          : '',
      sharedConnectionsWithViewer: null,
      networkDistanceToViewer: 'SELF',
    };

    const paths = this.buildPaths(
      viewerPerson,
      targetPerson,
      directMutuals,
      bridges,
    );

    const clusters = this.buildClusters(bridges);
    const anchorConnections = bridges.slice(0, 5).map((bridge) => ({
      person: bridge,
      whyKnownToTarget: bridge.relevanceToTarget.reasons,
      overlapWithViewer: {
        sharedConnectionCount: bridge.sharedConnectionsWithViewer,
        strength: sharedOverlapStrength(bridge.sharedConnectionsWithViewer),
      },
      optionalIntroChain:
        bridge.viewerFirstDegreeConnectors[0] != null
          ? {
              viewerFirstDegree: bridge.viewerFirstDegreeConnectors[0],
              bridge,
            }
          : undefined,
    }));

    const networkDistance = normalizeNetworkDistanceLabel(
      targetPerson.networkDistanceToViewer,
    );
    const directMutualCount =
      typeof targetProfile.shared_connections_count === 'number'
        ? targetProfile.shared_connections_count
        : directMutuals.length;

    const isDirect =
      networkDistance === '1st degree' || directMutuals.length > 0;

    const bestRouteLabel = this.buildBestRouteLabel(
      paths,
      bridges,
      clusters,
      networkDistance,
    );

    return {
      target: {
        linkedinUrl: buildLinkedinProfileUrl(targetPerson.publicIdentifier),
        publicIdentifier: targetPerson.publicIdentifier,
        providerId: targetProviderId,
        fullName: targetPerson.fullName,
        headline: targetPerson.headline,
        location:
          typeof targetProfile.location === 'string'
            ? targetProfile.location
            : null,
        currentCompanyName: targetCompany,
        schools: this.readSchools(targetProfile),
        connectionsCount:
          typeof targetProfile.connections_count === 'number'
            ? targetProfile.connections_count
            : null,
      },
      viewer: {
        workspaceMemberProfileId: params.workspaceMemberId,
        fullName: viewerName,
        linkedinUrl: viewerLinkedinUrl,
        linkedinUnipileAccountId: accountId,
      },
      honesty: {
        isDirectlyConnected: isDirect,
        networkDistance,
        directMutualCount,
        suggestedDisclosure: isDirect
          ? 'You share direct mutual connections with this person.'
          : 'You are not one introduction away — paths below go through shared contacts.',
      },
      directMutuals,
      bridges,
      paths,
      anchorConnections,
      clusters,
      bestRouteLabel,
      searchApiUsed: bridgeApi,
      resolvedAt: new Date().toISOString(),
    };
  }

  private async resolveAccountId(
    params: ResolveWarmPathsParams,
  ): Promise<string> {
    const explicit = params.linkedinUnipileAccountId?.trim();
    if (explicit) {
      return explicit;
    }

    const accountId =
      await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
        params.workspaceMemberId,
        params.workspaceId,
        params.apiToken,
        'linkedin',
      );

    if (!accountId?.trim()) {
      throw new UnauthorizedException(
        'Connect LinkedIn in settings to use warm paths',
      );
    }

    return accountId.trim();
  }

  private async searchConnectionsOf(
    accountId: string,
    targetProviderId: string,
    api: 'classic' | 'sales_navigator',
    networkDistance: LinkedInNetworkDistanceType[],
    workspaceId: string,
    limit: number,
  ): Promise<LinkedInPeopleSearchResult[]> {
    const response = await this.linkedInSearchService.search(
      {
        api,
        category: 'people',
        connections_of: [targetProviderId],
        network_distance: networkDistance,
      },
      accountId,
      { limit, workspaceId },
    );

    return (response.items ?? []).filter(
      (item): item is LinkedInPeopleSearchResult =>
        item.type === 'PEOPLE',
    );
  }

  private async buildRankedBridges(
    items: LinkedInPeopleSearchResult[],
    targetHeadline: string | null,
    targetCompany: string | null,
    accountId: string,
    workspaceId: string,
    expandViewerConnectors: boolean,
  ): Promise<WarmPathRankedBridge[]> {
    const mapped = items.map((item) => {
      const person = mapSearchResultToPerson(item);
      const relevance = scoreBridgeRelevance(
        person.headline,
        targetHeadline,
        targetCompany,
        person.sharedConnectionsWithViewer,
      );
      return { person, relevance };
    });

    mapped.sort((a, b) => {
      const sharedA = a.person.sharedConnectionsWithViewer ?? 0;
      const sharedB = b.person.sharedConnectionsWithViewer ?? 0;
      if (sharedB !== sharedA) {
        return sharedB - sharedA;
      }
      return b.relevance.score - a.relevance.score;
    });

    const top = mapped.slice(0, 10);
    const bridges: WarmPathRankedBridge[] = [];

    for (const entry of top) {
      let viewerFirstDegreeConnectors: WarmPathNetworkPerson[] = [];
      if (expandViewerConnectors && entry.person.publicIdentifier) {
        viewerFirstDegreeConnectors = await this.fetchViewerConnectorsToBridge(
          accountId,
          entry.person.publicIdentifier,
          workspaceId,
        );
      }

      bridges.push({
        ...entry.person,
        relevanceToTarget: entry.relevance,
        viewerFirstDegreeConnectors,
      });
    }

    return bridges;
  }

  private async fetchViewerConnectorsToBridge(
    accountId: string,
    bridgePublicIdentifier: string,
    workspaceId: string,
  ): Promise<WarmPathNetworkPerson[]> {
    const bridgeProfile =
      await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
        accountId,
        bridgePublicIdentifier,
        { linkedinSections: [] },
      );
    if (!bridgeProfile) {
      return [];
    }

    const bridgeProviderId = extractTargetProviderId(
      bridgeProfile,
      bridgePublicIdentifier,
    );

    try {
      const connectors = await this.searchConnectionsOf(
        accountId,
        bridgeProviderId,
        'classic',
        [1],
        workspaceId,
        5,
      );
      return connectors.map(mapSearchResultToPerson);
    } catch (error) {
      this.logger.warn(
        `Failed to expand connectors for bridge ${bridgePublicIdentifier}: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return [];
    }
  }

  private buildPaths(
    viewer: WarmPathNetworkPerson,
    target: WarmPathNetworkPerson,
    directMutuals: WarmPathNetworkPerson[],
    bridges: WarmPathRankedBridge[],
  ): WarmPathEntry[] {
    const paths: WarmPathEntry[] = [];

    for (const mutual of directMutuals.slice(0, 5)) {
      paths.push({
        hopCount: 2,
        pathType: 'direct_mutual',
        confidence: 'high',
        summary: `You → ${mutual.fullName} → ${target.fullName}`,
        hops: [
          { role: 'viewer', person: viewer },
          { role: 'bridge', person: mutual },
          { role: 'target', person: target },
        ],
      });
    }

    for (const bridge of bridges.slice(0, 5)) {
      const connector = bridge.viewerFirstDegreeConnectors[0];
      if (connector) {
        paths.push({
          hopCount: 3,
          pathType: 'bridge',
          confidence:
            (bridge.sharedConnectionsWithViewer ?? 0) >= 10 ? 'high' : 'medium',
          summary: `You → ${connector.fullName} → ${bridge.fullName} → ${target.fullName}`,
          hops: [
            { role: 'viewer', person: viewer },
            { role: 'connector', person: connector },
            { role: 'bridge', person: bridge },
            { role: 'target', person: target },
          ],
        });
      } else {
        paths.push({
          hopCount: 2,
          pathType: 'bridge',
          confidence:
            (bridge.sharedConnectionsWithViewer ?? 0) >= 10 ? 'high' : 'medium',
          summary: `You → ${bridge.fullName} → ${target.fullName}`,
          hops: [
            { role: 'viewer', person: viewer },
            { role: 'bridge', person: bridge },
            { role: 'target', person: target },
          ],
        });
      }
    }

    return paths;
  }

  private buildClusters(bridges: WarmPathRankedBridge[]): WarmPathNetworkCluster[] {
    const byLabel = new Map<string, WarmPathNetworkPerson[]>();

    for (const bridge of bridges) {
      const label =
        clusterLabelFromHeadline(bridge.headline) ?? 'Professional network';
      const existing = byLabel.get(label) ?? [];
      existing.push(bridge);
      byLabel.set(label, existing);
    }

    return Array.from(byLabel.entries()).map(([label, members]) => ({
      label,
      members,
    }));
  }

  private buildBestRouteLabel(
    paths: WarmPathEntry[],
    bridges: WarmPathRankedBridge[],
    clusters: WarmPathNetworkCluster[],
    networkDistance: string | null,
  ): string | null {
    if (paths[0]?.pathType === 'direct_mutual') {
      return `2 hops via ${paths[0].hops[1]?.person.fullName ?? 'mutual connection'}`;
    }
    if (paths[0]) {
      const hops = paths[0].hopCount;
      const cluster = clusters[0]?.label;
      return cluster
        ? `${hops} hops via ${cluster}`
        : `${hops} hops via ${paths[0].hops[1]?.person.fullName ?? 'shared contact'}`;
    }
    if (bridges.length === 0) {
      return networkDistance
        ? `${networkDistance} — no bridge found in your network`
        : 'No warm path found';
    }
    return null;
  }

  private readCurrentCompany(profile: Record<string, unknown>): string | null {
    const positions = profile.current_positions;
    if (Array.isArray(positions) && positions.length > 0) {
      const first = positions[0];
      if (first && typeof first === 'object' && 'company' in first) {
        const company = (first as { company?: string }).company;
        if (typeof company === 'string' && company.trim()) {
          return company.trim();
        }
      }
    }
    const experience = profile.work_experience;
    if (Array.isArray(experience) && experience.length > 0) {
      const first = experience[0];
      if (first && typeof first === 'object' && 'company' in first) {
        const company = (first as { company?: string }).company;
        if (typeof company === 'string' && company.trim()) {
          return company.trim();
        }
      }
    }
    return null;
  }

  private readSchools(profile: Record<string, unknown>): string[] {
    const education = profile.education;
    if (!Array.isArray(education)) {
      return [];
    }
    return education
      .map((item) => {
        if (item && typeof item === 'object' && 'school' in item) {
          const school = (item as { school?: string }).school;
          return typeof school === 'string' ? school.trim() : '';
        }
        return '';
      })
      .filter((s) => s.length > 0)
      .slice(0, 3);
  }

  private readViewerName(
    ownerProfile: Record<string, unknown> | null,
  ): string {
    if (!ownerProfile) {
      return 'You';
    }
    const first =
      typeof ownerProfile.first_name === 'string'
        ? ownerProfile.first_name
        : '';
    const last =
      typeof ownerProfile.last_name === 'string' ? ownerProfile.last_name : '';
    const combined = `${first} ${last}`.trim();
    return combined || 'You';
  }

  private readViewerLinkedinUrl(
    ownerProfile: Record<string, unknown> | null,
  ): string | null {
    if (!ownerProfile) {
      return null;
    }
    const slug =
      typeof ownerProfile.public_identifier === 'string'
        ? ownerProfile.public_identifier
        : '';
    return slug ? buildLinkedinProfileUrl(slug) : null;
  }
}
