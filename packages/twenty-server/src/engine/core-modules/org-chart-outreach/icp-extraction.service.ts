import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import type { ParsedCVData } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/parsed-cv-transformer.service';
import { ResumeReadParseUploadService } from 'src/engine/core-modules/candidate-sourcing/services/resume-read-parse-upload.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import type {
  LinkedInCompanySearchResult,
  LinkedInSearchResult,
} from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { LLMChatModelService } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.service';
import type {
  ExtractIcpFromResumeParams,
  ExtractIcpFromResumeResponse,
  ExtractIcpParams,
  ExtractIcpResponse,
  FetchIcpCandidatesParams,
  FetchIcpCandidatesResponse,
  IcpCandidateCompany,
  MomTestQuestions,
} from 'src/engine/core-modules/org-chart-outreach/org-chart-outreach.types';
import { buildIcpCandidateRankingPrompt } from 'src/engine/core-modules/org-chart-outreach/prompts/icp-candidate-ranking.prompt';
import { buildIcpExtractionPrompt } from 'src/engine/core-modules/org-chart-outreach/prompts/icp-extraction.prompt';
import {
  buildCompanyWebsearchUserPrompt,
  COMPANY_WEBSEARCH_DEVELOPER_PROMPT,
} from 'src/engine/core-modules/org-chart-outreach/prompts/company-websearch.prompt';
import {
  buildMomTestSystemPrompt,
  buildMomTestUserMessage,
  formatLinkedinProfileAsResumeText,
} from 'src/engine/core-modules/org-chart-outreach/prompts/mom-test-question-generator.prompt';
import {
  companyWebsearchLlmResultSchema,
  type CompanyWebsearchLlmResult,
} from 'src/engine/core-modules/org-chart-outreach/schemas/company-websearch.schema';
import {
  icpCandidateRankingLlmResultSchema,
  icpExtractionLlmResultSchema,
  icpProfileSchema,
  type IcpProfile,
} from 'src/engine/core-modules/org-chart-outreach/schemas/icp-extraction.schema';
import { momTestQuestionsLlmResultSchema } from 'src/engine/core-modules/org-chart-outreach/schemas/mom-test-questions.schema';
import { normalizeLinkedinIdentifier } from 'src/engine/core-modules/org-chart-outreach/utils/linkedin-identifier.util';
import { normalizeLlmJsonContent } from 'src/engine/core-modules/org-chart-outreach/utils/outreach-company-resolver.util';
import {
  buildPersonProfileFromParsedCv,
  resolveCurrentCompanyFromParsedCv,
  resolveLinkedinUrlFromResume,
} from 'src/engine/core-modules/org-chart-outreach/utils/resume-linkedin.util';

const COMPANY_WEBSEARCH_MODEL = 'gpt-5.4-nano';

/** Sales Navigator company-headcount facet buckets (min/max pairs accepted by Unipile). */
const SALES_NAVIGATOR_HEADCOUNT_BUCKETS: Array<{ min: number; max: number }> = [
  { min: 1, max: 10 },
  { min: 11, max: 50 },
  { min: 51, max: 200 },
  { min: 201, max: 500 },
  { min: 501, max: 1000 },
  { min: 1001, max: 5000 },
  { min: 5001, max: 10000 },
];

/**
 * Extracts an employee range from an LLM-produced string, which may be verbose
 * (e.g. "200–5000 employees (must have enough scale to feel SRE pain)").
 */
export const parseEmployeeRange = (
  employeeRange: string,
): { min: number; max: number | null } | null => {
  const cleaned = employeeRange.replace(/[,\s]/g, '');
  const rangeMatch = cleaned.match(/(\d+)(?:[-–—~]|to)+(\d+)/i);
  if (rangeMatch) {
    return { min: Number(rangeMatch[1]), max: Number(rangeMatch[2]) };
  }
  const openEndedMatch = cleaned.match(/(\d+)\+/);
  if (openEndedMatch) {
    return { min: Number(openEndedMatch[1]), max: null };
  }
  const singleMatch = cleaned.match(/^(\d+)$/);
  if (singleMatch) {
    return { min: Number(singleMatch[1]), max: Number(singleMatch[1]) };
  }
  return null;
};

