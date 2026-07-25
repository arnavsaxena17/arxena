import { Injectable, Logger } from '@nestjs/common';

import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import type {
  TheOrgCompanyResponse,
  TheOrgFetchCompanyOptions,
  TheOrgFetchMode,
  TheOrgFetchPersonOptions,
  TheOrgImage,
  TheOrgNormalizedNode,
  TheOrgOffice,
  TheOrgOfficeMember,
  TheOrgPerson,
  TheOrgStorageLocation,
  TheOrgStorageTarget,
  TheOrgTeam,
  TheOrgTeamMember,
} from 'src/engine/core-modules/theorg/types/theorg.types';
import {
  generateTheOrgSlugCandidates,
  hasStaticTheOrgSlugOverride,
  normalizeTheOrgSlugInput,
  parseLinkedInCompanySlugFromUrl,
  type TheOrgSlugOverrides,
} from 'src/engine/core-modules/theorg/utils/theorg-slug-candidates.util';
import {
  buildGoogleTheOrgSiteSearchUrl,
  extractTheOrgCompanySlugFromSerpOrganic,
} from 'src/engine/core-modules/theorg/utils/theorg-slug-from-serp.util';

const BASE_URL = 'https://theorg.com';
const GRAPHQL_URL = 'https://prod-graphql-api.theorg.com/graphql';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36';

@Injectable()
export class TheOrgService {
  private readonly logger = new Logger(TheOrgService.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly brightDataSerpService: BrightDataSerpService,
  ) {}

  private get userAgent(): string {
    return process.env.THEORG_USER_AGENT || DEFAULT_USER_AGENT;
  }

  private get requestTimeoutMs(): number {
    return Number(process.env.THEORG_REQUEST_TIMEOUT_MS ?? 45_000);
  }

  private get treeConcurrency(): number {
    return Number(process.env.THEORG_TREE_CONCURRENCY ?? 8);
  }

  private get profileConcurrency(): number {
    return Number(process.env.THEORG_PROFILE_CONCURRENCY ?? 6);
  }

  private get inlineProfileMaxPeople(): number {
    return Number(process.env.THEORG_INLINE_PROFILE_MAX_PEOPLE ?? 75);
  }

  private get teamConcurrency(): number {
    return Number(process.env.THEORG_TEAM_CONCURRENCY ?? 4);
  }

  private get officeConcurrency(): number {
    return Number(process.env.THEORG_OFFICE_CONCURRENCY ?? 4);
  }

  private get officePageSize(): number {
    return Number(process.env.THEORG_OFFICE_PAGE_SIZE ?? 50);
  }

  private get maxFullTreePositionCount(): number {
    return Number(process.env.THEORG_MAX_FULL_TREE_POSITION_COUNT ?? 5_000);
  }

  private get storagePrefix(): string {
    return String(process.env.THEORG_STORAGE_PREFIX ?? 'theorg').replace(
      /(^\/+|\/+$)/g,
      '',
    );
  }

  private get shouldPersist(): boolean {
    return process.env.THEORG_PERSIST_RESULTS !== 'false';
  }

  private async fetchText(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': this.userAgent,
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'cache-control': 'no-cache',
          pragma: 'no-cache',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private async postJson<T>(url: string, payload: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'user-agent': this.userAgent,
          'content-type': 'application/json',
          'X-Org-Client': 'web',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildImageUrl(
    image: TheOrgImage | null | undefined,
    preferredVersion = 'medium',
  ): string | null {
    if (!image?.endpoint || !image.uri) {
      return null;
    }

    const versions = Array.isArray(image.versions) ? image.versions : [];
    const version = versions.includes(preferredVersion)
      ? preferredVersion
      : (versions.includes('medium') ? 'medium' : versions[0]);

    return version
      ? `${image.endpoint}/${image.uri}_${version}.${image.ext || 'jpg'}`
      : `${image.endpoint}/${image.uri}.${image.ext || 'jpg'}`;
  }

  private buildPersonProfileUrl(companySlug: string, personSlug: string): string {
    return `${BASE_URL}/org/${companySlug}/org-chart/${personSlug}`;
  }

  private buildTeamUrl(companySlug: string, teamSlug: string): string {
    return `${BASE_URL}/org/${companySlug}/teams/${teamSlug}`;
  }

  private buildOfficeUrl(companySlug: string, officeSlug: string): string {
    return `${BASE_URL}/org/${companySlug}/offices/${officeSlug}`;
  }

  private sanitizeSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
  }

  private buildStorageLocation(
    kind: 'companies' | 'people',
    slugSegments: string[],
    target?: TheOrgStorageTarget,
  ): TheOrgStorageLocation {
    const safeSegments = slugSegments
      .map((segment) => this.sanitizeSegment(segment))
      .filter(Boolean);
    const extraSegments = (target?.folderSegments || []).map((segment) =>
      this.sanitizeSegment(segment),
    );
    const folderPath = [
      this.storagePrefix,
      kind,
      ...safeSegments,
      ...extraSegments,
    ].join('/');
    const filename =
      target?.filename && target.filename.endsWith('.json')
        ? target.filename
        : `${target?.filename || 'latest'}.json`;

    return {
      folderPath,
      filename,
      path: `${folderPath}/${filename}`,
    };
  }

  private async persistJson(
    location: TheOrgStorageLocation,
    payload: Record<string, unknown>,
  ): Promise<TheOrgStorageLocation> {
    await this.fileStorageService.write({
      file: JSON.stringify(payload, null, 2),
      name: location.filename,
      folder: location.folderPath,
      mimeType: 'application/json',
    });

    this.logger.log(`Persisted TheOrg payload to ${location.path}`);

    return location;
  }

  private extractNextData(html: string, sourceLabel: string): any {
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
    );

    if (!match) {
      throw new Error(`Could not find __NEXT_DATA__ in ${sourceLabel}`);
    }

    return JSON.parse(match[1]);
  }

