import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

export type CompanyAutocompleteItem = {
  name: string;
  meta: {
    id: string;
    linkedin_slug?: string;
    website?: string;
    industry?: string;
    location_name?: string;
  };
  count: number;
};

type PdlAutocompleteResponse = {
  data?: Array<{
    name?: string;
    id?: string;
    linkedin_id?: string;
    website?: string;
    linkedin_slug?: string;
    count?: number;
    meta?: {
      id?: string;
      linkedin_slug?: string;
      website?: string;
      industry?: string;
      location_name?: string;
    };
  }>;
};

@Injectable()
export class PdlAutocompleteService {
  private readonly logger = new Logger(PdlAutocompleteService.name);
  private readonly pdlAutocompleteUrl =
    'https://api.peopledatalabs.com/v5/autocomplete';

  constructor(private readonly environmentService: EnvironmentService) {}

  isConfigured(): boolean {
    const key = this.environmentService.get('PDL_API_KEY');
    return typeof key === 'string' && key.length > 0;
  }

  private getApiKey(): string | undefined {
    const key = this.environmentService.get('PDL_API_KEY');
    return typeof key === 'string' && key.length > 0 ? key : undefined;
  }

  async getCompanyAutocomplete(
    inputText: string,
  ): Promise<CompanyAutocompleteItem[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.logger.warn(
        'PDL_API_KEY not configured, company autocomplete disabled',
      );
      return [];
    }

    if (!inputText?.trim()) {
      return [];
    }

    const params = new URLSearchParams({
      field: 'company',
      text: inputText.trim(),
      size: '10',
    });

    try {
      const url = `${this.pdlAutocompleteUrl}?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
          Accept: 'application/json',
        },
      });


      if (!response.ok) {
        this.logger.warn(
          `PDL autocomplete returned ${response.status} for company search`,
        );
        return [];
      }
      const responseJson = await response.json()
      console.log('pdl getCompanyAutocomplete responseJson', JSON.stringify(responseJson, null, 2));
      const json = (responseJson) as PdlAutocompleteResponse;
      const data = json?.data ?? [];
      return data
        .filter((item) => (item?.count ?? 0) >= 5)
        .map((item) => {
          const meta = item?.meta;
          const linkedinSlug =
            meta?.linkedin_slug ??
            item?.linkedin_slug ??
            undefined;
          return {
            name: item?.name ?? '',
            meta: {
              // IMPORTANT: `id` here is used as the company identifier in
              // downstream systems (arxena-site / ES), where it actually
              // corresponds to the PDL `linkedin_slug`. Prefer that when
              // available to keep semantics consistent.
              id:
                linkedinSlug ??
                meta?.id ??
                item?.id ??
                item?.linkedin_id ??
                item?.name ??
                '',
              linkedin_slug: linkedinSlug,
              website: meta?.website ?? item?.website,
              industry: meta?.industry,
              location_name: meta?.location_name,
            },
            count: item?.count ?? 0,
          };
        });
    } catch (error) {
      this.logger.error('PDL company autocomplete failed', error);
      return [];
    }
  }
}