export const mapEmployeeRangeToSalesNavigatorHeadcount = (
  employeeRange: string,
): Array<{ min: number; max: number }> => {
  const parsed = parseEmployeeRange(employeeRange);
  if (!parsed) {
    return [];
  }
  const max = parsed.max ?? Number.MAX_SAFE_INTEGER;
  return SALES_NAVIGATOR_HEADCOUNT_BUCKETS.filter(
    (bucket) => bucket.max >= parsed.min && bucket.min <= max,
  );
};

export const mapEmployeeRangeToApolloRanges = (
  employeeRange: string,
): string[] => {
  const parsed = parseEmployeeRange(employeeRange);
  if (!parsed) {
    return [];
  }
  return [`${parsed.min},${parsed.max ?? 1000000}`];
};

/**
 * Extracts the company's public slug from a LinkedIn logo URL, e.g.
 * ".../1783673137504/arxorg_logo?e=..." -> "arxorg". LinkedIn replaces the
 * slug's hyphens/dots with underscores in the logo filename, so underscores
 * are mapped back to hyphens (slugs themselves never contain underscores).
 */
export const deriveCompanySlugFromLogoUrl = (
  logoUrl: unknown,
): string | undefined => {
  if (typeof logoUrl !== 'string') {
    return undefined;
  }
  const match = logoUrl.match(/\/([^/?]+)_logo(?=[?.]|$)/);
  if (!match) {
    return undefined;
  }
  return match[1].replace(/_/g, '-');
};

const deriveIdentifierFromWorkExperienceEntry = (
  entry: Record<string, unknown>,
): string | undefined => {
  const companyId = entry.company_id;
  if (typeof companyId === 'string' && companyId.trim()) {
    return companyId.trim();
  }
  if (typeof companyId === 'number') {
    return String(companyId);
  }

  return deriveCompanySlugFromLogoUrl(entry.company_picture_url);
};

/**
 * Derives the current company's LinkedIn identifier from a Unipile person
 * profile. Walks current roles (no end date) in profile order, then past
 * roles, returning the first entry that yields an identifier — either the
 * numeric company_id or, when Unipile omits it, the public slug embedded in
 * the entry's company_picture_url. Some current roles have neither (e.g. a
 * side venture without a LinkedIn page), so falling through matters. The
 * Unipile company endpoint accepts both numeric ids and public slugs.
 */
export const deriveCompanyIdentifierFromPersonProfile = (
  personProfile: Record<string, unknown>,
): string | undefined => {
  const workExperience = Array.isArray(personProfile.work_experience)
    ? personProfile.work_experience.filter(
        (entry): entry is Record<string, unknown> =>
          entry !== null && typeof entry === 'object',
      )
    : [];

  if (workExperience.length === 0) {
    return undefined;
  }

  const currentRoles = workExperience.filter(
    (entry) => entry.end === null || entry.end === undefined,
  );
  const pastRoles = workExperience.filter(
    (entry) => !currentRoles.includes(entry),
  );

  for (const entry of [...currentRoles, ...pastRoles]) {
    const identifier = deriveIdentifierFromWorkExperienceEntry(entry);
    if (identifier) {
      return identifier;
    }
  }

  return undefined;
};

const extractPostsSummary = (
  postsPayload: Record<string, unknown> | null,
  limit: number,
): { summary: string; count: number } => {
  const items = Array.isArray(postsPayload?.items) ? postsPayload.items : [];
  const texts = items
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === 'object',
    )
    .map((item) => (typeof item.text === 'string' ? item.text.trim() : ''))
    .filter(Boolean)
    .slice(0, limit);

  return {
    summary: texts.map((text, index) => `${index + 1}. ${text}`).join('\n'),
    count: texts.length,
  };
};

@Injectable()
export class IcpExtractionService {
  private readonly logger = new Logger(IcpExtractionService.name);

  constructor(
    private readonly llmChatModelService: LLMChatModelService,
    private readonly linkedinUnipileRequestService: LinkedinUnipileRequestService,
    private readonly linkedinUnipileEstimateAccountService: LinkedinUnipileEstimateAccountService,
    private readonly unipileCompanyService: UnipileCompanyService,
    private readonly apolloIoRestService: ApolloIoRestService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly resumeReadParseUploadService: ResumeReadParseUploadService,
  ) {}

