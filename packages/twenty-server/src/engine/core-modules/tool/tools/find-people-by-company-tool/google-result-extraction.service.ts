import { Injectable, Logger, Optional } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';

import { type GoogleSerpOrganicItem } from 'src/engine/core-modules/org-chart/utils/map-google-serp-organic.util';
import {
  isLinkedinProfileUrl,
  linkedinProfileUrlFromPostUrl,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/parse-linkedin-serp-result.util';
import { personNamesMatch } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/person-name-matching.util';
import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import {
  AiSdkExecutionService,
  runGenerateObject,
} from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const EXTRACTION_TIMEOUT_MS = 45_000;
const EXTRACTION_MAX_OUTPUT_TOKENS = 4_000;
const MAX_SNIPPET_LENGTH = 300;
const MAX_PEOPLE = 25;

export type ExtractedPerson = {
  name: string;
  // What the results say they do; empty when they do not say
  jobTitle: string;
  // The employer the results state for that role; empty when none is stated
  companyName: string;
  location: string;
  // False for former employees ("ex-", "formerly", a past role)
  isCurrentRole: boolean;
  // Text from the results that supports the entry
  evidence: string;
  // Set only when a result is that person's LinkedIn profile, or a post by them
  linkedinUrl: string;
  // True when the URL was recovered from a post's author rather than seen as a
  // profile, so a caller can tell it apart
  linkedinUrlDerivedFromPost: boolean;
  // The result the person was read from
  sourceUrl: string;
};

// Strict structured-output providers need every key present, so nothing is
// optional: unknown text is an empty string
const extractionSchema = z.object({
  people: z.array(
    z.object({
      name: z.string(),
      jobTitle: z.string(),
      companyName: z.string(),
      location: z.string(),
      isCurrentRole: z.boolean(),
      resultIndex: z.number().int(),
      evidence: z.string(),
    }),
  ),
});

const SYSTEM_PROMPT = `You turn Google search results into structured records of the people they mention.
Each result is numbered and has a title, a URL, a snippet and sometimes "details" (fields the search engine itself lifted out, such as location, role and company). Return one record per distinct person.

An "AI Overview" block may follow the results. It is Google's own summary and it sometimes names the role holder that the top organic results do not. Use it only for people it names explicitly.

Fields:
- name: the person's full name as written, without emoji, credentials or honorifics.
- jobTitle: the role the results state for them. LinkedIn result titles read "Name - Job title - Company | LinkedIn", "Name - Job title at Company" or "Name - Company": in the last form the text after the dash is the company, not a job title. Empty string when no role is stated. Never infer a role.
- companyName: the employer the results state for that role. Empty string when none is stated.
- location: city or region if stated, else an empty string.
- isCurrentRole: false when the results say former, ex-, formerly or describe a past role; true otherwise.
- resultIndex: the number of the result that is this person's own LinkedIn profile (URL contains linkedin.com/in/) when one is among the results; otherwise the number of the result that names them; 0 when only the AI Overview names them.
- evidence: the words from the results that state the name together with the role and company.

Rules:
- Include people at any company; a later step decides which company matters.
- Skip results that name no person (company pages, directories, listings, news about deals).
- A person named only in the AI Overview is kept: set resultIndex to 0 and copy the overview sentence into evidence. A summary that describes functions without naming a person is not a person.
- Copy text exactly as written. Never invent a name, a role or a company.
- At most ${MAX_PEOPLE} records.`;

const textOf = (result: GoogleSerpOrganicItem): string =>
  `${result.title} ${result.snippet ?? ''}`.toLowerCase().replace(/\s+/g, ' ');

@Injectable()
export class GoogleResultExtractionService {
  private readonly logger = new Logger(GoogleResultExtractionService.name);

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly aiSdkExecutionService?: AiSdkExecutionService,
  ) {}

  // Reads the raw Google results with a model instead of patterns, so a name,
  // a role and a company are separated whatever shape the result title has
  async extract({
    workspaceId,
    company,
    roles,
    results,
    aiOverview,
  }: {
    workspaceId: string;
    company: string;
    roles: string[];
    results: GoogleSerpOrganicItem[];
    aiOverview?: string;
  }): Promise<ExtractedPerson[]> {
    const overview = aiOverview?.trim() ?? '';

    if (results.length === 0 && overview === '') {
      return [];
    }

    if (!isDefined(this.aiModelRegistryService)) {
      throw new Error('No AI model registry is available');
    }

    const modelId = this.aiModelRegistryService.getDefaultSpeedModel().modelId;
    const { model } =
      await this.aiModelRegistryService.resolveModelForAgentInWorkspace(
        { modelId },
        workspaceId,
      );
    const response = await runGenerateObject(this.aiSdkExecutionService, {
      workspaceId,
      modelId,
      options: {
        model,
        schema: extractionSchema,
        system: SYSTEM_PROMPT,
        prompt: [
          `Searching for: ${roles.join(' / ')} at ${company}`,
          'Results:',
          ...results.map(
            (result, index) =>
              `${index + 1}. ${result.title}\n   ${result.url}\n   ${(result.snippet ?? '').slice(0, MAX_SNIPPET_LENGTH)}${
                (result.extensions ?? []).length > 0
                  ? `\n   details: ${(result.extensions ?? []).join(' | ')}`
                  : ''
              }`,
          ),
          ...(isNonEmptyString(overview)
            ? [
                '',
                // The summary can name the role holder the organic results miss
                `AI Overview (Google's summary${results.length === 0 ? '' : '; names here may not be in the results'}):`,
                overview,
              ]
            : []),
        ].join('\n'),
        maxOutputTokens: EXTRACTION_MAX_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS),
        providerOptions: { openrouter: { reasoning: { enabled: false } } },
        experimental_telemetry: AI_TELEMETRY_CONFIG,
      },
    });
    const people = this.toPeople(
      extractionSchema.parse(response.object).people,
      results,
      overview,
    );

    this.logger.log(
      `Extracted ${people.length} people from ${results.length} Google results for "${company}", ${people.filter((person) => person.linkedinUrl !== '').length} with a LinkedIn profile${overview !== '' ? ', AI Overview read' : ''}`,
    );

    return people;
  }

  // The model says which result each person came from; the URL is read from
  // that result, never from the model's own text, and a name the results do not
  // contain is dropped
  private toPeople(
    records: z.infer<typeof extractionSchema>['people'],
    results: GoogleSerpOrganicItem[],
    aiOverview = '',
  ): ExtractedPerson[] {
    const haystack = [
      ...results.map(textOf),
      aiOverview.toLowerCase().replace(/\s+/g, ' '),
    ].join(' ');
    const people: ExtractedPerson[] = [];
    const seen = new Set<string>();

    for (const record of records) {
      const name = record.name.trim();

      if (
        name.split(/\s+/).length < 2 ||
        !haystack.includes(name.toLowerCase().replace(/\s+/g, ' '))
      ) {
        continue;
      }

      // 0 means the model read the person from the AI Overview, not a result
      const source =
        record.resultIndex > 0 ? results[record.resultIndex - 1] : undefined;
      // The model can point at the About page while the person's profile is
      // also in the results, so the profile is looked for by name too
      const profile = [source, ...results].find(
        (result): result is GoogleSerpOrganicItem =>
          isDefined(result) &&
          isLinkedinProfileUrl(result.url) &&
          (result === source || personNamesMatch(result.title, name)),
      );
      const derivedUrl =
        profile === undefined
          ? this.profileUrlFromPosts(name, [source, ...results])
          : null;
      const linkedinUrl = profile?.url ?? derivedUrl ?? '';
      const key = linkedinUrl !== '' ? linkedinUrl : name.toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      people.push({
        name,
        jobTitle: record.jobTitle.trim(),
        companyName: record.companyName.trim(),
        location: record.location.trim(),
        isCurrentRole: record.isCurrentRole,
        evidence: record.evidence.trim(),
        linkedinUrl,
        linkedinUrlDerivedFromPost: derivedUrl !== null,
        sourceUrl: source?.url ?? profile?.url ?? '',
      });
    }

    return people.slice(0, MAX_PEOPLE);
  }

  // The author's profile id has to read as this person's name, so a post that
  // merely mentions them (written by someone else) never yields the wrong profile
  private profileUrlFromPosts(
    name: string,
    results: Array<GoogleSerpOrganicItem | undefined>,
  ): string | null {
    for (const result of results) {
      const profileUrl = isDefined(result)
        ? linkedinProfileUrlFromPostUrl(result.url)
        : null;

      if (
        profileUrl !== null &&
        personNamesMatch(profileUrl.split('/in/')[1].replace(/-/g, ' '), name)
      ) {
        return profileUrl;
      }
    }

    return null;
  }
}
