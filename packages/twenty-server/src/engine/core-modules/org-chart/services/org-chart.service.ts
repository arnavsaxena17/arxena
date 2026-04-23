import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { readFile } from 'fs/promises';
import * as path from 'path';

import { graphqlToFindManyCompanies, OrgChartData } from 'twenty-shared';

import { WorkspaceMemberProfileUnipileService } from 'src/engine/core-modules/arx-chat/services/workspace-member-profile-unipile.service';
import { CreditTransactionService } from 'src/engine/core-modules/billing/services/credit-transaction.service';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { ContactEnrichmentWaterfallService } from 'src/engine/core-modules/contact-enrichment/services/contact-enrichment-waterfall.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { OrgChartCacheService } from 'src/engine/core-modules/org-chart/services/orgchart-cache.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import {
    applyBlankOrgChartSizeForExpectedHeadcount,
    applyBlankOrgChartSubsetFilter,
} from '../utils/blank-org-chart-subset.util';
import { mergeManualCompanyAutocompleteResults } from '../utils/manual-company-autocomplete.util';
import { ArxenaBackendService } from './arxena-backend.service';
import { OrgChartEsService } from './org-chart-es.service';
import { normalizeOrgChartPayload } from './org-chart-payload-normalize';
import { OrgChartS3Service } from './orgchart-s3.service';
import { PdlAutocompleteService } from './pdl-autocomplete.service';
import { PeopleEsService } from './people-es.service';

export type OrgChartServiceGetOrgChartResult = {
  data: Record<string, unknown>;
  /** Set when the primary ES org-chart lookup failed with a transport error (e.g. timeout). */
  orgChartEsTransportError?: boolean;
};

@Injectable()
export class OrgChartService {
  private readonly logger = new Logger(OrgChartService.name);

  constructor(
    private readonly arxenaBackend: ArxenaBackendService,
    private readonly pdlAutocomplete: PdlAutocompleteService,
    private readonly orgChartEsService: OrgChartEsService,
    private readonly peopleEsService: PeopleEsService,
    private readonly contactEnrichmentWaterfall: ContactEnrichmentWaterfallService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    private readonly creditTransactionService: CreditTransactionService,
    private readonly orgChartS3Service: OrgChartS3Service,
    private readonly orgChartCacheService: OrgChartCacheService,
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly orgChartCacheStorageService: CacheStorageService,
  ) {}

  /**
   * Clears Redis keys for full-company classic org chart + candidate list caches,
   * and deletes the persisted org-charts/{company}/ folder in object storage.
   */
  async clearCompanyOrgChartCaches(input: {
    companyId?: string;
    companyName?: string;
  }): Promise<void> {
    await this.orgChartCacheService.invalidateEntireCompanyClassicCaches(input);
    const resolvedNameForS3 =
      (input.companyName ?? '').trim() || (input.companyId ?? '');
    const persistKey = this.orgChartS3Service.persistedCompanyFolderKey(
      input.companyId,
      resolvedNameForS3,
    );
    await this.orgChartS3Service.deletePersistedCompanyFolder(persistKey);
    this.logger.log(
      `Cleared org chart Redis + S3 cache for persistKey=${persistKey}`,
    );
  }