  async extractIcp(params: ExtractIcpParams): Promise<ExtractIcpResponse> {
    // Accepts a public identifier, provider id, or full LinkedIn profile URL.
    const personIdentifier = normalizeLinkedinIdentifier(
      params.personIdentifier,
    );
    const hasPersonInput =
      params.personProfile !== undefined || Boolean(personIdentifier);

    if (!hasPersonInput) {
      throw new BadRequestException(
        'Provide personProfile (or personIdentifier); the company can be provided or derived from the person\'s current role',
      );
    }

    const includePosts = params.includePosts ?? false;
    const postsLimit = params.postsLimit ?? 10;

    const needsUnipile =
      params.personProfile === undefined ||
      params.companyProfile === undefined ||
      includePosts;

    let personProfile = params.personProfile ?? null;
    let companyProfile: Record<string, unknown> | null =
      params.companyProfile ?? null;
    let derivedCompanyIdentifier: string | undefined;
    let postsSummary = '';
    let postsCount = 0;

    if (needsUnipile) {
      const fetched =
        await this.linkedinUnipileEstimateAccountService.withOutreachLinkedinSession(
          params.apiToken,
          params.accountId,
          async (session) => {
            this.logger.log(
              `ICP extraction using LinkedIn Unipile accountId=${session.accountId}`,
            );

            const cleanupContext = {
              accountId: session.accountId,
              workspaceMemberId: params.workspaceMemberId,
              workspaceId: params.workspaceId,
              authToken: params.apiToken,
              context: 'ICP extraction',
            };

            let fetchedPerson = params.personProfile ?? null;
            if (!fetchedPerson) {
              fetchedPerson =
                await this.linkedinUnipileRequestService.fetchLinkedinUserProfile(
                  session.accountId,
                  personIdentifier,
                  { linkedinSections: ['*'], cleanupContext },
                );
              if (!fetchedPerson) {
                throw new BadRequestException(
                  `Failed to fetch LinkedIn profile for "${personIdentifier}"`,
                );
              }
            }

            let fetchedCompany: Record<string, unknown> | null =
              params.companyProfile ?? null;
            let companyIdentifierUsed = normalizeLinkedinIdentifier(
              params.companyIdentifier,
            ) || undefined;
            let companyIdentifierWasDerived = false;
            if (!fetchedCompany) {
              if (!companyIdentifierUsed) {
                companyIdentifierUsed =
                  deriveCompanyIdentifierFromPersonProfile(fetchedPerson);
                companyIdentifierWasDerived = Boolean(companyIdentifierUsed);
                if (companyIdentifierUsed) {
                  this.logger.log(
                    `ICP extraction derived companyIdentifier=${companyIdentifierUsed} from person's current role`,
                  );
                }
              }

              if (companyIdentifierUsed) {
                const companyDto =
                  await this.unipileCompanyService.getCompanyProfile(
                    companyIdentifierUsed,
                    session.accountId,
                  );
                if (companyDto) {
                  fetchedCompany = companyDto as Record<string, unknown>;
                } else if (!companyIdentifierWasDerived) {
                  // An explicitly requested company that cannot be fetched is
                  // an input error; a derived one falls back to person-only.
                  throw new BadRequestException(
                    `Failed to fetch LinkedIn company profile for "${companyIdentifierUsed}"`,
                  );
                }
              }

              if (!fetchedCompany) {
                this.logger.warn(
                  `ICP extraction proceeding without a company profile (identifier=${companyIdentifierUsed ?? 'none'}); using person headline/summary only`,
                );
              }
            }

            let fetchedPosts: Record<string, unknown> | null = null;
            if (includePosts) {
              const providerId =
                typeof fetchedPerson.provider_id === 'string'
                  ? fetchedPerson.provider_id
                  : personIdentifier;
              if (providerId) {
                fetchedPosts =
                  await this.linkedinUnipileRequestService.fetchLinkedinUserPosts(
                    session.accountId,
                    providerId,
                    { limit: postsLimit, cleanupContext },
                  );
              }
            }

            return {
              person: fetchedPerson,
              company: fetchedCompany,
              posts: fetchedPosts,
              derivedCompanyIdentifier: companyIdentifierWasDerived
                ? companyIdentifierUsed
                : undefined,
            };
          },
        );

      personProfile = fetched.person;
      companyProfile = fetched.company;
      derivedCompanyIdentifier = fetched.derivedCompanyIdentifier;
      const posts = extractPostsSummary(fetched.posts, postsLimit);
      postsSummary = posts.summary;
      postsCount = posts.count;
    }

    const personProfileRecord = personProfile as Record<string, unknown>;
    const includeMomTestQuestions = params.includeMomTestQuestions ?? true;

    const icpPrompt = buildIcpExtractionPrompt({
      personProfile: personProfileRecord,
      companyProfile,
      postsSummary,
    });

    const model = this.llmChatModelService.getJSONChatModel();

    const icpPromise = model.invoke(icpPrompt).then((response) => {
      const rawContent = normalizeLlmJsonContent(response);
      if (!rawContent) {
        throw new BadRequestException('LLM returned empty ICP extraction');
      }
      return icpExtractionLlmResultSchema.parse(JSON.parse(rawContent));
    });

    const momTestPromise = includeMomTestQuestions
      ? this.generateMomTestQuestions({
          personProfile: personProfileRecord,
          interviewContext: params.interviewContext,
        })
      : Promise.resolve(undefined);

    const [parsed, momTestQuestions] = await Promise.all([
      icpPromise,
      momTestPromise,
    ]);

    this.logger.log(
      `ICP extraction: sells="${parsed.sells.slice(0, 120)}" relevant=${parsed.relevant_recipient_for_target_account_lure} chart_function=${parsed.chart_function ?? 'null'} momTest=${Boolean(momTestQuestions)}`,
    );

    return {
      ...parsed,
      ...(momTestQuestions ? { momTestQuestions } : {}),
      contextUsed: {
        personSource: params.personProfile ? 'provided' : 'unipile',
        companySource: params.companyProfile
          ? 'provided'
          : companyProfile === null
            ? 'person_only'
            : derivedCompanyIdentifier
              ? 'derived_from_person'
              : 'unipile',
        derivedCompanyIdentifier,
        postsCount,
        momTestQuestionsGenerated: Boolean(momTestQuestions),
      },
    };
  }

