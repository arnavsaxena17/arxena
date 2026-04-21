import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

const APOLLO_API_BASE = 'https://api.apollo.io/api/v1';

/** Apollo People API Search (POST /mixed_people/api_search) — non-credit; master API key. */
export type ApolloPeopleSearchParams = {
  q_keywords?: string;
  person_titles?: string[];
  include_similar_titles?: boolean;
  person_locations?: string[];
  organization_locations?: string[];
  organization_ids?: string[];
  page?: number;
  per_page?: number;
};

/** Apollo Organization Search (POST /mixed_companies/search) — consumes credits. */
export type ApolloOrganizationSearchParams = {
  q_organization_name?: string;
  q_organization_domains_list?: string[];
  organization_locations?: string[];
  page?: number;
  per_page?: number;
};

/** Serialize bracket-array query params for Apollo REST. */
function appendApolloParams(
  params: URLSearchParams,
  key: string,
  values: string[] | undefined,
) {
  if (!values?.length) return;
  for (const v of values) {
    if (v.trim()) {
      params.append(`${key}[]`, v.trim());
    }
  }
}

@Injectable()
export class ApolloIoRestService {
  private readonly logger = new Logger(ApolloIoRestService.name);
  private readonly client: AxiosInstance;

  constructor(private readonly environmentService: EnvironmentService) {
    this.client = axios.create({
      baseURL: APOLLO_API_BASE,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      timeout: 120_000,
    });
  }

  private getApiKey(): string | null {
    const key = this.environmentService.get('APOLLO_API_KEY' as never) as
      | string
      | undefined;
    return key?.trim() ? key.trim() : null;
  }

  isConfigured(): boolean {
    return this.getApiKey() !== null;
  }

  private assertConfigured(): string {
    const key = this.getApiKey();
    if (!key) {
      throw new HttpException(
        'Apollo API is not configured (APOLLO_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return key;
  }

  /**
   * People API Search POST /mixed_people/api_search
   * @see https://docs.apollo.io/reference/people-api-search.md
   */
  async peopleSearch(
    input: ApolloPeopleSearchParams,
  ): Promise<Record<string, unknown>> {
    const apiKey = this.assertConfigured();
    const params = new URLSearchParams();
    if (input.q_keywords?.trim()) {
      params.set('q_keywords', input.q_keywords.trim());
    }
    appendApolloParams(params, 'person_titles', input.person_titles);
    if (input.include_similar_titles === false) {
      params.set('include_similar_titles', 'false');
    }
    appendApolloParams(params, 'person_locations', input.person_locations);
    appendApolloParams(
      params,
      'organization_locations',
      input.organization_locations,
    );
    appendApolloParams(params, 'organization_ids', input.organization_ids);
    const page = input.page ?? 1;
    const perPage = input.per_page ?? 25;
    params.set('page', String(page));
    params.set('per_page', String(perPage));

    const url = `/mixed_people/api_search?${params.toString()}`;
    this.logger.log(`Apollo peopleSearch ${url.slice(0, 200)}...`);

    const { data } = await this.client.post<Record<string, unknown>>(
      url,
      {},
      {
        headers: { 'x-api-key': apiKey },
      },
    );
    return data;
  }

  /**
   * Organization Search POST /mixed_companies/search (consumes credits)
   * @see https://docs.apollo.io/reference/organization-search.md
   */
  async organizationsSearch(
    input: ApolloOrganizationSearchParams,
  ): Promise<Record<string, unknown>> {
    const apiKey = this.assertConfigured();
    const params = new URLSearchParams();
    if (input.q_organization_name?.trim()) {
      params.set('q_organization_name', input.q_organization_name.trim());
    }
    appendApolloParams(
      params,
      'q_organization_domains_list',
      input.q_organization_domains_list,
    );
    appendApolloParams(
      params,
      'organization_locations',
      input.organization_locations,
    );
    const page = input.page ?? 1;
    const perPage = input.per_page ?? 10;
    params.set('page', String(page));
    params.set('per_page', String(perPage));

    const url = `/mixed_companies/search?${params.toString()}`;
    this.logger.log(`Apollo organizationsSearch ${url.slice(0, 200)}...`);

    const { data } = await this.client.post<Record<string, unknown>>(
      url,
      {},
      {
        headers: { 'x-api-key': apiKey },
      },
    );
    return data;
  }

  /**
   * Job postings GET /organizations/{organization_id}/job_postings (consumes credits)
   * @see https://docs.apollo.io/reference/organization-jobs-postings.md
   */
  async organizationJobPostings(
    organizationId: string,
    page?: number,
    perPage?: number,
  ): Promise<Record<string, unknown>> {
    const apiKey = this.assertConfigured();
    const id = organizationId.trim();
    if (!id) {
      throw new HttpException(
        'organizationId is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const params = new URLSearchParams();
    params.set('page', String(page ?? 1));
    params.set('per_page', String(perPage ?? 25));

    const url = `/organizations/${encodeURIComponent(id)}/job_postings?${params.toString()}`;
    this.logger.log(`Apollo organizationJobPostings org=${id}`);

    const { data } = await this.client.get<Record<string, unknown>>(url, {
      headers: { 'x-api-key': apiKey },
    });
    return data;
  }
}
