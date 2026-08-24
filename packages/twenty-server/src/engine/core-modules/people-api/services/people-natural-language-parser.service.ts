import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

import { normalizeLlmNullishString } from 'src/engine/core-modules/candidate-search/schemas/org-chart.schema';
import { toOpenAiJsonSchemaResponseFormat } from 'src/engine/core-modules/llm-chat-model/utils/to-openai-json-schema-format.util';

import {
  buildPeopleNaturalLanguageParseUserPrompt,
  PEOPLE_NATURAL_LANGUAGE_PARSE_SYSTEM_PROMPT,
} from '../prompts/people-natural-language-parse.prompt';
import {
  PeopleNaturalLanguageParseSchema,
  type PeopleNaturalLanguageParse,
} from '../schemas/people-natural-language-parse.schema';
import { collectPeopleSearchLocations } from '../utils/collect-people-search-locations.util';

export const PEOPLE_SEARCH_COMPANY_REQUIRED_MESSAGE =
  'Please provide company name as well';

export type ParsedNaturalLanguagePeopleSearch = {
  jobTitle: string;
  companyName?: string;
  website?: string;
  locations: string[];
};

const toOptionalString = (
  value: string | null | undefined,
): string | undefined => {
  const normalized = normalizeLlmNullishString(value);
  return normalized ?? undefined;
};

const toOptionalWebsite = (
  value: string | null | undefined,
): string | undefined => {
  const website = toOptionalString(value)?.replace(/\/$/, '');
  return website || undefined;
};

@Injectable()
export class PeopleNaturalLanguageParserService {
  private readonly logger = new Logger(PeopleNaturalLanguageParserService.name);
  private readonly openai: OpenAI;
  private readonly modelName =
    process.env.SEARCH_MODELS_OPENAI_MODEL || 'gpt-4o-mini';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_KEY,
    });
  }

  async parse(
    naturalLanguage: string,
  ): Promise<ParsedNaturalLanguagePeopleSearch> {
    const trimmed = naturalLanguage.trim();
    if (!trimmed) {
      throw new HttpException(
        'naturalLanguage is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!process.env.OPENAI_KEY) {
      throw new HttpException(
        'Natural language parser is unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const parsed = await this.runPrompt(trimmed);
    const jobTitle = toOptionalString(parsed.jobTitle);

    if (!jobTitle) {
      throw new HttpException(
        'naturalLanguage is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const companyName = toOptionalString(parsed.companyName);
    const website = toOptionalWebsite(parsed.website);
    const locations = collectPeopleSearchLocations({
      locations: parsed.locations,
    });

    return {
      jobTitle,
      locations,
      ...(companyName ? { companyName } : {}),
      ...(website ? { website } : {}),
    };
  }

  private async runPrompt(
    naturalLanguage: string,
  ): Promise<PeopleNaturalLanguageParse> {
    const completion = await this.openai.chat.completions.create({
      model: this.modelName,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: PEOPLE_NATURAL_LANGUAGE_PARSE_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildPeopleNaturalLanguageParseUserPrompt(naturalLanguage),
        },
      ],
      response_format: toOpenAiJsonSchemaResponseFormat(
        PeopleNaturalLanguageParseSchema,
        'peopleNaturalLanguageParse',
      ),
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      this.logger.error('Empty natural-language people-search parse response');
      throw new HttpException(
        'Natural language parser returned an empty response',
        HttpStatus.BAD_GATEWAY,
      );
    }

    try {
      return PeopleNaturalLanguageParseSchema.parse(JSON.parse(raw));
    } catch (error) {
      this.logger.error(
        `Invalid natural-language people-search parse: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new HttpException(
        'Natural language parser returned an invalid response',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