  /**
   * ICP extract from a raw resume (PDF/DOCX/DOC or pasted text).
   * If a LinkedIn /in/ URL is present, delegates to the LinkedIn Unipile path.
   * Otherwise parses the CV, web-searches the current company, and runs ICP + Mom Test.
   */
  async extractIcpFromResume(
    params: ExtractIcpFromResumeParams,
  ): Promise<ExtractIcpFromResumeResponse> {
    const { resumeText, resumeFileName, parsed } =
      await this.loadAndParseResume(params);

    const linkedinUrl = resolveLinkedinUrlFromResume({
      parsed,
      resumeText,
    });
    const currentCompany = resolveCurrentCompanyFromParsedCv(parsed);
    const parsedResumeSummary = this.buildParsedResumeSummary(
      parsed,
      linkedinUrl,
      currentCompany,
    );

    this.logger.log(
      `ICP from resume file="${resumeFileName}" linkedin=${linkedinUrl ?? 'none'} company="${currentCompany.companyName ?? 'none'}"`,
    );

    if (linkedinUrl) {
      const extraction = await this.extractIcp({
        personIdentifier: linkedinUrl,
        includePosts: params.includePosts,
        postsLimit: params.postsLimit,
        includeMomTestQuestions: params.includeMomTestQuestions,
        interviewContext: params.interviewContext,
        accountId: params.accountId,
        apiToken: params.apiToken,
        workspaceMemberId: params.workspaceMemberId,
        workspaceId: params.workspaceId,
      });

      return {
        ...extraction,
        parsedResume: parsedResumeSummary,
        contextUsed: {
          ...extraction.contextUsed,
          resumeFileName,
          linkedinUrlFromResume: linkedinUrl,
        },
      };
    }

    const personProfile = buildPersonProfileFromParsedCv(parsed, resumeText);
    let companyProfile: Record<string, unknown> | null = null;
    let companySource: ExtractIcpResponse['contextUsed']['companySource'] =
      'person_only';

    if (currentCompany.companyName) {
      try {
        const webCompany = await this.fetchCompanyProfileViaWebSearch({
          companyName: currentCompany.companyName,
          personName: parsedResumeSummary.name,
          personRole: currentCompany.role,
          location: currentCompany.location ?? parsed.location,
        });
        companyProfile = webCompany as unknown as Record<string, unknown>;
        companySource = 'web_search';
      } catch (error) {
        this.logger.warn(
          `ICP from resume: company websearch failed for "${currentCompany.companyName}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const includeMomTestQuestions = params.includeMomTestQuestions ?? true;
    const icpPrompt = buildIcpExtractionPrompt({
      personProfile,
      companyProfile,
    });
    const model = this.llmChatModelService.getJSONChatModel();

    const icpPromise = model.invoke(icpPrompt).then((response) => {
      const rawContent = normalizeLlmJsonContent(response);
      if (!rawContent) {
        throw new BadRequestException('LLM returned empty ICP extraction');
      }
      return icpExtractionLlmResultSchema.parse(JSON.parse(rawContent));
    });

    const momTestPromise = includeMomTestQuestions
      ? this.generateMomTestQuestions({
          resumeText,
          interviewContext: params.interviewContext,
        })
      : Promise.resolve(undefined);

    const [parsedIcp, momTestQuestions] = await Promise.all([
      icpPromise,
      momTestPromise,
    ]);

    this.logger.log(
      `ICP from resume (no LinkedIn): sells="${parsedIcp.sells.slice(0, 120)}" relevant=${parsedIcp.relevant_recipient_for_target_account_lure} companySource=${companySource} momTest=${Boolean(momTestQuestions)}`,
    );

    return {
      ...parsedIcp,
      ...(momTestQuestions ? { momTestQuestions } : {}),
      parsedResume: parsedResumeSummary,
      contextUsed: {
        personSource: 'resume',
        companySource,
        postsCount: 0,
        momTestQuestionsGenerated: Boolean(momTestQuestions),
        resumeFileName,
      },
    };
  }

  private async loadAndParseResume(params: ExtractIcpFromResumeParams): Promise<{
    resumeText: string;
    resumeFileName: string;
    parsed: ParsedCVData;
  }> {
    const providedText = params.resumeText?.trim();
    if (providedText) {
      const parsed =
        await this.resumeReadParseUploadService.parseResumeText(providedText);
      return {
        resumeText: providedText,
        resumeFileName: 'resume.txt',
        parsed,
      };
    }

    const filePath = params.resumeFilePath?.trim();
    if (!filePath) {
      throw new BadRequestException(
        'Provide resumePath (local PDF/DOCX/DOC file) or resumeText',
      );
    }

    const { content, parsed } =
      await this.resumeReadParseUploadService.readAndParseResumeFile(filePath);
    return {
      resumeText: content.text,
      resumeFileName: content.fileName,
      parsed,
    };
  }

  private buildParsedResumeSummary(
    parsed: ParsedCVData,
    linkedinUrl: string | undefined,
    currentCompany: { companyName?: string; role?: string },
  ): ExtractIcpFromResumeResponse['parsedResume'] {
    const name =
      parsed.fullName?.trim() ||
      parsed.name?.trim() ||
      [parsed.firstName, parsed.lastName].filter(Boolean).join(' ').trim() ||
      undefined;

    return {
      name,
      email: parsed.email?.trim() || undefined,
      linkedinUrl: linkedinUrl ?? null,
      currentCompany: currentCompany.companyName ?? null,
      currentRole: currentCompany.role ?? null,
    };
  }

  private createOpenAiClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY ?? process.env.OPENAI_KEY;
    if (!apiKey?.trim()) {
      throw new BadRequestException('OpenAI API key is not configured');
    }
    return new OpenAI({ apiKey });
  }

  /**
   * LLM web_search fallback for company details when the resume has no LinkedIn URL.
   */
  private async fetchCompanyProfileViaWebSearch(input: {
    companyName: string;
    personName?: string;
    personRole?: string;
    location?: string;
  }): Promise<CompanyWebsearchLlmResult> {
    const openai = this.createOpenAiClient();
    const userPrompt = buildCompanyWebsearchUserPrompt(input);

    this.logger.log(
      `Company websearch for "${input.companyName}" person="${input.personName ?? ''}"`,
    );

    const response = await openai.responses.create({
      model: COMPANY_WEBSEARCH_MODEL,
      reasoning: { effort: 'medium' },
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',
      input: [
        {
          role: 'developer',
          content: COMPANY_WEBSEARCH_DEVELOPER_PROMPT,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      text: {
        format: zodTextFormat(
          companyWebsearchLlmResultSchema,
          'company_websearch',
        ),
      },
      store: true,
    });

    const outputText = this.extractOpenAiResponseOutputText(response);
    if (!outputText?.trim()) {
      throw new BadRequestException(
        `Empty company websearch response for "${input.companyName}"`,
      );
    }

    const parsed = companyWebsearchLlmResultSchema.parse(
      this.parseJsonLoose(outputText),
    );

    this.logger.log(
      `Company websearch returned name="${parsed.name}" industry="${parsed.industry}"`,
    );

    return parsed;
  }

  private extractOpenAiResponseOutputText(response: {
    output_text?: string | null;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  }): string | null {
    if (typeof response.output_text === 'string' && response.output_text.trim()) {
      return response.output_text.trim();
    }

    const message = response.output?.find((item) => item.type === 'message');
    const textPart = message?.content?.find(
      (part) => part.type === 'output_text',
    );
    return typeof textPart?.text === 'string' ? textPart.text.trim() : null;
  }

  private parseJsonLoose(content: string): unknown {
    const cleaned = content
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned) as unknown;
  }

  /**
   * Mom Test discovery questions: system prompt = fixed strategy (product,
   * hypotheses, persona map, rules); user message = resume + optional context.
   */
  private async generateMomTestQuestions(input: {
    personProfile?: Record<string, unknown>;
    resumeText?: string;
    interviewContext?: string;
  }): Promise<MomTestQuestions> {
    const resumeText =
      input.resumeText?.trim() ||
      (input.personProfile
        ? formatLinkedinProfileAsResumeText(input.personProfile)
        : '');

    if (!resumeText) {
      throw new BadRequestException(
        'Mom Test questions require a person profile or resume text',
      );
    }

    const messages = [
      new SystemMessage(buildMomTestSystemPrompt()),
      new HumanMessage(
        buildMomTestUserMessage({
          resumeText,
          interviewContext: input.interviewContext,
        }),
      ),
    ];

    const model = this.llmChatModelService.getJSONChatModel();
    const response = await model.invoke(messages);
    const rawContent = normalizeLlmJsonContent(response);

    if (!rawContent) {
      throw new BadRequestException('LLM returned empty Mom Test questions');
    }

    const parsed = momTestQuestionsLlmResultSchema.parse(
      JSON.parse(rawContent),
    );

    this.logger.log(
      `Mom Test questions: persona="${parsed.persona_read.slice(0, 80)}" core=${parsed.core_questions.length} money=${parsed.money_probes.length}`,
    );

    return parsed;
  }

  async fetchIcpCandidates(
    params: FetchIcpCandidatesParams,
  ): Promise<FetchIcpCandidatesResponse> {
    const icp = icpProfileSchema.parse(params.icp);
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 25);
    const searchKeywords = this.resolveSearchKeywords(icp, params.keywords);

    const candidates =
      params.source === 'apollo'
        ? await this.fetchCandidatesFromApollo({
            icp,
            keywords: searchKeywords,
            locations: params.locations,
            limit,
          })
        : await this.fetchCandidatesFromSalesNavigator({
            icp,
            keywords: searchKeywords,
            limit,
            accountId: params.accountId,
            apiToken: params.apiToken,
          });

    this.logger.log(
      `ICP candidate fetch source=${params.source} keywords="${searchKeywords}" found=${candidates.length}`,
    );

    const response: FetchIcpCandidatesResponse = {
      source: params.source,
      searchKeywords,
      candidates,
    };

    const shouldRank = params.rank ?? true;
    if (shouldRank && candidates.length > 0) {
      response.ranking = await this.rankCandidatesWithLlm({
        icp,
        chartFunction: params.chartFunction,
        candidates,
        candidateSource: params.source,
      });
    }

    return response;
  }

  private resolveSearchKeywords(
    icp: IcpProfile,
    overrideKeywords?: string,
  ): string {
    if (overrideKeywords?.trim()) {
      return overrideKeywords.trim();
    }
    if (icp.tech_stack_signals.length > 0) {
      return icp.tech_stack_signals.slice(0, 4).join(' OR ');
    }
    if (icp.industry.length > 0) {
      return icp.industry.slice(0, 4).join(' OR ');
    }
    throw new BadRequestException(
      'ICP has no tech_stack_signals or industry to search with; pass keywords explicitly',
    );
  }

  /** Apollo organization search — consumes 1 Apollo credit per call. */
  private async fetchCandidatesFromApollo(input: {
    icp: IcpProfile;
    keywords: string;
    locations?: string[];
    limit: number;
  }): Promise<IcpCandidateCompany[]> {
    const raw = await this.apolloIoRestService.organizationsSearch({
      q_organization_name: undefined,
      q_organization_keyword_tags: [
        ...input.icp.industry,
        ...input.icp.tech_stack_signals,
      ].slice(0, 10),
      organization_num_employees_ranges: mapEmployeeRangeToApolloRanges(
        input.icp.employee_range,
      ),
      organization_locations: input.locations,
      page: 1,
      per_page: input.limit,
    });

    const organizations = (raw as { organizations?: unknown }).organizations;
    const list = Array.isArray(organizations)
      ? organizations.filter(
          (org): org is Record<string, unknown> =>
            org !== null && typeof org === 'object',
        )
      : [];

    return list.map((org) => ({
      name: typeof org.name === 'string' ? org.name : 'Unknown',
      source: 'apollo' as const,
      id:
        typeof org.organization_id === 'string'
          ? org.organization_id
          : typeof org.id === 'string'
            ? org.id
            : undefined,
      industry: typeof org.industry === 'string' ? org.industry : undefined,
      employeeCount:
        typeof org.estimated_num_employees === 'number'
          ? org.estimated_num_employees
          : undefined,
      location:
        [org.city, org.state, org.country]
          .filter((part): part is string => typeof part === 'string')
          .join(', ') || undefined,
      domain:
        typeof org.primary_domain === 'string' ? org.primary_domain : undefined,
      linkedinUrl:
        typeof org.linkedin_url === 'string' ? org.linkedin_url : undefined,
      websiteUrl:
        typeof org.website_url === 'string' ? org.website_url : undefined,
      keywords: Array.isArray(org.keywords)
        ? org.keywords
            .filter((k): k is string => typeof k === 'string')
            .slice(0, 15)
        : undefined,
    }));
  }

  /** LinkedIn Sales Navigator company search via Unipile — free (no Apollo credits). */
  private async fetchCandidatesFromSalesNavigator(input: {
    icp: IcpProfile;
    keywords: string;
    limit: number;
    accountId?: string;
    apiToken: string;
  }): Promise<IcpCandidateCompany[]> {
    const headcount = mapEmployeeRangeToSalesNavigatorHeadcount(
      input.icp.employee_range,
    );

    return this.linkedinUnipileEstimateAccountService.withOutreachLinkedinSession(
      input.apiToken,
      input.accountId,
      async (session) => {
        this.logger.log(
          `ICP Sales Navigator company search accountId=${session.accountId}`,
        );

        const searchResponse =
          await this.linkedInSearchService.searchCompaniesSalesNavigator(
            {
              keywords: input.keywords,
              ...(headcount.length > 0 ? { headcount } : {}),
            },
            session.accountId,
            { limit: input.limit },
          );

        const isCompanyResult = (
          item: LinkedInSearchResult,
        ): item is LinkedInCompanySearchResult => item.type === 'COMPANY';

        return searchResponse.items.filter(isCompanyResult).map((item) => ({
          name: item.name,
          source: 'sales_navigator' as const,
          id: item.id,
          industry: item.industry,
          headcount: item.headcount,
          location: item.location ?? undefined,
          linkedinUrl: item.profile_url,
        }));
      },
    );
  }

  private async rankCandidatesWithLlm(input: {
    icp: IcpProfile;
    chartFunction?: string | null;
    candidates: IcpCandidateCompany[];
    candidateSource: 'apollo' | 'sales_navigator';
  }): Promise<FetchIcpCandidatesResponse['ranking']> {
    const prompt = buildIcpCandidateRankingPrompt(input);
    const model = this.llmChatModelService.getJSONChatModel();
    const response = await model.invoke(prompt);
    const rawContent = normalizeLlmJsonContent(response);

    if (!rawContent) {
      throw new BadRequestException('LLM returned empty candidate ranking');
    }

    const parsed = icpCandidateRankingLlmResultSchema.parse(
      JSON.parse(rawContent),
    );

    this.logger.log(
      `ICP candidate ranking: proceed=${parsed.proceed} ranked=${parsed.ranked_candidates.map((c) => c.company_name).join(', ')}`,
    );

    return parsed;
  }
}
