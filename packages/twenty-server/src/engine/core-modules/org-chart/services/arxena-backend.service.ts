import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type ClientQuery = {
  company_id: unknown[];
  [key: string]: unknown;
};

type ClientParams = {
  current_focus: string;
  data_source: string;
  data_coverage: string;
  contact_info: string;
  hot_phone_numbers?: boolean;
  hot_email_addresses?: boolean;
  [key: string]: unknown;
};

export type CompanyAutocompleteItem = {
  name: string;
  meta: {
    id: string;
    website?: string;
    industry?: string;
    location_name?: string;
  };
  count: number;
};

@Injectable()
export class ArxenaBackendService {
  private readonly logger = new Logger(ArxenaBackendService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  private getArxenaBaseUrl(): string {
    return (
      this.environmentService.get('ARXENA_SITE_URL') || 'http://localhost:5050'
    );
  }

  /**
   * Canonical blank query object mirrored from
   * arxena-site `arxenas3/model_arxena/tree_to_choose.py`.
   * Keeping this in sync with the Python side avoids KeyError
   * crashes in `Actions.refactor_client_query_obj_from_request_form`
   * and `Actions.get_response_type`.
   */
  private createBlankQuery(): ClientQuery {
    return {
      company_name: [],
      industry_category: [],
      reverse_company: [],
      gpt3_company_search: [],
      company_linkedin_url: [],
      country: [],
      website: [],
      industry: [],
      functions: [],
      grades: [],
      employee_count: [],
      revenue: [],
      company_sizes: [],
      locations: [],
      region: [],
      company_type: [],
      founded: [],
      description: [],
      tags: [],
      naics: [],
      person_name: [],
      reverse_job_title: [],
      function_root: [],
      school: [],
      locality: [],
      person_linkedin_url: [],
      email_address: [],
      phone_number: [],
      inferred_salary: [],
      genders: [],
      education_degrees: [],
      education_majors: [],
      person_id: [],
      company_id: [],
      active_experience: true,
      checkbox_has_email: false,
      checkbox_has_phone: false,
    } as ClientQuery;
  }

  /**
   * Canonical blank params object mirrored from
   * arxena-site `arxenas3/model_arxena/tree_to_choose.py`, with a few
   * fields overridden by callers (current_focus, data_source, etc.).
   */
  private createBlankParams(): ClientParams {
    return {
      selected_blocks: '[]',
      selected_nodes: '[]',
      raw_string_query_input: '',
      selected_context_menu: '',
      logon: 'false',
      current_focus: '',
      consume_credits: 'false',
      data_source: '',
      data_coverage: '',
      boolean_keywords_string: '',
      contact_info: 'false',
      locations_dropdown1: '',
      locations_dropdown2: '',
      locations_dropdown3: '',
      company_analytics: '',
      visitor_fp: '',
      testing: false,
      cost_credits: false,
      count_query: false,
      locations_dropdown: false,
      locations_dropdown_number: '0',
      count_cost_credits: '',
      count_db_results: '',
      fetch_people_data_count: 0,
      fetch_companies_data_count: 0,
      fetch_nodes_data_count: 0,
    } as ClientParams;
  }

  buildContactInfoQuery(personLinkedinUrls: string[]): Record<string, unknown> {
    const query = this.createBlankQuery();
    (query.person_linkedin_url as unknown[]) = personLinkedinUrls
      .filter((url) => typeof url === 'string' && url.trim().length > 0)
      .map((url) => ({ name: url.trim() }));
    return query as Record<string, unknown>;
  }

  buildContactInfoParams(options?: {
    hotPhoneNumbers?: boolean;
    hotEmailAddresses?: boolean;
  }): Record<string, unknown> {
    const params = this.createBlankParams();
    params.current_focus = 'orgcharts';
    params.data_source = 'arxena';
    params.data_coverage = 'include_phone_and_email';
    params.contact_info = 'true';
    params.hot_phone_numbers = !!options?.hotPhoneNumbers;
    params.hot_email_addresses = !!options?.hotEmailAddresses;
    return params as Record<string, unknown>;
  }

  async getCompanyAutocomplete(
    inputText: string,
    authToken?: string,
  ): Promise<CompanyAutocompleteItem[]> {
    const baseUrl = this.getArxenaBaseUrl();
    const url = `${baseUrl}/filters`;

    const blankQuery = JSON.stringify(this.createBlankQuery());

    const paramsObj = this.createBlankParams();
    // For autocomplete we scope to orgcharts on the Arxena side.
    paramsObj.current_focus = 'orgcharts';
    paramsObj.data_source = 'arxena';
    paramsObj.data_coverage = 'only_profiles';

    const blankParams = JSON.stringify(paramsObj);

    const formData = new URLSearchParams();
    formData.append('input_text', inputText);
    formData.append('element_focussed', 'company_name');
    formData.append('autocomplete', 'true');
    formData.append('query', blankQuery);
    formData.append('params', blankParams);

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (authToken) {
      headers['Cookie'] = `auth_token=${authToken}`;
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData.toString(),
      });

      if (!response.ok) {
        this.logger.warn(
          `Arxena filters returned ${response.status} for company autocomplete`,
        );
        return [];
      }

      const data = (await response.json()) as {
        status?: string;
        result?: CompanyAutocompleteItem[];
      };

      if (data?.status === 'ok' && Array.isArray(data.result)) {
        return data.result;
      }

      return [];
    } catch (error) {
      this.logger.error(
        'Failed to fetch company autocomplete from arxena',
        error,
      );
      return [];
    }
  }

  async getOrgChart(
    companyId: string,
    authToken?: string,
  ): Promise<Record<string, unknown>> {
    const baseUrl = this.getArxenaBaseUrl();
    const url = `${baseUrl}/query`;

    const query = this.createBlankQuery();
    // Drive orgchart by company identifier (typically a linkedin_slug).
    (query.company_id as unknown[]) = [{ name: companyId, exclude: false }];

    const params = this.createBlankParams();
    params.current_focus = 'orgcharts';
    params.data_source = 'arxena';
    params.data_coverage = 'only_profiles';

    const formData = new URLSearchParams();
    formData.append('query', JSON.stringify(query));
    formData.append('params', JSON.stringify(params));

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (authToken) {
      headers['Cookie'] = `auth_token=${authToken}`;
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData.toString(),
      });

      if (!response.ok) {
        this.logger.warn(
          `Arxena query returned ${response.status} for org chart ${companyId}`,
        );
        throw new Error(`Failed to fetch org chart: ${response.status}`);
      }

      const data = (await response.json()) as { status?: string; result?: unknown };
      if (data?.status === 'ok' && data.result) {
        return data.result as Record<string, unknown>;
      }

      throw new Error('Invalid response from org chart query');
    } catch (error) {
      this.logger.error(
        `Failed to fetch org chart for company ${companyId}`,
        error,
      );
      throw error;
    }
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
    const baseUrl = this.getArxenaBaseUrl();
    const url = `${baseUrl}/query`;

    const formData = new URLSearchParams();
    formData.append('query', JSON.stringify(body.query));
    formData.append('params', JSON.stringify(body.params));
    if (body.selected_context_menu) {
      formData.append('selected_context_menu', body.selected_context_menu);
    }
    if (body.selected_nodes) {
      formData.append('selected_nodes', JSON.stringify(body.selected_nodes));
    }
    if (body.selected_blocks) {
      formData.append('selected_blocks', body.selected_blocks);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (authToken) {
      headers['Cookie'] = `auth_token=${authToken}`;
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData.toString(),
      });

      if (!response.ok) {
        this.logger.warn(`Arxena query returned ${response.status}`);
        throw new Error(`Query failed: ${response.status}`);
      }

      const data = (await response.json()) as { status?: string; result?: unknown };
      if (data?.status === 'ok') {
        return data.result;
      }

      throw new Error('Invalid response from query');
    } catch (error) {
      this.logger.error('Failed to post query to arxena', error);
      throw error;
    }
  }
}