  private uniquePeopleFromApollo(apolloState: Record<string, any>): Array<Record<string, unknown>> {
    const people: Array<Record<string, unknown>> = [];
    const seenIds = new Set<string | number>();

    for (const [key, value] of Object.entries(apolloState || {})) {
      if (!key.startsWith('FlatPosition:') || !value || typeof value !== 'object') {
        continue;
      }

      const id = value.id ?? key;
      const fullName = String(value.fullName || '').trim();

      if (!fullName || seenIds.has(id)) {
        continue;
      }

      seenIds.add(id);
      people.push({
        id,
        name: fullName,
        role: value.role || null,
        slug: value.slug || null,
      });
    }

    return people.sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || '')),
    );
  }

  private normalizeNode(graphNode: any): TheOrgNormalizedNode {
    const position = graphNode?.node?.position || null;
    const job = graphNode?.node?.job || null;

    return {
      id: graphNode.id,
      title: graphNode.title || null,
      containingNodeId: graphNode.containingNodeId || null,
      order: graphNode.order ?? null,
      parentId: graphNode.parentId || null,
      section: graphNode.section || null,
      type: graphNode.type || null,
      reportCount: graphNode.reportCount ?? 0,
      nodeType: position ? 'Position' : job ? 'Vacant' : null,
      position: position
        ? {
            id: position.id,
            fullName: position.fullName || null,
            role: position.role || null,
            slug: position.slug || null,
            claimedBy: position.claimedBy ?? null,
            hasNotes: Boolean(position.hasNotes),
            profileImage: position.profileImage || null,
            social: position.social || null,
          }
        : null,
      job: job
        ? {
            id: job.id,
            slug: job.slug || null,
            title: job.title || null,
          }
        : null,
    };
  }

  private uniqueNodes(nodes: TheOrgNormalizedNode[]): TheOrgNormalizedNode[] {
    const byId = new Map<string, TheOrgNormalizedNode>();
    for (const node of nodes) {
      if (!node?.id) {
        continue;
      }
      byId.set(node.id, node);
    }
    return [...byId.values()];
  }

  private dedupePeople(people: TheOrgPerson[]): TheOrgPerson[] {
    const byId = new Map<number, TheOrgPerson>();
    for (const person of people) {
      if (!person?.id || !person?.name) {
        continue;
      }
      const existing = byId.get(person.id);
      if (!existing) {
        byId.set(person.id, person);
        continue;
      }

      const existingSources = new Set(
        existing.sources || (existing.source ? [existing.source] : []),
      );
      const incomingSources = new Set(
        person.sources || (person.source ? [person.source] : []),
      );
      const hasOrgChart =
        existingSources.has('orgChart') || incomingSources.has('orgChart');
      const primary = hasOrgChart
        ? (existingSources.has('orgChart') ? existing : person)
        : existing;
      const secondary = primary === existing ? person : existing;

      byId.set(person.id, {
        ...secondary,
        ...primary,
        source: primary.source || secondary.source,
        sources: Array.from(
          new Set([...(secondary.sources || []), ...(primary.sources || [])]),
        ).sort() as TheOrgFetchMode[],
        linkedInUrl: primary.linkedInUrl || secondary.linkedInUrl || null,
        profileUrl: primary.profileUrl || secondary.profileUrl || null,
        profileImageUrl:
          primary.profileImageUrl || secondary.profileImageUrl || null,
        teamIds: Array.from(
          new Set([...(existing.teamIds || []), ...(person.teamIds || [])]),
        ),
        teamSlugs: Array.from(
          new Set([...(existing.teamSlugs || []), ...(person.teamSlugs || [])]),
        ),
        teamNames: Array.from(
          new Set([...(existing.teamNames || []), ...(person.teamNames || [])]),
        ),
        officeIds: Array.from(
          new Set([...(existing.officeIds || []), ...(person.officeIds || [])]),
        ),
        officeSlugs: Array.from(
          new Set([...(existing.officeSlugs || []), ...(person.officeSlugs || [])]),
        ),
        officeNames: Array.from(
          new Set([...(existing.officeNames || []), ...(person.officeNames || [])]),
        ),
      });
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private shouldSkipFullTree(companyStats: Record<string, unknown> | null | undefined): boolean {
    const positionCount = Number(companyStats?.positionCount);
    if (!Number.isFinite(positionCount)) {
      return false;
    }

    return positionCount > this.maxFullTreePositionCount;
  }

  private normalizeTeamMember(member: any): TheOrgTeamMember | null {
    if (!member?.id || !member?.fullName) {
      return null;
    }

    return {
      id: member.id,
      name: member.fullName,
      role: member.role || null,
      slug: member.slug || null,
      parentPositionId: member.parentPositionId ?? null,
      profileImageUrl: this.buildImageUrl(
        member.profileImage || member.profilePicture,
      ),
      updatedAt: member.lastUpdate || null,
    };
  }

  private parseTeamPage(html: string, sourceLabel: string): Omit<TheOrgTeam, 'url'> {
    const nextData = this.extractNextData(html, sourceLabel);
    const pageProps = nextData?.props?.pageProps || {};
    const initialTeam = pageProps.initialTeam || null;

    if (!initialTeam) {
      throw new Error(`Could not find initialTeam in ${sourceLabel}`);
    }

    return {
      id: initialTeam.id || null,
      slug: initialTeam.slug || null,
      name: initialTeam.name || null,
      description: initialTeam.description || null,
      content: initialTeam.content || null,
      memberCount: initialTeam.memberCount ?? 0,
      publishedJobsCount: Array.isArray(initialTeam.publishedJobs)
        ? initialTeam.publishedJobs.length
        : 0,
      members: Array.isArray(initialTeam.members)
        ? initialTeam.members
            .map((member: any) => this.normalizeTeamMember(member))
            .filter(Boolean)
        : [],
    };
  }

  private async fetchTeamDetailsBySlugs(
    companySlug: string,
    teamSlug: string,
  ): Promise<TheOrgTeam> {
    const url = this.buildTeamUrl(companySlug, teamSlug);
    const html = await this.fetchText(url);

    return {
      ...this.parseTeamPage(html, url),
      url,
    };
  }

  private async enrichTeamsWithMembers(
    companySlug: string,
    initialTeams: any[],
  ): Promise<TheOrgTeam[]> {
    const teams = Array.isArray(initialTeams)
      ? initialTeams
          .filter((team) => team?.slug)
          .map((team) => ({
            id: team.id || null,
            slug: team.slug || null,
            name: team.name || null,
            description: team.description || null,
            memberCount: team.memberCount ?? 0,
            url: this.buildTeamUrl(companySlug, team.slug),
            membersPreview: Array.isArray(team.members)
              ? team.members
                  .map((member: any) => this.normalizeTeamMember(member))
                  .filter(Boolean)
              : [],
          }))
      : [];
    const enriched = new Array<TheOrgTeam>(teams.length);
    let cursor = 0;

    const worker = async () => {
      while (cursor < teams.length) {
        const currentIndex = cursor++;
        const team = teams[currentIndex];

        try {
          enriched[currentIndex] = await this.fetchTeamDetailsBySlugs(
            companySlug,
            team.slug,
          );
        } catch (error) {
          enriched[currentIndex] = {
            id: team.id,
            slug: team.slug,
            name: team.name,
            description: team.description,
            memberCount: team.memberCount,
            url: team.url,
            members: team.membersPreview,
            membersPreviewCount: team.membersPreview.length,
            fetchError:
              error instanceof Error ? error.message : 'Failed to fetch team page',
          };
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(this.teamConcurrency, Math.max(1, teams.length)) },
        () => worker(),
      ),
    );

    return enriched
      .filter(Boolean)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  private peopleFromTeams(teams: TheOrgTeam[], companySlug: string): TheOrgPerson[] {
    const flattened = teams.flatMap((team) =>
      (team.members || []).map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role || null,
        slug: member.slug || null,
        nodeId: `team:${team.slug || team.id || 'unknown'}:${member.id}`,
        parentNodeId: null,
        section: 'team',
        reportCount: 0,
        profileUrl:
          member.slug && companySlug
            ? this.buildPersonProfileUrl(companySlug, member.slug)
            : null,
        linkedInUrl: null,
        source: 'team' as const,
        sources: ['teams'] as TheOrgFetchMode[],
        teamIds: team.id ? [team.id] : [],
        teamSlugs: team.slug ? [team.slug] : [],
        teamNames: team.name ? [team.name] : [],
        profileImageUrl: member.profileImageUrl || null,
      })),
    );

    return this.dedupePeople(flattened).map((person) => ({
      ...person,
      teamIds: Array.from(new Set(person.teamIds || [])),
      teamSlugs: Array.from(new Set(person.teamSlugs || [])),
      teamNames: Array.from(new Set(person.teamNames || [])),
    }));
  }

  private normalizeOfficeMember(member: any): TheOrgOfficeMember | null {
    if (!member?.id || !member?.fullName) {
      return null;
    }

    return {
      id: member.id,
      name: member.fullName,
      role: member.role || null,
      slug: member.slug || null,
      parentPositionId: member.parentPositionId ?? null,
      profileImageUrl: this.buildImageUrl(
        member.profileImage || member.profilePicture,
      ),
      updatedAt: member.lastUpdate || null,
    };
  }

  private async fetchOfficePositionsPage(
    companySlug: string,
    officeSlug: string,
    positionsLimit: number,
    positionsOffset: number,
  ): Promise<{
    id: string | null;
    positionCount: number | null;
    positions: TheOrgOfficeMember[];
  }> {
    const payload = {
      operationName: 'officePositionsPage',
      variables: {
        slug: officeSlug,
        companySlug,
        positionsLimit,
        positionsOffset,
      },
      query:
        'query officePositionsPage($slug: String!, $companySlug: String!, $positionsLimit: Int!, $positionsOffset: Int!) { companyOffice(slug: $slug, companySlug: $companySlug) { id positionCount positions(positionsLimit: $positionsLimit, positionsOffset: $positionsOffset) { id fullName role slug parentPositionId lastUpdate profileImage { endpoint ext uri versions } } } }',
    };

    const response = await this.postJson<any>(GRAPHQL_URL, payload);
    if (response.errors?.length) {
      throw new Error(
        `GraphQL office positions failed for ${companySlug}/offices/${officeSlug} offset=${positionsOffset}: ${response.errors
          .map((error: any) => error.message)
          .join('; ')}`,
      );
    }

    const office = response.data?.companyOffice;
    if (!office) {
      throw new Error(
        `GraphQL office positions returned no companyOffice for ${companySlug}/offices/${officeSlug}`,
      );
    }

    return {
      id: office.id || null,
      positionCount:
        typeof office.positionCount === 'number' ? office.positionCount : null,
      positions: Array.isArray(office.positions)
        ? office.positions
            .map((member: any) => this.normalizeOfficeMember(member))
            .filter(Boolean)
        : [],
    };
  }

  private async fetchAllOfficeMembers(
    companySlug: string,
    officeSlug: string,
  ): Promise<{
    id: string | null;
    positionCount: number;
    members: TheOrgOfficeMember[];
  }> {
    const pageSize = Math.max(1, this.officePageSize);
    const membersById = new Map<number, TheOrgOfficeMember>();
    let positionsOffset = 0;
    let positionCount: number | null = null;
    let officeId: string | null = null;

    while (true) {
      const page = await this.fetchOfficePositionsPage(
        companySlug,
        officeSlug,
        pageSize,
        positionsOffset,
      );

      officeId = page.id || officeId;
      if (typeof page.positionCount === 'number') {
        positionCount = page.positionCount;
      }

      for (const member of page.positions) {
        membersById.set(member.id, member);
      }

      if (page.positions.length === 0) {
        break;
      }

      positionsOffset += page.positions.length;

      if (
        typeof positionCount === 'number' &&
        membersById.size >= positionCount
      ) {
        break;
      }

      if (page.positions.length < pageSize) {
        break;
      }
    }

    return {
      id: officeId,
      positionCount: positionCount ?? membersById.size,
      members: [...membersById.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    };
  }

  private parseOfficePage(
    html: string,
    sourceLabel: string,
  ): Omit<TheOrgOffice, 'url'> {
    const nextData = this.extractNextData(html, sourceLabel);
    const pageProps = nextData?.props?.pageProps || {};
    const initialOffice = pageProps.initialCompanyOffice || null;

    if (!initialOffice) {
      throw new Error(`Could not find initialCompanyOffice in ${sourceLabel}`);
    }

    return {
      id: initialOffice.id || null,
      slug: initialOffice.slug || null,
      name: initialOffice.name || null,
      description: initialOffice.description || null,
      positionCount: initialOffice.positionCount ?? 0,
      jobPostCount: Array.isArray(initialOffice.publishedJobs)
        ? initialOffice.publishedJobs.length
        : (initialOffice.jobPostCount ?? 0),
      members: Array.isArray(initialOffice.positions)
        ? initialOffice.positions
            .map((member: any) => this.normalizeOfficeMember(member))
            .filter(Boolean)
        : [],
      location: initialOffice.location || null,
    };
  }

  private async enrichOfficesWithMembers(
    companySlug: string,
    initialOffices: any[],
  ): Promise<TheOrgOffice[]> {
    const offices = Array.isArray(initialOffices)
      ? initialOffices
          .filter((office) => office?.slug)
          .map((office) => ({
            id: office.id || null,
            slug: office.slug || null,
            name: office.name || null,
            description: office.description || null,
            positionCount: office.positionCount ?? 0,
            jobPostCount: office.jobPostCount ?? 0,
            location: office.location || null,
            url: this.buildOfficeUrl(companySlug, office.slug),
            membersPreview: Array.isArray(office.positions)
              ? office.positions
                  .map((member: any) => this.normalizeOfficeMember(member))
                  .filter(Boolean)
              : [],
          }))
      : [];
    const enriched = new Array<TheOrgOffice>(offices.length);
    let cursor = 0;

    const worker = async () => {
      while (cursor < offices.length) {
        const currentIndex = cursor++;
        const office = offices[currentIndex];

        try {
          const fetched = await this.fetchAllOfficeMembers(
            companySlug,
            office.slug,
          );

          enriched[currentIndex] = {
            id: fetched.id || office.id,
            slug: office.slug,
            name: office.name,
            description: office.description,
            positionCount: fetched.positionCount || office.positionCount,
            jobPostCount: office.jobPostCount,
            members: fetched.members,
            membersPreviewCount: office.membersPreview.length,
            location: office.location,
            url: office.url,
          };
        } catch (error) {
          this.logger.warn(
            `GraphQL office fetch failed for ${office.url}; falling back to HTML: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );

          try {
            const html = await this.fetchText(office.url);
            const parsed = this.parseOfficePage(html, office.url);

            enriched[currentIndex] = {
              ...parsed,
              slug: parsed.slug || office.slug,
              name: parsed.name || office.name,
              description: parsed.description || office.description,
              jobPostCount: parsed.jobPostCount ?? office.jobPostCount,
              location: parsed.location || office.location,
              membersPreviewCount: office.membersPreview.length,
              url: office.url,
            };
          } catch (htmlError) {
            enriched[currentIndex] = {
              id: office.id,
              slug: office.slug,
              name: office.name,
              description: office.description,
              positionCount: office.positionCount,
              jobPostCount: office.jobPostCount,
              members: office.membersPreview,
              membersPreviewCount: office.membersPreview.length,
              location: office.location,
              url: office.url,
              fetchError:
                htmlError instanceof Error
                  ? htmlError.message
                  : 'Failed to fetch office page',
            };
          }
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(this.officeConcurrency, Math.max(1, offices.length)) },
        () => worker(),
      ),
    );

    return enriched
      .filter(Boolean)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }

  private peopleFromOffices(
    offices: TheOrgOffice[],
    companySlug: string,
  ): TheOrgPerson[] {
    const flattened = offices.flatMap((office) =>
      (office.members || []).map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role || null,
        slug: member.slug || null,
        nodeId: `office:${office.slug || office.id || 'unknown'}:${member.id}`,
        parentNodeId: null,
        section: 'office',
        reportCount: 0,
        profileUrl:
          member.slug && companySlug
            ? this.buildPersonProfileUrl(companySlug, member.slug)
            : null,
        linkedInUrl: null,
        source: 'office' as const,
        sources: ['offices'] as TheOrgFetchMode[],
        officeIds: office.id ? [office.id] : [],
        officeSlugs: office.slug ? [office.slug] : [],
        officeNames: office.name ? [office.name] : [],
        profileImageUrl: member.profileImageUrl || null,
      })),
    );

    return this.dedupePeople(flattened).map((person) => ({
      ...person,
      officeIds: Array.from(new Set(person.officeIds || [])),
      officeSlugs: Array.from(new Set(person.officeSlugs || [])),
      officeNames: Array.from(new Set(person.officeNames || [])),
    }));
  }

  private normalizeMode(rawMode?: string | null): TheOrgFetchMode {
    const mode = String(rawMode || '').trim().toLowerCase();

    if (
      mode === 'teams' ||
      mode === 'orgchart' ||
      mode === 'offices' ||
      mode === 'combined'
    ) {
      return mode;
    }

    return 'combined';
  }

  private async fetchDirectReports(
    companyId: string,
    managerNodeId: string,
  ): Promise<TheOrgNormalizedNode[]> {
    const payload = {
      operationName: 'OrgChartDirectReport',
      variables: {
        companyId,
        managerId: managerNodeId,
      },
      query:
        'query OrgChartDirectReport($companyId: UUID!, $managerId: String!) { nodes(companyId: $companyId, mode: {directReports: {managerId: $managerId}}) { id title containingNodeId node { ... on Vacant { job { id slug title } } ... on Position { position { id fullName role slug claimedBy hasNotes profileImage { endpoint ext uri versions } social { twitterUrl linkedInUrl facebookUrl websiteUrl } } } } order parentId section type reportCount } }',
    };

    const response = await this.postJson<any>(GRAPHQL_URL, payload);
    if (response.errors?.length) {
      throw new Error(
        `GraphQL direct reports failed for ${managerNodeId}: ${response.errors
          .map((error: any) => error.message)
          .join('; ')}`,
      );
    }

    return (response.data?.nodes || []).map((node: any) => this.normalizeNode(node));
  }

  private async crawlFullTree(
    companyId: string,
    initialNodes: any[],
  ): Promise<TheOrgNormalizedNode[]> {
    const discovered = new Map<string, TheOrgNormalizedNode>();
    const queued = new Set<string>();
    const queue: string[] = [];

    for (const node of initialNodes.map((entry) => this.normalizeNode(entry))) {
      discovered.set(node.id, node);
      if (node.reportCount > 0 && node.section === 'orgChart') {
        queue.push(node.id);
        queued.add(node.id);
      }
    }

    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const managerNodeId = queue[cursor++];
        const children = await this.fetchDirectReports(companyId, managerNodeId);

        for (const node of children) {
          discovered.set(node.id, node);
          if (
            node.reportCount > 0 &&
            node.section === 'orgChart' &&
            !queued.has(node.id)
          ) {
            queue.push(node.id);
            queued.add(node.id);
          }
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(this.treeConcurrency, Math.max(1, queue.length)) },
        () => worker(),
      ),
    );

    return this.uniqueNodes([...discovered.values()]).sort((a, b) => {
      if ((a.section || '') !== (b.section || '')) {
        return String(a.section || '').localeCompare(String(b.section || ''));
      }

      return String(a.id).localeCompare(String(b.id));
    });
  }

  private peopleFromNodes(nodes: TheOrgNormalizedNode[], companySlug: string): TheOrgPerson[] {
    return this.dedupePeople(
      nodes
        .filter((node) => node.position?.fullName)
        .map((node) => ({
          id: node.position!.id,
          name: node.position!.fullName!,
          role: node.position!.role || null,
          slug: node.position!.slug || null,
          nodeId: node.id,
          parentNodeId: node.parentId || null,
          section: node.section || null,
          reportCount: node.reportCount ?? 0,
          profileUrl:
            node.position!.slug && companySlug
              ? this.buildPersonProfileUrl(companySlug, node.position!.slug)
              : null,
          linkedInUrl: node.position?.social?.linkedInUrl ?? null,
          profileImageUrl: this.buildImageUrl(node.position?.profileImage),
          source: 'orgChart' as const,
          sources: ['orgchart'] as TheOrgFetchMode[],
        })),
    );
  }

  private normalizeOrgChartPosition(position: any): Record<string, unknown> | null {
    if (!position) {
      return null;
    }

    return {
      positionId: position.positionId ?? position.id ?? null,
      fullName: position.fullName || null,
      positionSlug: position.positionSlug || position.slug || null,
      role: position.role || position.currentRole || null,
      profileImageUrl: this.buildImageUrl(position.profileImage || position.profilePicture),
    };
  }

  private parsePersonPage(html: string, sourceLabel: string): Record<string, unknown> {
    const nextData = this.extractNextData(html, sourceLabel);
    const pageProps = nextData?.props?.pageProps || {};
    const initialPosition = pageProps.initialPosition || null;

    if (!initialPosition) {
      throw new Error(`Could not find initialPosition in ${sourceLabel}`);
    }

    const ampMatch = html.match(
      /<script id="org-amp-script" type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    const ampData = ampMatch ? JSON.parse(ampMatch[1]) : null;
    const mainEntity = ampData?.mainEntity || {};
    const company = initialPosition.companyV2 || {};

    return {
      id: initialPosition.id,
      slug: initialPosition.slug || null,
      fullName: initialPosition.fullName || null,
      currentRole: initialPosition.currentRole || mainEntity.jobTitle || null,
      description: initialPosition.description || mainEntity.description || null,
      pronoun: initialPosition.pronoun || null,
      claimedBy: initialPosition.claimedBy ?? null,
      level: initialPosition.level ?? null,
      section: initialPosition.section || null,
      updatedAt: initialPosition.updatedAt || null,
      profileImageUrl: this.buildImageUrl(initialPosition.profilePicture),
      social: initialPosition.social || null,
      location: initialPosition.locationV2 || null,
      offices: Array.isArray(initialPosition.offices) ? initialPosition.offices : [],
      teams: Array.isArray(initialPosition.teams) ? initialPosition.teams : [],
      manager: this.normalizeOrgChartPosition(initialPosition.manager),
      reports: Array.isArray(initialPosition.reports)
        ? initialPosition.reports
            .map((entry: any) => this.normalizeOrgChartPosition(entry))
            .filter(Boolean)
        : [],
      previousCompanies: Array.isArray(initialPosition.previousCompanies)
        ? initialPosition.previousCompanies
        : [],
      roleTimeline: Array.isArray(initialPosition.roleTimeline)
        ? initialPosition.roleTimeline
        : [],
      company: {
        id: company.id || null,
        slug: company.slug || null,
        name: company.name || null,
        url: company.slug ? `${BASE_URL}/org/${company.slug}` : null,
        logoImageUrl: this.buildImageUrl(company.logoImage),
        verification: company.verification || null,
        private: company.private ?? null,
      },
      canonicalUrl:
        html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ||
        (company.slug && initialPosition.slug
          ? this.buildPersonProfileUrl(company.slug, initialPosition.slug)
          : null),
      structuredData: {
        image: mainEntity.image || null,
        sameAs: Array.isArray(mainEntity.sameAs) ? mainEntity.sameAs : [],
      },
    };
  }

  async fetchPersonProfileBySlugs(
    companySlug: string,
    personSlug: string,
    options?: TheOrgFetchPersonOptions,
  ): Promise<Record<string, unknown>> {
    const url = this.buildPersonProfileUrl(companySlug, personSlug);
    const html = await this.fetchText(url);
    const payload = this.parsePersonPage(html, url);

    if (options?.persist ?? this.shouldPersist) {
      const storage = await this.persistJson(
        this.buildStorageLocation('people', [companySlug, personSlug], options?.storageTarget),
        payload,
      );

      return {
        ...payload,
        storage,
      };
    }

    return payload;
  }

  private async enrichPeopleWithProfiles(
    companySlug: string,
    people: TheOrgPerson[],
  ): Promise<TheOrgPerson[]> {
    const enriched = new Array<TheOrgPerson>(people.length);
    let cursor = 0;

    const worker = async () => {
      while (cursor < people.length) {
        const currentIndex = cursor++;
        const person = people[currentIndex];

        if (!person?.slug) {
          enriched[currentIndex] = person;
          continue;
        }

        try {
          const profile = await this.fetchPersonProfileBySlugs(companySlug, person.slug);
          const social = profile.social as
            | { linkedInUrl?: string | null }
            | null
            | undefined;
          const linkedInFromProfile = social?.linkedInUrl ?? null;
          enriched[currentIndex] = {
            ...person,
            profileUrl:
              String(profile.canonicalUrl || '') ||
              this.buildPersonProfileUrl(companySlug, person.slug),
            linkedInUrl: person.linkedInUrl ?? linkedInFromProfile,
            profile,
          };
        } catch (error) {
          enriched[currentIndex] = {
            ...person,
            profileUrl: this.buildPersonProfileUrl(companySlug, person.slug),
            profileError:
              error instanceof Error ? error.message : 'Failed to fetch profile',
          };
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(this.profileConcurrency, Math.max(1, people.length)) },
        () => worker(),
      ),
    );

    return enriched;
  }

  /**
   * Tries fetchCompanyDetails with generateTheOrgSlugCandidates: exact id, static/env
   * overrides, stripped corporate suffixes (e.g. `-ltd`), then first-segment heuristic.
   * Retries on HTTP 404, or when `linkedinCompanySlug` is set and the page’s LinkedIn
   * company URL does not match (wrong TheOrg org).
   * If all candidates fail, `BRIGHT_DATA_API_KEY` is set, and the input is not a key in
   * `THEORG_SLUG_STATIC_OVERRIDES`, runs a Bright Data Google SERP query for
   * `{slug} site:theorg.com` (no corporate-suffix stripping) and retries with the first
   * `/org/{slug}` match from organic results.
   */
  async fetchCompanyDetailsResolvingSlug(
    slug: string,
    options?: TheOrgFetchCompanyOptions & {
      slugOverrides?: TheOrgSlugOverrides;
      /** LinkedIn company slug from our data; validated against TheOrg page when present. */
      linkedinCompanySlug?: string;
    },
  ): Promise<TheOrgCompanyResponse> {
    const { slugOverrides, linkedinCompanySlug, ...fetchOptions } = options ?? {};
    const candidates = generateTheOrgSlugCandidates(slug, slugOverrides);
    if (candidates.length === 0) {
      throw new Error(`TheOrg slug resolution: empty candidates for "${slug}"`);
    }

    const inputSlug = normalizeTheOrgSlugInput(slug);
    const failures: string[] = [];

    for (const candidate of candidates) {
      try {
        const result = await this.fetchCompanyDetails(candidate, {
          ...fetchOptions,
          linkedinCompanySlugExpected: linkedinCompanySlug,
        });
        return {
          ...result,
          slugResolution: {
            inputSlug,
            attemptedSlugs: candidates,
            successfulCandidate: candidate,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isNotFound =
          /\b404\b/.test(message) ||
          message.toLowerCase().includes('not found');
        const isLinkedInMismatch =
          message.includes('TheOrg LinkedIn company slug mismatch');
        if (!isNotFound && !isLinkedInMismatch) {
          this.logger.warn(
            `TheOrg slug candidate "${candidate}" failed (non-404): ${message}`,
          );
          throw error instanceof Error ? error : new Error(message);
        }
        failures.push(`${candidate}: ${message}`);
        this.logger.debug(
          isLinkedInMismatch
            ? `TheOrg slug candidate "${candidate}" failed LinkedIn slug check; trying next`
            : `TheOrg slug candidate "${candidate}" returned not found; trying next`,
        );
      }
    }

    const skipBrightDataSerp =
      hasStaticTheOrgSlugOverride(slug) || !this.brightDataSerpService.isConfigured();

    if (!skipBrightDataSerp) {
      const searchUrl = buildGoogleTheOrgSiteSearchUrl(inputSlug);
      try {
        const serp = await this.brightDataSerpService.requestSerpGoogleJson(searchUrl);

        const discovered = extractTheOrgCompanySlugFromSerpOrganic(serp.organic);
        console.log("Discovered slug from Bright Data SERP:", discovered);
        if (discovered && !candidates.includes(discovered)) {
          try {
            const result = await this.fetchCompanyDetails(discovered, {
              ...fetchOptions,
              linkedinCompanySlugExpected: linkedinCompanySlug,
            });
            return {
              ...result,
              slugResolution: {
                inputSlug,
                attemptedSlugs: [...candidates, discovered],
                successfulCandidate: discovered,
                discoveredViaBrightDataSerp: true,
              },
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failures.push(`brightDataSerp:${discovered}: ${message}`);
            this.logger.warn(
              `TheOrg slug from Bright Data SERP "${discovered}" failed: ${message}`,
            );
          }
        } else if (discovered && candidates.includes(discovered)) {
          this.logger.debug(
            `Bright Data SERP returned slug "${discovered}" already in candidate list; skipping duplicate fetch`,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`brightDataSerp: ${message}`);
        this.logger.warn(`Bright Data SERP TheOrg discovery failed: ${message}`);
      }
    }

    throw new Error(
      `TheOrg could not resolve a company page for "${slug}"; tried: ${candidates.join(', ')}. ${failures.join('; ')}`,
    );
  }

  async fetchCompanyDetails(
    slug: string,
    options?: TheOrgFetchCompanyOptions,
  ): Promise<TheOrgCompanyResponse> {
    const mode = this.normalizeMode(options?.mode);
    const includePeopleProfiles = Boolean(options?.includePeopleProfiles);
    const url = `${BASE_URL}/org/${slug}`;
    const html = await this.fetchText(url);
    const nextData = this.extractNextData(html, url);
    const pageProps = nextData?.props?.pageProps || {};
    const initialCompany = pageProps.initialCompany || {};
    const linkedInCompanySlugFromPage = parseLinkedInCompanySlugFromUrl(
      (initialCompany.social as { linkedInUrl?: string | null } | undefined)
        ?.linkedInUrl,
    );
    const expectedLinkedIn = options?.linkedinCompanySlugExpected?.trim();
    if (expectedLinkedIn) {
      const expected = normalizeTheOrgSlugInput(expectedLinkedIn);
      if (
        linkedInCompanySlugFromPage &&
        expected &&
        linkedInCompanySlugFromPage !== expected
      ) {
        throw new Error(
          `TheOrg LinkedIn company slug mismatch: expected "${expected}" but page has "${linkedInCompanySlugFromPage}"`,
        );
      }
    }
    const apolloState = pageProps.__APOLLO_STATE__ || {};
    const ssrPeople = this.uniquePeopleFromApollo(apolloState);
    const initialNodes = pageProps.initialNodes || [];
    const initialTeams = pageProps.initialTeams || [];
    const initialOffices = Array.isArray(initialCompany.offices)
      ? initialCompany.offices
      : [];
    const resolvedCompanySlug = initialCompany.slug || slug;
    const skipFullTree = this.shouldSkipFullTree(initialCompany.stats);
    const shouldFetchOrgChart = mode === 'orgchart' || mode === 'combined';
    const shouldFetchTeams = mode === 'teams' || mode === 'combined';
    const shouldFetchOffices = mode === 'offices' || mode === 'combined';
    const fullNodes = shouldFetchOrgChart
      ? skipFullTree
        ? this.uniqueNodes(initialNodes.map((entry) => this.normalizeNode(entry)))
        : await this.crawlFullTree(initialCompany.id, initialNodes)
      : [];
    const orgChartPeople = shouldFetchOrgChart
      ? this.peopleFromNodes(fullNodes, resolvedCompanySlug)
      : [];
    const teams =
      shouldFetchTeams && resolvedCompanySlug
        ? await this.enrichTeamsWithMembers(resolvedCompanySlug, initialTeams)
        : [];
    const teamPeople =
      shouldFetchTeams && resolvedCompanySlug
        ? this.peopleFromTeams(teams, resolvedCompanySlug)
        : [];
    const offices =
      shouldFetchOffices && resolvedCompanySlug
        ? await this.enrichOfficesWithMembers(resolvedCompanySlug, initialOffices)
        : [];
    const officePeople =
      shouldFetchOffices && resolvedCompanySlug
        ? this.peopleFromOffices(offices, resolvedCompanySlug)
        : [];
    const peopleForMode =
      mode === 'combined'
        ? [...orgChartPeople, ...teamPeople, ...officePeople]
        : mode === 'teams'
          ? teamPeople
          : mode === 'offices'
            ? officePeople
            : orgChartPeople;
    const basePeople = this.dedupePeople(peopleForMode).map((person) => {
      const orgChartMatch = orgChartPeople.find((candidate) => candidate.id === person.id);
      const teamMatch = teamPeople.find((candidate) => candidate.id === person.id);
      const officeMatch = officePeople.find((candidate) => candidate.id === person.id);
      const sources = new Set<TheOrgFetchMode>([
        ...((orgChartMatch?.sources || (orgChartMatch ? ['orgchart'] : [])) as TheOrgFetchMode[]),
        ...((teamMatch?.sources || (teamMatch ? ['teams'] : [])) as TheOrgFetchMode[]),
        ...((officeMatch?.sources || (officeMatch ? ['offices'] : [])) as TheOrgFetchMode[]),
      ]);

      return {
        ...person,
        profileUrl:
          person.profileUrl ||
          (person.slug
            ? this.buildPersonProfileUrl(resolvedCompanySlug, person.slug)
            : null),
        linkedInUrl: person.linkedInUrl ?? null,
        teamIds: Array.from(new Set(person.teamIds || [])),
        teamSlugs: Array.from(new Set(person.teamSlugs || [])),
        teamNames: Array.from(new Set(person.teamNames || [])),
        officeIds: Array.from(new Set(person.officeIds || [])),
        officeSlugs: Array.from(new Set(person.officeSlugs || [])),
        officeNames: Array.from(new Set(person.officeNames || [])),
        sources: [...sources].sort(),
      };
    });
    const shouldInlineProfiles =
      includePeopleProfiles &&
      (Boolean(options?.forceInlineProfiles) ||
        basePeople.length <= this.inlineProfileMaxPeople);
    const people = shouldInlineProfiles
      ? await this.enrichPeopleWithProfiles(resolvedCompanySlug, basePeople)
      : basePeople;

    const payload: TheOrgCompanyResponse = {
      inputName: slug,
      companyName: initialCompany.name || slug,
      slug: resolvedCompanySlug,
      linkedInCompanySlug: linkedInCompanySlugFromPage,
      url,
      tags: Array.isArray(initialCompany.industries)
        ? initialCompany.industries.map((tag: any) => tag.title).filter(Boolean)
        : [],
      stats: initialCompany.stats || null,
      ssrPeopleCount: ssrPeople.length,
      fullNodeCount: fullNodes.length,
      fullTreeCrawled: shouldFetchOrgChart && !skipFullTree,
      partialResult: shouldFetchOrgChart && skipFullTree,
      partialResultReason:
        shouldFetchOrgChart && skipFullTree
          ? `Skipped full org crawl because positionCount exceeded ${this.maxFullTreePositionCount}.`
          : null,
      mode,
      includePeopleProfiles,
      peopleProfilesDeferred: includePeopleProfiles && !shouldInlineProfiles,
      peopleProfileFetchConcurrency: shouldInlineProfiles ? this.profileConcurrency : 0,
      inlineProfileMaxPeople: this.inlineProfileMaxPeople,
      maxFullTreePositionCount: this.maxFullTreePositionCount,
      teamCount: teams.length,
      officeCount: offices.length,
      orgChartPeopleCount: orgChartPeople.length,
      teamPeopleCount: teamPeople.length,
      officePeopleCount: officePeople.length,
      nodes: fullNodes,
      teams,
      offices,
      orgChartPeople,
      teamPeople,
      officePeople,
      people,
    };

    if (options?.persist ?? this.shouldPersist) {
      const storage = await this.persistJson(
        this.buildStorageLocation('companies', [resolvedCompanySlug], options?.storageTarget),
        payload as unknown as Record<string, unknown>,
      );

      return {
        ...payload,
        storage,
      };
    }

    return payload;
  }
}
