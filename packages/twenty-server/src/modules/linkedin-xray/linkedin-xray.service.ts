import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import OpenAI from 'openai';

import {
  LINKEDIN_XRAY_COUNTRIES,
  LINKEDIN_XRAY_COUNTRY_MAP,
  LINKEDIN_XRAY_EDUCATION_LEVELS,
  LINKEDIN_XRAY_EDUCATION_MAP,
} from 'src/modules/linkedin-xray/constants/linkedin-xray-options';
import { BuildLinkedinXrayDto } from 'src/modules/linkedin-xray/dtos/build-linkedin-xray.dto';
import { FetchLinkedinXrayPeopleResultsDto } from 'src/modules/linkedin-xray/dtos/fetch-linkedin-xray-people-results.dto';
import { LinkedinXrayPeopleResultsJobService } from 'src/modules/linkedin-xray/services/linkedin-xray-people-results-job.service';
import { LinkedinXrayPaginationMode } from 'src/modules/linkedin-xray/types/linkedin-xray-search-job.types';

type ParsedLlmFields = {
  country?: string;
  job_title?: string;
  include_keywords?: string;
  exclude_keywords?: string[] | string;
  education?: string;
  current_employer?: string;
};

@Injectable()
export class LinkedinXrayService {
  private readonly booleanOperatorSplit = /(\(|\)|\bAND\b|\bOR\b)/gi;

  constructor(
    private readonly linkedinXrayPeopleResultsJobService: LinkedinXrayPeopleResultsJobService,
  ) {}

  getOptions() {
    return {
      countries: LINKEDIN_XRAY_COUNTRIES,
      educationLevels: LINKEDIN_XRAY_EDUCATION_LEVELS,
    };
  }

  buildLinkedinXray(dto: BuildLinkedinXrayDto) {
    console.log("Building LinkedIn x-ray with dto:", dto)
    const country = this.normalizeCountry(dto.country);
    const education = this.normalizeEducation(dto.education);
    const excludeKeywords =
      dto.excludeKeywordsList ?? dto.excludeKeywords ?? '';
    const includeKeywords = dto.includeKeywords ?? dto.locationOrKeywords ?? '';

    return this.generateLinkedinXrayResponse({
      country,
      education,
      jobTitle: dto.jobTitle ?? '',
      includeKeywords,
      excludeKeywords,
      currentEmployer: dto.currentEmployer ?? '',
    });
  }

  async parseRawQuery(rawQuery: string) {
    const trimmedQuery = this.cleanValue(rawQuery);

    if (!trimmedQuery) {
      throw new BadRequestException('"rawQuery" is required');
    }

    const parsed = await this.parseRawLinkedinXrayQueryWithLlm(trimmedQuery);

    const country = this.normalizeCountry(parsed.country);
    const education = this.normalizeEducation(parsed.education);
    const jobTitle = this.cleanValue(parsed.job_title);
    const includeKeywords = this.cleanValue(parsed.include_keywords);
    const excludeKeywords = parsed.exclude_keywords ?? '';
    const currentEmployer = this.cleanValue(parsed.current_employer);

    return {
      rawQuery: trimmedQuery,
      parsedBuilderFields: {
        country,
        jobTitle,
        includeKeywords,
        excludeKeywords: this.splitExcludedTerms(excludeKeywords),
        education,
        currentEmployer,
      },
      llmOutput: parsed,
      ...this.generateLinkedinXrayResponse({
        country,
        education,
        jobTitle,
        includeKeywords,
        excludeKeywords,
        currentEmployer,
      }),
    };
  }

