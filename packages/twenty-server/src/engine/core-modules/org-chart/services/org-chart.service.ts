import { Injectable, Logger } from '@nestjs/common';

import { ArxenaBackendService } from './arxena-backend.service';
import { OrgChartEsService } from './org-chart-es.service';
import { PdlAutocompleteService } from './pdl-autocomplete.service';

@Injectable()
export class OrgChartService {
  private readonly logger = new Logger(OrgChartService.name);

  constructor(
    private readonly arxenaBackend: ArxenaBackendService,
    private readonly pdlAutocomplete: PdlAutocompleteService,
    private readonly orgChartEsService: OrgChartEsService,
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
}