  private parseOrgChartNodes(value: unknown): Array<Record<string, unknown>> {
    if (Array.isArray(value)) {
      return value.filter((n) => n && typeof n === 'object') as Array<
        Record<string, unknown>
      >;
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((n) => n && typeof n === 'object') as Array<
            Record<string, unknown>
          >;
        }
      } catch {
        return [];
      }
    }
    return [];
  }

  private isMaskedFullName(raw: unknown): boolean {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!s) return true;
    const normalized = s.replace(/\s+/g, '').toLowerCase();
    if (!normalized) return true;
    if (normalized === 'unknownlinkedinmember') return true;
    return /^x+$/u.test(normalized) || /^[xy]+$/u.test(normalized);
  }

  private normalizeLinkedinUrl(raw: unknown): string | undefined {
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (!s) return undefined;
    return s;
  }

  private applyEnrichmentToCandidateRow(
    row: Record<string, unknown>,
    input: {
      emails?: string[];
      phones?: string[];
      linkedinUrl?: string;
      fullName?: string;
      source?: string;
    },
  ): Record<string, unknown> {
    const next: Record<string, unknown> = { ...row };
    const email =
      Array.isArray(input.emails) && input.emails.length > 0
        ? String(input.emails[0])
        : undefined;
    const phone =
      Array.isArray(input.phones) && input.phones.length > 0
        ? String(input.phones[0])
        : undefined;
    const linkedinUrl = this.normalizeLinkedinUrl(input.linkedinUrl);
    const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';

    if (email) {
      next.email = email;
    }
    if (phone) {
      next.phone = phone;
    }
    if (Array.isArray(input.emails)) {
      next.m7kq_enrichment_emails = input.emails;
    }
    if (Array.isArray(input.phones)) {
      next.m7kq_enrichment_phones = input.phones;
    }
    if (linkedinUrl) {
      next.std_linkedin_url = linkedinUrl;
      next.linkedin_url = linkedinUrl;
    }
    if (fullName && (this.isMaskedFullName(next.full_name) || this.isMaskedFullName(next.fullName))) {
      next.full_name = fullName;
      next.fullName = fullName;
    }
    if (input.source) {
      next.contact_enrichment_source = input.source;
    }

    return next;
  }

  async applyEnrichmentToStoredOrgChart(
    companyId: string,
    input: {
      companyName?: string;
      m7kqPersonId?: string;
      companyDomain?: string;
      linkedinUrl?: string;
      emails?: string[];
      phones?: string[];
      fullName?: string;
      source?: string;
    },
    authToken: string,
  ): Promise<{ updated: boolean; persistedTo: Array<'redis' | 's3'> }> {
    if (!authToken?.trim()) {
      throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED);
    }
    const hasM7kqKey =
      typeof input.m7kqPersonId === 'string' &&
      input.m7kqPersonId.trim().length > 0 &&
      typeof input.companyDomain === 'string' &&
      input.companyDomain.trim().length > 0;
    const hasLinkedinUrl =
      typeof input.linkedinUrl === 'string' && input.linkedinUrl.trim().length > 0;
    if (!hasM7kqKey && !hasLinkedinUrl) {
      throw new HttpException(
        'm7kqPersonId+companyDomain or linkedinUrl is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const cacheKey = this.buildCompanyOrgChartCacheKey(undefined, companyId);
    const cachedOrgChartPayload = await this.orgChartCacheStorageService.get<{
      orgChart?: Record<string, unknown>;
      cachedAt?: string;
      itemCount?: number;
    }>(cacheKey);

    let orgChart: Record<string, unknown> | null =
      cachedOrgChartPayload?.orgChart ?? null;
    let source: 'redis' | 's3' | null = orgChart ? 'redis' : null;

    if (!orgChart) {
      orgChart = (await this.orgChartS3Service.getOrgChart(companyId)) as
        | Record<string, unknown>
        | null;
      source = orgChart ? 's3' : null;
    }

    if (!orgChart) {
      throw new HttpException('No cached org chart found', HttpStatus.NOT_FOUND);
    }

    const rawNodes = this.parseOrgChartNodes((orgChart as { orgchart?: unknown }).orgchart);
    if (rawNodes.length === 0) {
      throw new HttpException('Org chart payload has no nodes', HttpStatus.BAD_REQUEST);
    }

    const m7kqPersonId = input.m7kqPersonId?.trim();
    const linkedinUrl = this.normalizeLinkedinUrl(input.linkedinUrl);
    let updated = false;

    const updatedNodes = rawNodes.map((node) => {
      const candidatesRaw = (node as { candidates?: unknown }).candidates;
      const candidates = Array.isArray(candidatesRaw)
        ? (candidatesRaw as unknown[])
        : candidatesRaw && typeof candidatesRaw === 'object'
          ? [candidatesRaw]
          : [];

      if (candidates.length === 0) {
        return node;
      }

      const nextCandidates = candidates.map((c) => {
        if (!c || typeof c !== 'object') return c;
        const row = c as Record<string, unknown>;
        const rowId = typeof row.id === 'string' ? row.id.trim() : '';
        const rowLi =
          typeof row.std_linkedin_url === 'string'
            ? row.std_linkedin_url.trim()
            : typeof row.linkedin_url === 'string'
              ? row.linkedin_url.trim()
              : '';

        const matches =
          (m7kqPersonId && rowId && rowId === m7kqPersonId) ||
          (linkedinUrl && rowLi && rowLi === linkedinUrl);

        if (!matches) {
          return c;
        }
        updated = true;
        return this.applyEnrichmentToCandidateRow(row, {
          emails: input.emails,
          phones: input.phones,
          linkedinUrl: input.linkedinUrl,
          fullName: input.fullName,
          source: input.source,
        });
      });

      return {
        ...node,
        candidates: Array.isArray(candidatesRaw) ? nextCandidates : nextCandidates[0] ?? candidatesRaw,
      };
    });

    if (!updated) {
      return { updated: false, persistedTo: [] };
    }

    const updatedOrgChart: Record<string, unknown> = {
      ...orgChart,
      orgchart: updatedNodes,
    };

    const persistedTo: Array<'redis' | 's3'> = [];

    // Write-through to Redis cache (same key read by /org-chart/:companyId).
    await this.orgChartCacheStorageService.set(
      cacheKey,
      {
        ...(cachedOrgChartPayload ?? {}),
        orgChart: updatedOrgChart,
        cachedAt: new Date().toISOString(),
      },
      60 * 60 * 24 * 90,
    );
    persistedTo.push('redis');

    // Also write to S3 (best-effort).
    await this.orgChartS3Service.saveOrgChart(companyId, updatedOrgChart as OrgChartData);
    persistedTo.push('s3');

    this.logger.log(
      `Applied enrichment to cached org chart for companyId=${companyId} (source=${source ?? 'none'})`,
    );

    return { updated: true, persistedTo };
  }

  async getCompanyAutocomplete(
    inputText: string,
    authToken?: string,
  ): Promise<
    {
      name: string;
      meta: {
        id: string;
        website?: string;
        industry?: string;
        location_name?: string;
      };
      count: number;
    }[]
  > {
    const baseResults = this.pdlAutocomplete.isConfigured()
      ? await this.pdlAutocomplete.getCompanyAutocomplete(inputText)
      : await this.arxenaBackend.getCompanyAutocomplete(inputText, authToken);

    return mergeManualCompanyAutocompleteResults(inputText, baseResults);
  }

  async getOrgChart(
    companyId: string,
    optionsOrAuthToken?:
      | string
      | {
          companyName?: string;
          website?: string;
          country?: string;
          functionRoot?: string;
          serveCachedOnly?: boolean;
          /** Hint for blank-template scale (autocomplete count, profile count, LinkedIn headcount). */
          expectedEmployeeCount?: number;
        },
    authTokenOptional?: string,
  ): Promise<OrgChartServiceGetOrgChartResult> {
    let options: {
      companyName?: string;
      website?: string;
      country?: string;
      functionRoot?: string;
      serveCachedOnly?: boolean;
      expectedEmployeeCount?: number;
    } = {};

    let authToken: string | undefined;

    if (
      typeof optionsOrAuthToken === 'string' ||
      typeof optionsOrAuthToken === 'undefined'
    ) {
      // Backwards-compatible signature: (companyId, authToken?)
      authToken = optionsOrAuthToken;
    } else {
      options = optionsOrAuthToken ?? {};
      authToken = authTokenOptional;
    }

    let orgChartEsTransportError = false;

    const hasAuthToken =
      typeof authToken === 'string' && authToken.trim() !== '';
    const authTokenString = hasAuthToken ? (authToken as string) : undefined;

    const cacheKey = this.buildCompanyOrgChartCacheKey(
      options.companyName,
      companyId,
    );
    const cachedOrgChartPayload = await this.orgChartCacheStorageService.get<{
      orgChart?: Record<string, unknown>;
      cachedAt?: string;
      itemCount?: number;
    }>(cacheKey);

    // Authenticated users should prefer Redis/S3 over ES preview templates.
    if (hasAuthToken && cachedOrgChartPayload?.orgChart) {
      return {
        data: normalizeOrgChartPayload(cachedOrgChartPayload.orgChart),
        ...(orgChartEsTransportError
          ? { orgChartEsTransportError: true }
          : {}),
      };
    }

    // Redis miss: try S3 only if this workspace member has a credit transaction for this path.
    const persistKeyForS3 = this.orgChartS3Service.persistedCompanyFolderKey(
      companyId,
      options.companyName?.trim() || companyId,
    );
    const orgChartS3RelativePath =
      this.orgChartS3Service.buildRelativeFolderPathFromPersistedKey(
        persistKeyForS3,
      );
    let s3OrgChart: OrgChartData | null = null;

    if (authTokenString) {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(
          authTokenString,
        );
      const workspaceMemberId =
        await this.workspaceQueryService.getWorkspaceMemberIdFromToken(
          authTokenString,
        );

      if (workspaceId && workspaceMemberId) {
        const canReadS3 =
          await this.creditTransactionService.hasOrgChartS3AccessForMember(
            workspaceId,
            workspaceMemberId,
            orgChartS3RelativePath,
            persistKeyForS3,
          );

        if (canReadS3) {
          s3OrgChart = await this.orgChartS3Service.getOrgChart(companyId);
        }
      }
    }

    if (hasAuthToken && s3OrgChart) {
      this.logger.log(
        `Serving org chart from S3 fallback for companyId=${companyId}`,
      );

      return {
        data: normalizeOrgChartPayload(s3OrgChart as Record<string, unknown>),
        ...(orgChartEsTransportError
          ? { orgChartEsTransportError: true }
          : {}),
      };
    }

    // Unauthenticated (or no cached chart for authed) path: allow ES as the primary source
    // unless we are explicitly told to serve cached only.
    if (!options.serveCachedOnly) {
      const esOutcome = await this.orgChartEsService.getOrgChartByCompanyId(
        companyId,
        options,
      );

      orgChartEsTransportError = esOutcome.esTransportError === true;

      if (esOutcome.document) {
        return {
          data: normalizeOrgChartPayload(esOutcome.document),
        };
      }
    }

    // For authenticated users, allow a Redis hit even if ES misses (and for safety, keep this
    // check for unauth as well in case a chart is cached by other flows).
    if (cachedOrgChartPayload?.orgChart) {
      return {
        data: normalizeOrgChartPayload(cachedOrgChartPayload.orgChart),
        ...(orgChartEsTransportError
          ? { orgChartEsTransportError: true }
          : {}),
      };
    }

    if (s3OrgChart) {
      this.logger.log(
        `Serving org chart from S3 fallback for companyId=${companyId}`,
      );

      return {
        data: normalizeOrgChartPayload(s3OrgChart as Record<string, unknown>),
        ...(orgChartEsTransportError
          ? { orgChartEsTransportError: true }
          : {}),
      };
    }

    // No ES document, no Redis cache and no S3 data: serve static blank org chart template so the
    // frontend can show a placeholder structure instead of empty. No credits debited for blank.
    const blankChart = await this.getBlankOrgChartPlaceholder(
      companyId,
      {
        companyName: options.companyName,
        website: options.website,
        country: options.country,
        functionRoot: options.functionRoot,
        expectedEmployeeCount: options.expectedEmployeeCount,
      },
    );

    if (blankChart) {
      this.logger.log(
        `Serving blank org chart placeholder for companyId=${companyId} from static file`,
      );

      return {
        data: normalizeOrgChartPayload(blankChart),
        ...(orgChartEsTransportError
          ? { orgChartEsTransportError: true }
          : {}),
      };
    }

    this.logger.warn(
      `Org chart not found in ES for companyId=${companyId}; blank placeholder file unavailable, returning empty org chart`,
    );

    return {
      data: normalizeOrgChartPayload({
        company_id: companyId,
        orgchart: [],
        country: options.country ?? 'global',
        type: options.functionRoot ?? 'fullcompany',
      } as Record<string, unknown>),
      ...(orgChartEsTransportError
        ? { orgChartEsTransportError: true }
        : {}),
    };
  }

  /**
   * Load the static blank org chart template (from arxena-site Python output)
   * and override company fields for the requested companyId. Returns null if
   * the file is missing or invalid.
   */
  private async getBlankOrgChartPlaceholder(
    companyId: string,
    options: {
      companyName?: string;
      website?: string;
      country?: string;
      functionRoot?: string;
      expectedEmployeeCount?: number;
    },
  ): Promise<Record<string, unknown> | null> {
    const cwd = process.cwd();
    const candidates = [
      path.join(__dirname, '..', 'static', 'blank_org_chart_emp_obj.json'),
      path.join(
        cwd,
        'src',
        'engine',
        'core-modules',
        'org-chart',
        'static',
        'blank_org_chart_emp_obj.json',
      ),
      path.join(
        cwd,
        'packages',
        'twenty-server',
        'src',
        'engine',
        'core-modules',
        'org-chart',
        'static',
        'blank_org_chart_emp_obj.json',
      ),
    ];

    for (const staticPath of candidates) {
      try {
        const raw = await readFile(staticPath, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const subsetFiltered = applyBlankOrgChartSubsetFilter(parsed, {
          country: options.country,
          functionRoot: options.functionRoot,
        });
        const sizedForHeadcount = applyBlankOrgChartSizeForExpectedHeadcount(
          subsetFiltered,
          options.expectedEmployeeCount,
        );

        return {
          ...sizedForHeadcount,
          company_id: companyId,
          job_company_id: companyId,
          job_company_name: options.companyName ?? companyId,
          country: options.country ?? 'global',
          type: options.functionRoot ?? 'fullcompany',
          is_blank_template: true,
        } as Record<string, unknown>;
      } catch (err) {
        continue;
      }
    }

    return null;
  }

  private buildCompanyOrgChartCacheKey(
    companyName: string | undefined,
    companyId: string | undefined,
  ): string {
    const normalizedCompanyName = (companyName ?? '').trim();
    const normalizedCompanyId = this.normalizeCompanyId(
      companyId,
      normalizedCompanyName,
    );

    return [
      'company-orgchart',
      normalizedCompanyId,
      'entire_company',
      'classic',
    ].join(':');
  }

  private normalizeCompanyId(
    companyId?: string,
    fallbackName?: string,
  ): string {
    const normalizedCompanyId = (companyId ?? '').trim().toLowerCase();

    if (normalizedCompanyId) {
      return normalizedCompanyId;
    }

    const normalizedFallbackName = (fallbackName ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    return normalizedFallbackName || 'unknown_company';
  }

  /**
   * Fetch a manual org chart for specific companies like Yuga Labs.
   * For Yuga Labs we mirror the Python `get_manual_org_chart_local_obj`
   * behaviour by reading the static JSON file from arxena-site and
   * returning it directly to the frontend.
   */
  async getManualOrgChart(companyId: string): Promise<Record<string, unknown>> {
    const normalizedCompanyId = companyId.replace(/-/g, '_').toLowerCase();

    if (normalizedCompanyId === 'yuga_labs') {
      try {
        /**
         * We intentionally read the same static JSON file that the
         * Python search_model uses:
         *   arxena-site/arxenas3/static/yuga_labs_all_org_chart_assist.json
         *
         * We resolve the sibling `arxena-site` directory robustly from
         * the current working directory, which may be either:
         *   - /.../arx/arxena
         *   - /.../arx/arxena/packages
         *   - /.../arx/arxena/packages/twenty-server
         */
        const cwd = process.cwd();
        const cwdBase = path.basename(cwd);
        const parentBase = path.basename(path.dirname(cwd));

        let arxenaSiteRoot: string;

        if (cwdBase === 'twenty-server' && parentBase === 'packages') {
          // /.../arx/arxena/packages/twenty-server -> /.../arx/arxena-site
          arxenaSiteRoot = path.resolve(cwd, '..', '..', '..', 'arxena-site');
        } else if (cwdBase === 'packages') {
          arxenaSiteRoot = path.resolve(cwd, '..', 'arxena-site');
        } else {
          arxenaSiteRoot = path.resolve(cwd, '..', 'arxena-site');
        }

        const filePath = path.resolve(
          arxenaSiteRoot,
          'arxenas3/static/yuga_labs_all_org_chart_assist.json',
        );

        this.logger.log(
          `Serving MANUAL org chart for companyId=${companyId} from static file: ${filePath}`,
        );

        const raw = await readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;

        return normalizeOrgChartPayload(parsed);
      } catch (error) {
        this.logger.error(
          `Failed to read manual org chart JSON for companyId=${companyId}; falling back to legacy backend`,
          error,
        );
      }
    }

    // Fallback for non-Yuga companies or if the static file cannot be read.
    return (await this.getOrgChart(companyId)).data;
  }

  async getNodePeople(
    companyId: string,
    payload: {
      companyName?: string;
      website?: string;
      stdFunction?: string;
      stdGrade?: string;
      country?: string;
      limit?: number;
    },
    _authToken?: string,
  ): Promise<{ items: Record<string, unknown>[]; itemCount: number }> {
    const items = await this.peopleEsService.searchForOrgChartNode({
      companyId,
      companyName: payload.companyName,
      website: payload.website,
      stdFunction: payload.stdFunction,
      stdGrade: payload.stdGrade,
      country: payload.country,
      limit: payload.limit,
    });

    return {
      items,
      itemCount: items.length,
    };
  }

  async postQuery(
    body: {
      query: Record<string, unknown>;
      params: Record<string, unknown>;
      selected_context_menu?: string;
      selected_nodes?: unknown[];
      selected_blocks?: string;
    },
    authToken?: string,
  ): Promise<unknown> {
    const params = body.params as {
      current_focus?: unknown;
      data_source?: unknown;
    };

    this.logger.log(
      `Forwarding org chart query to legacy arxena-site backend with focus=${String(
        params.current_focus ?? '',
      )} data_source=${String(params.data_source ?? '')}`,
    );
    this.logger.debug(
      `Org chart query payload: ${JSON.stringify(body).slice(0, 4000)}`,
    );
    const result = await this.arxenaBackend.postQuery(body, authToken);

    this.logger.log('Received response from legacy arxena-site backend');

    return result;
  }

  async getContactInfoForPerson(
    payload: {
      linkedinUrl: string;
    },
    authToken?: string,
  ): Promise<{ emailAddresses: string[]; phoneNumbers: string[] }> {
    const trimmedUrl = payload.linkedinUrl.trim();

    if (!trimmedUrl) {
      return { emailAddresses: [], phoneNumbers: [] };
    }

    const wantEmail = true;
    const wantPhone = true;

    if (process.env.IS_BILLING_ENABLED === 'true' && authToken?.trim()) {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(authToken);
      const hasSufficient =
        await this.workspaceCreditsService.hasSufficientContactCredits(
          workspaceId,
          wantEmail,
          wantPhone,
        );

      if (!hasSufficient) {
        throw new HttpException(
          'Insufficient contact credits',
          HttpStatus.FORBIDDEN,
        );
      }
      await this.workspaceCreditsService.debitContactCredits(
        workspaceId,
        wantEmail ? 1 : 0,
        wantPhone ? 1 : 0,
        { linkedinUrl: trimmedUrl, source: 'org_chart_contact' },
      );
    }

    // Use the new contact enrichment waterfall service (all in NestJS, no arxena-site)
    try {
      const result = await this.contactEnrichmentWaterfall.fetchContacts(
        trimmedUrl,
        { wantEmail, wantPhone },
      );

      return {
        emailAddresses: result.emails ?? [],
        phoneNumbers: result.phones ?? [],
      };
    } catch (error) {
      this.logger.error(
        `Contact enrichment failed for ${trimmedUrl}`,
        error as Error,
      );

      return { emailAddresses: [], phoneNumbers: [] };
    }
  }

  /**
   * Find a company by name, searching locally first, then LinkedIn if not found.
   * Returns company ID, name, LinkedIn URL, and source.
   */
  async findCompanyByName(
    companyName: string,
    authToken: string,
    workspaceMemberId?: string | null,
  ): Promise<{
    found: boolean;
    companyId?: string;
    companyName?: string;
    linkedinUrl?: string;
    source?: 'local' | 'linkedin';
    message?: string;
  }> {
    if (!companyName || companyName.trim().length === 0) {
      return {
        found: false,
        message: 'Company name is required',
      };
    }

    const trimmedName = companyName.trim();

    // First try to find locally
    try {
      const data = await this.staticGraphQLService.executeGraphQL(
        graphqlToFindManyCompanies,
        {
          filter: { name: { like: `%${trimmedName}%` } },
          limit: 5,
        },
        authToken,
      );

      const companies = (data?.data?.companies?.edges ?? []) as Array<{
        node: {
          id: string;
          name?: string;
          linkedinLink?: { primaryLinkUrl?: string } | null;
        };
      }>;

      if (companies.length > 0) {
        // Try exact match first
        const exactMatch = companies.find(
          (c) => c.node.name?.toLowerCase() === trimmedName.toLowerCase(),
        );
        const match = exactMatch ?? companies[0];

        if (match?.node) {
          return {
            found: true,
            companyId: match.node.id,
            companyName: match.node.name ?? trimmedName,
            linkedinUrl: match.node.linkedinLink?.primaryLinkUrl ?? undefined,
            source: 'local',
          };
        }
      }
    } catch (error) {
      this.logger.warn(
        `Error searching local companies for "${trimmedName}":`,
        error,
      );
    }

    // If not found locally, search LinkedIn
    try {
      const workspaceId =
        await this.workspaceQueryService.getWorkspaceIdFromToken(authToken);
      const accountId =
        await this.workspaceMemberProfileUnipileService.getWorkspaceMemberUnipileAccountId(
          workspaceMemberId ?? null,
          workspaceId,
          authToken,
          'linkedin',
        );

      if (!accountId) {
        return {
          found: false,
          message: `Company "${trimmedName}" not found locally and LinkedIn account ID not configured`,
        };
      }

      // First, resolve the company name to a LinkedIn company ID using the parameter API
      // This ensures we're using LinkedIn's canonical company name and ID
      const paramsResult =
        await this.linkedInSearchService.getCompanyParameters(
          accountId,
          trimmedName,
          20,
        );

      const parameterItems = paramsResult?.items ?? [];

      if (parameterItems.length === 0) {
        this.logger.warn(
          `Could not resolve company name "${trimmedName}" to LinkedIn parameters`,
        );

        return {
          found: false,
          message: `Company "${trimmedName}" not found in LinkedIn parameters`,
        };
      }

      // Find the best matching company from parameter results
      let resolvedCompany: { id: string; title: string } | null = null;

      // Try exact match first
      const exactMatch = parameterItems.find(
        (item) => item.title?.toLowerCase() === trimmedName.toLowerCase(),
      );

      if (exactMatch?.id && exactMatch?.title) {
        resolvedCompany = { id: exactMatch.id, title: exactMatch.title };
      }

      // Try case-insensitive starts with match
      if (!resolvedCompany) {
        const startsWithMatch = parameterItems.find(
          (item) =>
            item.title?.toLowerCase().startsWith(trimmedName.toLowerCase()) ||
            trimmedName
              .toLowerCase()
              .startsWith(item.title?.toLowerCase() ?? ''),
        );

        if (startsWithMatch?.id && startsWithMatch?.title) {
          resolvedCompany = {
            id: startsWithMatch.id,
            title: startsWithMatch.title,
          };
        }
      }

      // Try contains match
      if (!resolvedCompany) {
        const containsMatch = parameterItems.find(
          (item) =>
            item.title?.toLowerCase().includes(trimmedName.toLowerCase()) ||
            trimmedName.toLowerCase().includes(item.title?.toLowerCase() ?? ''),
        );

        if (containsMatch?.id && containsMatch?.title) {
          resolvedCompany = {
            id: containsMatch.id,
            title: containsMatch.title,
          };
        }
      }

      // Use first match if no better match found
      if (
        !resolvedCompany &&
        parameterItems[0]?.id &&
        parameterItems[0]?.title
      ) {
        resolvedCompany = {
          id: parameterItems[0].id,
          title: parameterItems[0].title,
        };
      }

      if (!resolvedCompany) {
        this.logger.warn(
          `Could not find a valid company parameter for "${trimmedName}"`,
        );

        return {
          found: false,
          message: `Company "${trimmedName}" not found in LinkedIn parameters`,
        };
      }

      // Now search using the resolved company name from LinkedIn's parameter API
      // This ensures we're using LinkedIn's canonical company name instead of the raw string
      const searchResult = await this.linkedInSearchService.searchCompanies(
        {
          keywords: resolvedCompany.title,
        },
        accountId,
        { limit: 5 },
      );

      const companies = searchResult.items.filter(
        (item) => item.type === 'COMPANY',
      ) as Array<{
        id: string;
        name: string;
        profile_url: string;
      }>;

      if (companies.length > 0) {
        // Prefer the company that matches our resolved ID
        const idMatch = companies.find((c) => c.id === resolvedCompany!.id);

        if (idMatch?.id) {
          return {
            found: true,
            companyId: idMatch.id,
            companyName: idMatch.name ?? resolvedCompany.title,
            linkedinUrl: idMatch.profile_url,
            source: 'linkedin',
          };
        }

        // Try exact match with resolved name
        const nameExactMatch = companies.find(
          (c) => c.name?.toLowerCase() === resolvedCompany!.title.toLowerCase(),
        );

        if (nameExactMatch?.id) {
          return {
            found: true,
            companyId: nameExactMatch.id,
            companyName: nameExactMatch.name ?? resolvedCompany.title,
            linkedinUrl: nameExactMatch.profile_url,
            source: 'linkedin',
          };
        }

        // Return first match
        const firstMatch = companies[0];

        if (firstMatch?.id) {
          return {
            found: true,
            companyId: firstMatch.id,
            companyName: firstMatch.name ?? resolvedCompany.title,
            linkedinUrl: firstMatch.profile_url,
            source: 'linkedin',
          };
        }
      }
    } catch (error) {
      this.logger.warn(
        `Error searching LinkedIn for company "${trimmedName}":`,
        error,
      );
    }

    return {
      found: false,
      message: `Company "${trimmedName}" not found in local database or LinkedIn search`,
    };
  }
}