  async queuePeopleResultsFetch(
    dto: FetchLinkedinXrayPeopleResultsDto,
    input: {
      apiToken: string;
      origin: string;
      recruiterId: string;
    },
  ) {
    const parsed = await this.parseRawQuery(dto.rawQuery);
    const searchEngine = dto.searchEngine ?? 'google';
    const includePaginatedHtml = dto.includePaginatedHtml === true;
    const paginationMode: LinkedinXrayPaginationMode = includePaginatedHtml
      ? 'bright_data'
      : 'arxena';
    const searchJobId = crypto.randomUUID();
    const trimmedRawQuery = this.cleanValue(dto.rawQuery);
    const defaultJobName = trimmedRawQuery.slice(0, 120) || 'LinkedIn x-ray';

    await this.linkedinXrayPeopleResultsJobService.enqueue({
      searchJobId,
      recruiterId: input.recruiterId,
      apiToken: input.apiToken,
      origin: input.origin,
      rawQuery: parsed.rawQuery,
      jobId: this.cleanValue(dto.jobId) || searchJobId,
      jobName: this.cleanValue(dto.jobName) || defaultJobName,
      searchEngine,
      paginationMode,
      includePaginatedHtml,
      query: parsed.query,
      urls: parsed.urls,
    });

    return {
      status: 'queued' as const,
      searchJobId,
      recruiterId: input.recruiterId,
      searchEngine,
      paginationMode,
      includePaginatedHtml,
      rawQuery: parsed.rawQuery,
      query: parsed.query,
      urls: parsed.urls,
      progressStreamEndpoint: '/linkedin-xray-progress/stream',
    };
  }

  private generateLinkedinXrayResponse(input: {
    country: string;
    education: string;
    jobTitle: string;
    includeKeywords: string;
    excludeKeywords: string[] | string;
    currentEmployer: string;
  }) {
    console.log("Generating LinkedIn x-ray response with input:", input)
    const q = this.buildQString(input);
    const asOq = this.buildAsOq(input.education);

    return {
      network: 'LinkedIn',
      country: {
        value: input.country,
        label: LINKEDIN_XRAY_COUNTRY_MAP[input.country],
      },
      education: {
        value: input.education,
        label: LINKEDIN_XRAY_EDUCATION_MAP[input.education],
      },
      inputs: {
        jobTitle: input.jobTitle,
        includeKeywords: input.includeKeywords,
        excludeKeywords: input.excludeKeywords,
        currentEmployer: input.currentEmployer,
      },
      query: {
        q,
        asOq: asOq || null,
        siteClause: this.countryLinkedinSiteClause(input.country),
      },
      urls: {
        google: this.buildUrl('https://www.google.com/search', q, asOq),
        bing: this.buildUrl('https://www.bing.com/search', q, asOq),
      },
    };
  }

  private buildQString(input: {
    country: string;
    jobTitle: string;
    includeKeywords: string;
    excludeKeywords: string[] | string;
    currentEmployer: string;
  }) {
    const queryParts: string[] = [];

    const currentEmployerClause = this.quoteTerm(input.currentEmployer);
    if (currentEmployerClause) {
      queryParts.push(currentEmployerClause);
    }

    const jobTitleClause = this.quoteBooleanInput(input.jobTitle);
    if (jobTitleClause) {
      queryParts.push(jobTitleClause);
    }

    const includeClause = this.quoteBooleanInput(input.includeKeywords);
    if (includeClause) {
      queryParts.push(includeClause);
    }

    for (const term of this.splitExcludedTerms(input.excludeKeywords)) {
      queryParts.push(`-${this.quoteTerm(term)}`);
    }

    queryParts.push('-intitle:"profiles"');
    queryParts.push('-inurl:"dir/+"');
    queryParts.push(this.countryLinkedinSiteClause(input.country));

    return queryParts.filter(Boolean).join(' ').trim();
  }

  private buildAsOq(education: string) {
    const optionalTerms: string[] = [];

    if (education && education !== 'all') {
      optionalTerms.push(education.split('+').join(' '));
    }

    return optionalTerms.join(' ').trim();
  }

  private buildUrl(baseUrl: string, q: string, asOq: string) {
    const url = new URL(baseUrl);
    url.searchParams.set('q', q);

    if (asOq) {
      url.searchParams.set('as_oq', asOq);
    }

    return url.toString();
  }

  private cleanValue(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }

