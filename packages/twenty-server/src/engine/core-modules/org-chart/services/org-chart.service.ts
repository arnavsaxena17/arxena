import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

import { ContactEnrichmentWaterfallService } from 'src/engine/core-modules/contact-enrichment/services/contact-enrichment-waterfall.service';

import { ArxenaBackendService } from './arxena-backend.service';
import { OrgChartEsService } from './org-chart-es.service';
import { PdlAutocompleteService } from './pdl-autocomplete.service';
import { PeopleEsService } from './people-es.service';

@Injectable()
export class OrgChartService {
  private readonly logger = new Logger(OrgChartService.name);

  constructor(
    private readonly arxenaBackend: ArxenaBackendService,
    private readonly pdlAutocomplete: PdlAutocompleteService,
    private readonly orgChartEsService: OrgChartEsService,
    private readonly peopleEsService: PeopleEsService,
    private readonly contactEnrichmentWaterfall: ContactEnrichmentWaterfallService,
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly orgChartCacheStorageService: CacheStorageService,
  ) {}

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
    if (this.pdlAutocomplete.isConfigured()) {
      return this.pdlAutocomplete.getCompanyAutocomplete(inputText);
    }
    return this.arxenaBackend.getCompanyAutocomplete(inputText, authToken);
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
        },
    authTokenOptional?: string,
  ): Promise<Record<string, unknown>> {
    let options: {
      companyName?: string;
      website?: string;
      country?: string;
      functionRoot?: string;
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

    // Prefer fetching org charts directly from Elasticsearch when configured.
    const esResult = await this.orgChartEsService.getOrgChartByCompanyId(
      companyId,
      options,
    );

    if (esResult) {
      this.logger.log(
        `Serving org chart for companyId=${companyId} from Elasticsearch`,
      );
      return esResult;
    }

    const cacheKey = this.buildCompanyOrgChartCacheKey(
      options.companyName,
      companyId,
    );
    const cachedOrgChartPayload =
      await this.orgChartCacheStorageService.get<{
        orgChart?: Record<string, unknown>;
        cachedAt?: string;
        itemCount?: number;
      }>(cacheKey);

    if (cachedOrgChartPayload?.orgChart) {
      this.logger.log(
        `Serving org chart for companyId=${companyId} from Redis cache key=${cacheKey} cachedAt=${cachedOrgChartPayload.cachedAt ?? 'unknown'} itemCount=${cachedOrgChartPayload.itemCount ?? 0}`,
      );
      return cachedOrgChartPayload.orgChart;
    }

    // No ES document and we do NOT auto-fallback to legacy arxena-site anymore.
    // For new companies, org charts are built via the LinkedIn+Python pipeline
    // (e.g. via the "entire_company" orgchart flow). Here we simply return an
    // empty placeholder object so the frontend can show "No org chart data"
    // without triggering failing legacy calls.
    this.logger.warn(
      `Org chart not found in ES for companyId=${companyId}; skipping legacy arxena-site fallback and returning empty org chart placeholder`,
    );

    return {
      company_id: companyId,
      orgchart: JSON.stringify([]),
      country: options.country ?? 'global',
      type: options.functionRoot ?? 'fullcompany',
    } as Record<string, unknown>;
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

    return ['company-orgchart', normalizedCompanyId, 'entire_company', 'classic'].join(':');
  }

  private normalizeCompanyId(companyId?: string, fallbackName?: string): string {
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
  async getManualOrgChart(
    companyId: string,
  ): Promise<Record<string, unknown>> {
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
        let arxenaSiteRoot: string;

        if (
          path.basename(cwd) === 'packages' ||
          path.basename(path.dirname(cwd)) === 'packages'
        ) {
          // e.g. /.../arx/arxena/packages or /.../arx/arxena/packages/twenty-server
          arxenaSiteRoot = path.resolve(cwd, '..', '..', 'arxena-site');
        } else {
          // e.g. /.../arx/arxena
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

        return parsed;
      } catch (error) {
        this.logger.error(
          `Failed to read manual org chart JSON for companyId=${companyId}; falling back to legacy backend`,
          error,
        );
      }
    }

    // Fallback for non-Yuga companies or if the static file cannot be read.
    return this.getOrgChart(companyId);
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

    // Use the new contact enrichment waterfall service (all in NestJS, no arxena-site)
    try {
      const result = await this.contactEnrichmentWaterfall.fetchContacts(
        trimmedUrl,
        { wantEmail: true, wantPhone: true },
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
}
