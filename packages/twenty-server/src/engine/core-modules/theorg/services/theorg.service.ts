import { Injectable, Logger } from '@nestjs/common';

import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';
import type {
  TheOrgCompanyResponse,
  TheOrgFetchCompanyOptions,
  TheOrgFetchPersonOptions,
  TheOrgImage,
  TheOrgNormalizedNode,
  TheOrgPerson,
  TheOrgStorageLocation,
  TheOrgStorageTarget
} from 'src/engine/core-modules/theorg/types/theorg.types';

const BASE_URL = 'https://theorg.com';
const GRAPHQL_URL = 'https://prod-graphql-api.theorg.com/graphql';
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Mobile Safari/537.36';

@Injectable()
export class TheOrgService {
  private readonly logger = new Logger(TheOrgService.name);

  constructor(private readonly fileStorageService: FileStorageService) {}

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
      byId.set(person.id, person);
    }

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
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
          enriched[currentIndex] = {
            ...person,
            profileUrl:
              String(profile.canonicalUrl || '') ||
              this.buildPersonProfileUrl(companySlug, person.slug),
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

  async fetchCompanyDetails(
    slug: string,
    options?: TheOrgFetchCompanyOptions,
  ): Promise<TheOrgCompanyResponse> {
    const includePeopleProfiles = Boolean(options?.includePeopleProfiles);
    const url = `${BASE_URL}/org/${slug}`;
    const html = await this.fetchText(url);
    const nextData = this.extractNextData(html, url);
    const pageProps = nextData?.props?.pageProps || {};
    const initialCompany = pageProps.initialCompany || {};
    const apolloState = pageProps.__APOLLO_STATE__ || {};
    const ssrPeople = this.uniquePeopleFromApollo(apolloState);
    const initialNodes = pageProps.initialNodes || [];
    const fullNodes = await this.crawlFullTree(initialCompany.id, initialNodes);
    const resolvedCompanySlug = initialCompany.slug || slug;
    const basePeople = this.peopleFromNodes(fullNodes, resolvedCompanySlug);
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
      url,
      tags: Array.isArray(initialCompany.industries)
        ? initialCompany.industries.map((tag: any) => tag.title).filter(Boolean)
        : [],
      stats: initialCompany.stats || null,
      ssrPeopleCount: ssrPeople.length,
      fullNodeCount: fullNodes.length,
      includePeopleProfiles,
      peopleProfilesDeferred: includePeopleProfiles && !shouldInlineProfiles,
      peopleProfileFetchConcurrency: shouldInlineProfiles ? this.profileConcurrency : 0,
      inlineProfileMaxPeople: this.inlineProfileMaxPeople,
      nodes: fullNodes,
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