    return String(value).trim();
  }

  private quoteTerm(value: string) {
    const cleaned = this.cleanValue(value).split('"').join('');

    if (!cleaned) {
      return '';
    }

    return `"${cleaned}"`;
  }

  private quoteBooleanInput(value: string) {
    const raw = this.cleanValue(value);

    if (!raw) {
      return '';
    }

    const parts = raw.split(this.booleanOperatorSplit);
    const outputParts: string[] = [];

    for (const part of parts) {
      const token = this.cleanValue(part);

      if (!token) {
        continue;
      }

      const upper = token.toUpperCase();

      if (upper === 'AND' || upper === 'OR' || token === '(' || token === ')') {
        outputParts.push(upper === 'AND' || upper === 'OR' ? upper : token);
        continue;
      }

      outputParts.push(this.quoteTerm(token));
    }

    return outputParts.join(' ').trim();
  }

  private splitExcludedTerms(value: string[] | string) {
    const rawTerms = Array.isArray(value)
      ? value
      : this.cleanValue(value)
          ? this.cleanValue(value).split(',')
          : [];

    return rawTerms
      .map((item) => this.cleanValue(item))
      .map((item) => (item.startsWith('-') ? item.slice(1).trim() : item))
      .map((item) => item.split('"').join(''))
      .filter(Boolean);
  }

  private countryLinkedinSiteClause(countryCode: string) {
    const normalized = this.cleanValue(countryCode).toLowerCase() || 'all';
    const subdomain = normalized === 'all' ? '' : `${normalized}.`;

    return `site:${subdomain}linkedin.com/in/ OR site:${subdomain}linkedin.com/pub/`;
  }

  private normalizeCountry(value?: string) {
    const raw = this.cleanValue(value).toLowerCase();

    if (!raw) {
      return 'all';
    }

    if (raw in LINKEDIN_XRAY_COUNTRY_MAP) {
      return raw;
    }

    const matched = LINKEDIN_XRAY_COUNTRIES.find(
      (country) => country.label.toLowerCase() === raw,
    );

    return matched?.value ?? 'all';
  }

  private normalizeEducation(value?: string) {
    const raw = this.cleanValue(value);

    if (!raw) {
      return 'all';
    }

    if (raw in LINKEDIN_XRAY_EDUCATION_MAP) {
      return raw;
    }

    const lowered = raw.toLowerCase();
    const matched = LINKEDIN_XRAY_EDUCATION_LEVELS.find(
      (education) => education.label.toLowerCase() === lowered,
    );

    if (matched) {
      return matched.value;
    }

    const normalized = lowered.replace('degree', '').trim();

    if (
      normalized.includes('doctor') ||
      normalized.includes('phd') ||
      normalized.includes('ph.d')
    ) {
      return LINKEDIN_XRAY_EDUCATION_LEVELS[3].value;
    }

    if (normalized.includes('master') || normalized.includes('mba')) {
      return LINKEDIN_XRAY_EDUCATION_LEVELS[2].value;
    }

    if (normalized.includes('bachelor') || normalized === 'degree') {
      return LINKEDIN_XRAY_EDUCATION_LEVELS[1].value;
    }

    return 'all';
  }

  private async parseRawLinkedinXrayQueryWithLlm(
    rawQuery: string,
  ): Promise<ParsedLlmFields> {
    const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY;

    if (!apiKey) {
      throw new InternalServerErrorException(
        'Missing OPENAI_API_KEY or OPENAI_KEY',
      );
    }

    const countryOptions = LINKEDIN_XRAY_COUNTRIES.map(
      (country) => `${country.value}=${country.label}`,
    ).join(', ');
    const educationOptions = LINKEDIN_XRAY_EDUCATION_LEVELS.map(
      (education) => `${education.value}=${education.label}`,
    ).join(', ');

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.ARX_LINKEDIN_XRAY_PARSE_MODEL ?? 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Extract RecruitEm-style LinkedIn x-ray search fields from a recruiter query. ' +
            'Return only valid JSON with keys: country, job_title, include_keywords, exclude_keywords, education, current_employer. ' +
            `Choose country only from these values: ${countryOptions}. ` +
            `Choose education only from these values: ${educationOptions}. ` +
            'If a field is not specified, use "" except use "all" for country and education. ' +
            'job_title should contain the target role only. ' +
            'include_keywords should contain locations or positive refiners. ' +
            'exclude_keywords should be an array of strings. ' +
            'current_employer should contain the current company to source from. ' +
            'Do not invent extra requirements.',
        },
        {
          role: 'user',
          content: rawQuery,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new InternalServerErrorException('LLM returned empty content');
    }

    try {
      const parsed = JSON.parse(content) as ParsedLlmFields;

      if (!parsed || Array.isArray(parsed)) {
        throw new Error('Expected a JSON object');
      }

      return parsed;
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to parse LLM output: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }
}
