import { Injectable, Logger } from '@nestjs/common';

import type { SearchQuerySet } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import type {
  GeneratedSearchParameters
} from '../types/candidate-search-request.type';
import { mapLinkedinSearchQueriesToGeneratedParameters } from '../utils/linkedin-query-generation-mapper.util';

export type PythonQueryInput = {
  functions?: Array<{ name: string; exclude?: boolean }>;
  grades?: Array<{ name: string; exclude?: boolean }>;
  function_root?: Array<{ name: string; exclude?: boolean }>;
  company_names?: string[];
  raw_job_titles?: string[];
};

@Injectable()
export class PythonQueryGenerationService {
  private readonly logger = new Logger(PythonQueryGenerationService.name);

  private getBaseUrl(): string {
    const url =
      process.env.ARXENA_SITE_ORGCHART_URL ??
      process.env.ARXENA_SITE_URL ??
      'http://localhost:5050';
    return url.replace(/\/api\/orgchart\/build\/?$/, '').replace(/\/+$/, '');
  }

  async generateLinkedInQuery(
    input: PythonQueryInput,
  ): Promise<{ job_title: string | null; keywords: string | null; company: string[] | null }> {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/query-generator/linkedin`;

    this.logger.log(`Calling Python query generator at ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        functions: input.functions ?? [],
        grades: input.grades ?? [],
        function_root: input.function_root ?? [],
        company_names: input.company_names ?? [],
        raw_job_titles: input.raw_job_titles ?? [],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Python query generator returned ${response.status}: ${text}`,
      );
    }
    this.logger.log(`Python query generator returned ${response.status}`);

    const result = (await response.json()) as {
      job_title?: string | null;
      keywords?: string | null;
      company?: string[] | null;
    };

    this.logger.log(`Python query generator returned ${JSON.stringify(result, null, 2)}`);

    return {
      job_title: result.job_title ?? null,
      keywords: result.keywords ?? null,
      company: result.company ?? null,
    };
  }

  async generateSearchParameters(
    input: PythonQueryInput,
    searchType: 'classic' | 'sales_navigator' | 'recruiter',
    requirement?: string,
  ): Promise<GeneratedSearchParameters> {
    const pythonResult = await this.generateLinkedInQuery(input);

    const querySet: SearchQuerySet = {
      search_query_set: [
        {
          keywords: pythonResult.keywords,
          job_title: pythonResult.job_title,
          company: pythonResult.company,
          location: null,
          years_of_experience: null,
        },
      ],
    };

    return mapLinkedinSearchQueriesToGeneratedParameters(
      querySet,
      searchType,
      requirement,
    );
  }
}
