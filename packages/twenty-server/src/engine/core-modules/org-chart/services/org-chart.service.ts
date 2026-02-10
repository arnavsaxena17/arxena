import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import * as path from 'path';

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

    // Fallback: proxy to legacy arxena-site /query endpoint.
    this.logger.warn(
      `Org chart not found in ES for companyId=${companyId}; falling back to legacy arxena-site /query`,
    );
    return this.arxenaBackend.getOrgChart(companyId, authToken);
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

    const query = this.arxenaBackend.buildContactInfoQuery([trimmedUrl]);
    const params = this.arxenaBackend.buildContactInfoParams({
      hotEmailAddresses: true,
      hotPhoneNumbers: true,
    });

    const body = {
      query,
      params,
    };

    const rawResult = (await this.arxenaBackend.postQuery(body, authToken)) as {
      results?: {
        data?: {
          modified_query_results?: {
            phone_numbers?: unknown;
            email_address?: unknown;
          };
        };
      };
    };

    const modified =
      rawResult?.results?.data?.modified_query_results ??
      ({} as {
        phone_numbers?: unknown;
        email_address?: unknown;
      });

    const phoneObjs = Array.isArray(modified.phone_numbers)
      ? (modified.phone_numbers as Array<Record<string, unknown>>)
      : [];

    const emailObjs = Array.isArray(modified.email_address)
      ? (modified.email_address as Array<Record<string, unknown>>)
      : [];

    const phoneNumbers = Array.from(
      new Set(
        phoneObjs.flatMap((item) => {
          const nums = item.phone_numbers;
          if (Array.isArray(nums)) {
            return nums.filter(
              (n): n is string =>
                typeof n === 'string' && n.trim().length > 0,
            );
          }
          if (typeof nums === 'string' && nums.trim().length > 0) {
            return [nums];
          }
          return [];
        }),
      ),
    );

    const emailAddresses = Array.from(
      new Set(
        emailObjs
          .map((item) => item.email_address)
          .filter(
            (e): e is string => typeof e === 'string' && e.trim().length > 0,
          ),
      ),
    );

    return { emailAddresses, phoneNumbers };
  }
}
