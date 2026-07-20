import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { UnipileCompanyService } from 'src/engine/core-modules/arx-chat/services/unipile-company.service';
import { ApolloIoRestService } from 'src/engine/core-modules/candidate-search/services/apollo-io-rest.service';
import { ResumeReadParseUploadService } from 'src/engine/core-modules/candidate-sourcing/services/resume-read-parse-upload.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { LLMChatModelService } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.service';

import {
    deriveCompanyIdentifierFromPersonProfile,
    IcpExtractionService,
    mapEmployeeRangeToApolloRanges,
    mapEmployeeRangeToSalesNavigatorHeadcount,
    parseEmployeeRange,
} from './icp-extraction.service';

const PERSON_PROFILE_FIXTURE: Record<string, unknown> = {
  object: 'UserProfile',
  provider: 'LINKEDIN',
  provider_id: 'ACoAAAHU7vABvj0KTKkaLOIc5El2eMWE5aLnPq4',
  public_identifier: 'gaurav-sherlocks-ai',
  first_name: 'Gaurav',
  last_name: 'Toshniwal',
  headline:
    'Alerts / Tickets → Root Cause → Fix... in Minutes | Co-founder @Sherlocks.ai | Ex-CTO at Doubtnut (50M+ users)',
  location: 'San Francisco, California, United States',
  work_experience: [
    {
      company_id: '105905196',
      company: 'Sherlocks.ai',
      position: 'Founder',
      description:
        "We're building AI that thinks like an SRE... If your infra's playing games, we're here to outsmart it. Let's talk AI, ops, and the future of reliability.",
      start: '1/1/2025',
      end: null,
    },
    {
      company_id: '13222185',
      company: 'Doubtnut',
      position: 'Chief Technology Officer',
      start: '11/1/2019',
      end: '1/1/2025',
    },
  ],
};

const COMPANY_PROFILE_FIXTURE: Record<string, unknown> = {
  object: 'CompanyProfile',
  id: '105905196',
  name: 'Sherlocks.ai',
  description:
    'Sherlocks.ai is an agentic AI SRE platform. When an alert fires, our agents investigate immediately: correlate signals across your stack, test hypotheses like a senior engineer would, and deliver root cause with clear next steps. SOC 2 Type 2 certified.',
  public_identifier: 'sherlocks-ai',
  employee_count: 10,
  industry: ['IT System Operations and Maintenance'],
  activities: ['SRE', 'AI', 'incident management', 'AIOps', 'Observability'],
  website: 'https://www.sherlocks.ai',
};

const ICP_FIXTURE = {
  industry: ['B2B SaaS', 'Fintech', 'E-commerce'],
  employee_range: '200-2000',
  tech_stack_signals: ['Kubernetes', 'Datadog', 'Prometheus'],
  buyer_titles: ['VP Engineering', 'Head of SRE', 'Director of DevOps'],
  pain_signals: ['on-call fatigue', 'high MTTR', 'alert noise'],
};

const VALID_EXTRACTION_LLM_JSON = JSON.stringify({
  sells: 'Agentic AI SRE platform for automated incident root-cause analysis',
  relevant_recipient_for_target_account_lure: true,
  reasoning:
    'Co-founder at a 10-person company founded in 2025 with no dedicated sales hire; his summary reads like outbound copy, so he personally runs the sales motion.',
  icp: ICP_FIXTURE,
  chart_function: 'Engineering/Platform',
});

const VALID_MOM_TEST_LLM_JSON = JSON.stringify({
  persona_read:
    'Founder / Co-founder, early-stage — Sherlocks.ai, ex-CTO Doubtnut, SF location',
  core_questions: [
    {
      question:
        'Walk me through the last time you picked which account to go after at Sherlocks — how did you decide where to start?',
      tag: 'T',
      listen_for:
        'Confirms if they use gut/title guesses vs structured account selection; kills if they already have a rigorous targeting process',
    },
    {
      question:
        'Tell me about the most recent deal where a new stakeholder showed up late — what happened?',
      tag: 'M',
      listen_for:
        'Confirms multi-threading blindness; kills if they systematically map buying committees early',
    },
    {
      question:
        'What did your last outbound week look like day-to-day — which tools and lists did you actually use?',
      tag: 'T',
      listen_for:
        'Confirms ZoomInfo/list-building pain anchors; kills if targeting is already solved',
    },
    {
      question:
        'Walk me through how you last reviewed whether your pipeline accounts were the right ones.',
      tag: 'V',
      listen_for:
        'Confirms no coverage/accuracy instrument; kills if they already measure targeting quality',
    },
  ],
  money_probes: [
    {
      question:
        'Roughly how much did the last tool you begged for (or bought) for prospecting cost, and whose budget was it?',
      tag: 'T',
    },
    {
      question:
        'Think of the last deal that slipped or died after a late stakeholder — roughly what size was it?',
      tag: 'M',
    },
  ],
  trap_check:
    'Founder pitching his own product may steer answers toward AI/SRE narratives — keep questions on past sales process, not product opinions.',
});

const VALID_RANKING_LLM_JSON = JSON.stringify({
  proceed: true,
  ranked_candidates: [
    {
      company_name: 'Acme Corp',
      fit_reasoning:
        'Runs Kubernetes + Datadog per tech signals, 800 employees inside the 200-2000 ICP range.',
      chart_function: 'Platform Engineering',
    },
  ],
});

/** ICP extract + Mom Test run in parallel; route by invoke input shape. */
const mockIcpAndMomTestInvokes = (invokeFn: jest.Mock) => {
  invokeFn.mockImplementation(async (input: unknown) => {
    if (Array.isArray(input)) {
      return { content: VALID_MOM_TEST_LLM_JSON };
    }
    return { content: VALID_EXTRACTION_LLM_JSON };
  });
};

describe('IcpExtractionService', () => {
  let service: IcpExtractionService;
  const invoke = jest.fn();
  const fetchLinkedinUserProfile = jest.fn();
  const fetchLinkedinUserPosts = jest.fn();
  const getCompanyProfile = jest.fn();
  const organizationsSearch = jest.fn();
  const searchCompaniesSalesNavigator = jest.fn();
  const parseResumeText = jest.fn();
  const readAndParseResumeFile = jest.fn();
  const withOutreachLinkedinSession = jest.fn(
    async (
      _apiToken: string,
      _accountId: string | undefined,
      run: (session: { accountId: string }) => Promise<unknown>,
    ) => run({ accountId: 'unipile-account-1' }),
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IcpExtractionService,
        {
          provide: LLMChatModelService,
          useValue: { getJSONChatModel: () => ({ invoke }) },
        },
        {
          provide: LinkedinUnipileRequestService,
          useValue: { fetchLinkedinUserProfile, fetchLinkedinUserPosts },
        },
        {
          provide: LinkedinUnipileEstimateAccountService,
          useValue: { withOutreachLinkedinSession },
        },
        {
          provide: UnipileCompanyService,
          useValue: { getCompanyProfile },
        },
        {
          provide: ApolloIoRestService,
          useValue: { organizationsSearch },
        },
        {
          provide: LinkedInSearchService,
          useValue: { searchCompaniesSalesNavigator },
        },
        {
          provide: ResumeReadParseUploadService,
          useValue: { parseResumeText, readAndParseResumeFile },
        },
      ],
    }).compile();

    service = module.get(IcpExtractionService);
  });

  const baseAuth = {
    apiToken: 'tok',
    workspaceMemberId: 'wm-1',
    workspaceId: 'ws-1',
  };

  describe('employee range helpers', () => {
    it('parses simple, open-ended, and single ranges', () => {
      console.log('parseEmployeeRange "200-2000":', parseEmployeeRange('200-2000'));
      expect(parseEmployeeRange('200-2000')).toEqual({ min: 200, max: 2000 });
      console.log('parseEmployeeRange "1000+":', parseEmployeeRange('1000+'));
      expect(parseEmployeeRange('1000+')).toEqual({ min: 1000, max: null });
      console.log('parseEmployeeRange "50":', parseEmployeeRange('50'));
      expect(parseEmployeeRange('50')).toEqual({ min: 50, max: 50 });
      console.log('parseEmployeeRange "unknown":', parseEmployeeRange('unknown'));
      expect(parseEmployeeRange('unknown')).toBeNull();
    });

    it('extracts ranges from verbose LLM-produced strings', () => {
      const verbose =
        '200–5000 employees (must have enough scale to feel SRE pain but not so large that they have bespoke internal tooling).';
      console.log('parseEmployeeRange verbose:', parseEmployeeRange(verbose));
      expect(parseEmployeeRange(verbose)).toEqual({ min: 200, max: 5000 });
      console.log(
        'parseEmployeeRange "roughly 1000+ employees":',
        parseEmployeeRange('roughly 1000+ employees'),
      );
      expect(parseEmployeeRange('roughly 1000+ employees')).toEqual({
        min: 1000,
        max: null,
      });
      expect(parseEmployeeRange('50 to 200 people')).toEqual({
        min: 50,
        max: 200,
      });
    });

    it('maps employee range to overlapping Sales Navigator headcount buckets', () => {
      const buckets = mapEmployeeRangeToSalesNavigatorHeadcount('200-2000');
      console.log('sales nav buckets for 200-2000:', buckets);
      expect(buckets).toEqual([
        { min: 51, max: 200 },
        { min: 201, max: 500 },
        { min: 501, max: 1000 },
        { min: 1001, max: 5000 },
      ]);
    });

    it('maps employee range to Apollo range strings', () => {
      const ranges = mapEmployeeRangeToApolloRanges('200-2000');
      console.log('apollo ranges for 200-2000:', ranges);
      expect(ranges).toEqual(['200,2000']);
      expect(mapEmployeeRangeToApolloRanges('1000+')).toEqual([
        '1000,1000000',
      ]);
      expect(mapEmployeeRangeToApolloRanges('n/a')).toEqual([]);
    });
  });

  describe('deriveCompanyIdentifierFromPersonProfile', () => {
    it('picks the company_id of the current role (end=null)', () => {
      const derived = deriveCompanyIdentifierFromPersonProfile(
        PERSON_PROFILE_FIXTURE,
      );
      console.log('derived company identifier from fixture:', derived);
      expect(derived).toBe('105905196');

      const currentRoleNotFirst = {
        work_experience: [
          { company: 'Old Co', company_id: '999', end: '1/1/2024' },
          { company: 'Sherlocks.ai', company_id: '105905196', end: null },
        ],
      };
      const derivedNotFirst =
        deriveCompanyIdentifierFromPersonProfile(currentRoleNotFirst);
      console.log('derived (current role not first):', derivedNotFirst);
      expect(derivedNotFirst).toBe('105905196');
    });

    it('falls back to the first work_experience entry when none is current', () => {
      const allEnded = {
        work_experience: [
          { company: 'Latest Co', company_id: '111', end: '1/1/2025' },
          { company: 'Older Co', company_id: '222', end: '1/1/2020' },
        ],
      };
      const derived = deriveCompanyIdentifierFromPersonProfile(allEnded);
      console.log('derived company identifier (all ended):', derived);
      expect(derived).toBe('111');
    });

    it('returns undefined when there is no usable work experience', () => {
      expect(deriveCompanyIdentifierFromPersonProfile({})).toBeUndefined();
      expect(
        deriveCompanyIdentifierFromPersonProfile({ work_experience: [] }),
      ).toBeUndefined();
      expect(
        deriveCompanyIdentifierFromPersonProfile({
          work_experience: [{ company: 'No Id Co', end: null }],
        }),
      ).toBeUndefined();
    });

    it('falls back to the slug in company_picture_url when company_id is missing', () => {
      // Real Unipile shape for profiles where LinkedIn omits company_id:
      // entries only carry the position id + a logo URL embedding the slug.
      const profileWithoutCompanyIds = {
        work_experience: [
          {
            id: '2301855522',
            company: 'Arx Org',
            position: 'Founder & CEO',
            company_picture_url:
              'https://media.licdn.com/dms/image/v2/D4D0BAQE0LUc3LSjJDg/company-logo_200_200/B4DZ9LNCiaJwAE-/0/1783673137504/arxorg_logo?e=1785974400&v=beta&t=xyz',
            start: '1/1/2026',
            end: null,
          },
          {
            id: '1012715474',
            company: 'Michael Page',
            position: 'Consultant',
            company_picture_url:
              'https://media.licdn.com/dms/image/v2/D4E0BAQGqkzfSzNQSmg/company-logo_200_200/B4EZ8cYW0OH8AE-/0/1782887575015/michael_page_logo?e=1785974400&v=beta&t=abc',
            start: '1/1/2017',
            end: '1/1/2020',
          },
        ],
      };
      const derived = deriveCompanyIdentifierFromPersonProfile(
        profileWithoutCompanyIds,
      );
      console.log('derived company identifier (logo slug fallback):', derived);
      expect(derived).toBe('arxorg');
    });

    it('maps underscores in logo slugs back to hyphens', () => {
      const profile = {
        work_experience: [
          {
            company: 'Michael Page',
            company_picture_url:
              'https://media.licdn.com/dms/image/v2/D4E0BAQGqkzfSzNQSmg/company-logo_200_200/B4EZ8cYW0OH8AE-/0/1782887575015/michael_page_logo?e=1785974400&v=beta&t=abc',
            end: null,
          },
        ],
      };
      const derived = deriveCompanyIdentifierFromPersonProfile(profile);
      console.log('derived company identifier (underscore slug):', derived);
      expect(derived).toBe('michael-page');
    });

    it('falls through to the next current role when the first has no identifier', () => {
      // Real case (radhikabanka): first current role is a side venture with
      // no LinkedIn page; the second current role has a company_id.
      const profile = {
        work_experience: [
          { company: 'Mukticare', position: 'Co-Founder & CEO', end: null },
          {
            company: 'Hinduja Hospital',
            position: 'Consultant Respiratory Physician',
            company_id: '946958',
            end: null,
          },
          { company: 'Old NHS Trust', company_id: '6237274', end: '2/1/2021' },
        ],
      };
      const derived = deriveCompanyIdentifierFromPersonProfile(profile);
      console.log('derived company identifier (fall-through):', derived);
      expect(derived).toBe('946958');
    });

    it('does not mistake the company-logo_NxN path segment for a slug', () => {
      const profile = {
        work_experience: [
          {
            company: 'Broken Logo Co',
            company_picture_url:
              'https://media.licdn.com/dms/image/v2/XXX/company-logo_200_200/B4/0/12345/',
            end: null,
          },
        ],
      };
      const derived = deriveCompanyIdentifierFromPersonProfile(profile);
      console.log('derived company identifier (no slug in url):', derived);
      expect(derived).toBeUndefined();
    });
  });

  describe('extractIcp', () => {
    it('throws when neither profiles nor identifiers are provided', async () => {
      console.log('extractIcp missing-input test');
      await expect(service.extractIcp({ ...baseAuth })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('extracts ICP from provided profiles without touching Unipile', async () => {
      mockIcpAndMomTestInvokes(invoke);

      const result = await service.extractIcp({
        personProfile: PERSON_PROFILE_FIXTURE,
        companyProfile: COMPANY_PROFILE_FIXTURE,
        ...baseAuth,
      });
      console.log('extractIcp provided-profiles result:', result);

      expect(result.relevant_recipient_for_target_account_lure).toBe(true);
      expect(result.chart_function).toBe('Engineering/Platform');
      expect(result.icp.buyer_titles).toContain('VP Engineering');
      expect(result.momTestQuestions?.core_questions.length).toBeGreaterThanOrEqual(
        4,
      );
      expect(result.momTestQuestions?.money_probes.length).toBeGreaterThanOrEqual(
        2,
      );
      expect(result.contextUsed).toEqual({
        personSource: 'provided',
        companySource: 'provided',
        postsCount: 0,
        momTestQuestionsGenerated: true,
      });
      expect(withOutreachLinkedinSession).not.toHaveBeenCalled();

      const icpCall = invoke.mock.calls.find(
        (call) => typeof call[0] === 'string',
      );
      const momTestCall = invoke.mock.calls.find((call) =>
        Array.isArray(call[0]),
      );
      expect(icpCall).toBeDefined();
      expect(momTestCall).toBeDefined();
      const prompt = icpCall?.[0] as string;
      console.log('extractIcp prompt length:', prompt.length);
      expect(prompt).toContain('target-account org chart lure');
      expect(prompt).toContain('Sherlocks.ai');
    });

    it('skips Mom Test generation when includeMomTestQuestions is false', async () => {
      invoke.mockResolvedValueOnce({ content: VALID_EXTRACTION_LLM_JSON });

      const result = await service.extractIcp({
        personProfile: PERSON_PROFILE_FIXTURE,
        companyProfile: COMPANY_PROFILE_FIXTURE,
        includeMomTestQuestions: false,
        ...baseAuth,
      });
      console.log('extractIcp skip-mom-test result:', result.contextUsed);

      expect(result.momTestQuestions).toBeUndefined();
      expect(result.contextUsed.momTestQuestionsGenerated).toBe(false);
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(typeof invoke.mock.calls[0][0]).toBe('string');
    });

    it('passes interviewContext into the Mom Test user message', async () => {
      mockIcpAndMomTestInvokes(invoke);

      await service.extractIcp({
        personProfile: PERSON_PROFILE_FIXTURE,
        companyProfile: COMPANY_PROFILE_FIXTURE,
        interviewContext:
          'rejected candidate, interviewed 2 months ago, warm relationship',
        ...baseAuth,
      });

      const momTestCall = invoke.mock.calls.find((call) =>
        Array.isArray(call[0]),
      );
      expect(momTestCall).toBeDefined();
      const messages = momTestCall?.[0] as Array<{ content: string }>;
      const userContent = messages[1]?.content ?? '';
      console.log('Mom Test user message snippet:', userContent.slice(0, 200));
      expect(userContent).toContain('Optional context:');
      expect(userContent).toContain('rejected candidate');
      expect(userContent).toContain('Gaurav');
      expect(messages[0]?.content).toContain('The Mom Test');
      expect(messages[0]?.content).toContain('[T] Targeting');
    });

    it('fetches person and company via Unipile when only identifiers are given', async () => {
      fetchLinkedinUserProfile.mockResolvedValueOnce(PERSON_PROFILE_FIXTURE);
      getCompanyProfile.mockResolvedValueOnce(COMPANY_PROFILE_FIXTURE);
      mockIcpAndMomTestInvokes(invoke);

      const result = await service.extractIcp({
        personIdentifier: 'gaurav-sherlocks-ai',
        companyIdentifier: 'sherlocks-ai',
        ...baseAuth,
      });
      console.log('extractIcp unipile-fetch result contextUsed:', result.contextUsed);

      expect(withOutreachLinkedinSession).toHaveBeenCalled();
      expect(fetchLinkedinUserProfile).toHaveBeenCalledWith(
        'unipile-account-1',
        'gaurav-sherlocks-ai',
        expect.objectContaining({ linkedinSections: ['*'] }),
      );
      expect(getCompanyProfile).toHaveBeenCalledWith(
        'sherlocks-ai',
        'unipile-account-1',
      );
      expect(result.contextUsed.personSource).toBe('unipile');
      expect(result.contextUsed.companySource).toBe('unipile');
      expect(result.contextUsed.momTestQuestionsGenerated).toBe(true);
    });

    it('derives the company from the person\'s current role when only personIdentifier is given', async () => {
      fetchLinkedinUserProfile.mockResolvedValueOnce(PERSON_PROFILE_FIXTURE);
      getCompanyProfile.mockResolvedValueOnce(COMPANY_PROFILE_FIXTURE);
      mockIcpAndMomTestInvokes(invoke);

      const result = await service.extractIcp({
        personIdentifier: 'gaurav-sherlocks-ai',
        ...baseAuth,
      });
      console.log(
        'extractIcp person-only result contextUsed:',
        result.contextUsed,
      );

      expect(getCompanyProfile).toHaveBeenCalledWith(
        '105905196',
        'unipile-account-1',
      );
      expect(result.contextUsed.companySource).toBe('derived_from_person');
      expect(result.contextUsed.derivedCompanyIdentifier).toBe('105905196');
    });

    it('falls back to person-only extraction when the company cannot be derived', async () => {
      fetchLinkedinUserProfile.mockResolvedValueOnce({
        ...PERSON_PROFILE_FIXTURE,
        work_experience: [],
      });
      mockIcpAndMomTestInvokes(invoke);

      const result = await service.extractIcp({
        personIdentifier: 'someone-without-experience',
        ...baseAuth,
      });
      console.log('extractIcp person-only result:', result.contextUsed);

      expect(getCompanyProfile).not.toHaveBeenCalled();
      expect(result.contextUsed.companySource).toBe('person_only');
      expect(result.contextUsed.derivedCompanyIdentifier).toBeUndefined();

      const icpCall = invoke.mock.calls.find(
        (call) => typeof call[0] === 'string',
      );
      const prompt = icpCall?.[0] as string;
      expect(prompt).toContain('Company profile: NOT AVAILABLE');
      expect(prompt).toContain('headline, summary');
    });

    it('falls back to person-only extraction when the derived company fetch fails', async () => {
      fetchLinkedinUserProfile.mockResolvedValueOnce(PERSON_PROFILE_FIXTURE);
      getCompanyProfile.mockResolvedValueOnce(null);
      mockIcpAndMomTestInvokes(invoke);

      const result = await service.extractIcp({
        personIdentifier: 'gaurav-sherlocks-ai',
        ...baseAuth,
      });
      console.log('extractIcp derived-fetch-failed result:', result.contextUsed);

      expect(getCompanyProfile).toHaveBeenCalledWith(
        '105905196',
        'unipile-account-1',
      );
      expect(result.contextUsed.companySource).toBe('person_only');
      expect(result.contextUsed.derivedCompanyIdentifier).toBe('105905196');

      const icpCall = invoke.mock.calls.find(
        (call) => typeof call[0] === 'string',
      );
      const prompt = icpCall?.[0] as string;
      expect(prompt).toContain('Company profile: NOT AVAILABLE');
    });

    it('still throws when an explicitly provided companyIdentifier cannot be fetched', async () => {
      fetchLinkedinUserProfile.mockResolvedValueOnce(PERSON_PROFILE_FIXTURE);
      getCompanyProfile.mockResolvedValueOnce(null);
      console.log('extractIcp explicit-company-fetch-failed test');
      await expect(
        service.extractIcp({
          personIdentifier: 'gaurav-sherlocks-ai',
          companyIdentifier: 'does-not-exist',
          ...baseAuth,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('includes posts in the prompt when includePosts is true', async () => {
      fetchLinkedinUserProfile.mockResolvedValueOnce(PERSON_PROFILE_FIXTURE);
      getCompanyProfile.mockResolvedValueOnce(COMPANY_PROFILE_FIXTURE);
      fetchLinkedinUserPosts.mockResolvedValueOnce({
        items: [{ text: 'We just shipped agentic RCA for Kubernetes!' }],
      });
      mockIcpAndMomTestInvokes(invoke);

      const result = await service.extractIcp({
        personIdentifier: 'gaurav-sherlocks-ai',
        companyIdentifier: 'sherlocks-ai',
        includePosts: true,
        ...baseAuth,
      });
      console.log('extractIcp with posts postsCount:', result.contextUsed.postsCount);

      expect(fetchLinkedinUserPosts).toHaveBeenCalled();
      expect(result.contextUsed.postsCount).toBe(1);
      const icpCall = invoke.mock.calls.find(
        (call) => typeof call[0] === 'string',
      );
      const prompt = icpCall?.[0] as string;
      expect(prompt).toContain('agentic RCA for Kubernetes');
    });

    it('rejects malformed LLM output via zod', async () => {
      invoke.mockImplementation(async (input: unknown) => {
        if (Array.isArray(input)) {
          return { content: VALID_MOM_TEST_LLM_JSON };
        }
        return { content: JSON.stringify({ sells: 'x' }) };
      });
      console.log('extractIcp malformed LLM output test');
      await expect(
        service.extractIcp({
          personProfile: PERSON_PROFILE_FIXTURE,
          companyProfile: COMPANY_PROFILE_FIXTURE,
          ...baseAuth,
        }),
      ).rejects.toThrow();
    });
  });

  describe('fetchIcpCandidates', () => {
    it('fetches, maps, and ranks Apollo organizations', async () => {
      organizationsSearch.mockResolvedValueOnce({
        organizations: [
          {
            id: 'org-1',
            name: 'Acme Corp',
            industry: 'financial services',
            estimated_num_employees: 800,
            city: 'New York',
            country: 'United States',
            primary_domain: 'acme.com',
            linkedin_url: 'https://www.linkedin.com/company/acme',
            keywords: ['kubernetes', 'datadog'],
          },
        ],
      });
      invoke.mockResolvedValueOnce({ content: VALID_RANKING_LLM_JSON });

      const result = await service.fetchIcpCandidates({
        icp: ICP_FIXTURE,
        chartFunction: 'Engineering/Platform',
        source: 'apollo',
        ...baseAuth,
      });
      console.log('fetchIcpCandidates apollo result:', JSON.stringify(result, null, 2));

      expect(organizationsSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_num_employees_ranges: ['200,2000'],
          q_organization_keyword_tags: expect.arrayContaining(['B2B SaaS', 'Kubernetes']),
        }),
      );
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0]).toMatchObject({
        name: 'Acme Corp',
        source: 'apollo',
        domain: 'acme.com',
        employeeCount: 800,
      });
      expect(result.ranking?.proceed).toBe(true);
      expect(result.ranking?.ranked_candidates[0].company_name).toBe('Acme Corp');
    });

    it('fetches and maps Sales Navigator companies with headcount buckets', async () => {
      searchCompaniesSalesNavigator.mockResolvedValueOnce({
        object: 'LinkedinSearch',
        items: [
          {
            object: 'SearchResult',
            type: 'COMPANY',
            id: 'c-1',
            name: 'Beta Systems',
            location: 'Berlin',
            profile_url: 'https://www.linkedin.com/company/beta-systems',
            industry: 'Software Development',
            summary: null,
            followers_count: 1000,
            job_offers_count: 3,
            headcount: '501-1000',
          },
        ],
        config: { params: {} },
        paging: { start: 0, page_count: 1, total_count: 1 },
        cursor: null,
      });
      invoke.mockResolvedValueOnce({ content: VALID_RANKING_LLM_JSON });

      const result = await service.fetchIcpCandidates({
        icp: ICP_FIXTURE,
        source: 'sales_navigator',
        ...baseAuth,
      });
      console.log('fetchIcpCandidates sales_navigator result:', JSON.stringify(result, null, 2));

      expect(withOutreachLinkedinSession).toHaveBeenCalled();
      expect(searchCompaniesSalesNavigator).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: 'Kubernetes OR Datadog OR Prometheus',
          headcount: [
            { min: 51, max: 200 },
            { min: 201, max: 500 },
            { min: 501, max: 1000 },
            { min: 1001, max: 5000 },
          ],
        }),
        'unipile-account-1',
        { limit: 10 },
      );
      expect(result.candidates[0]).toMatchObject({
        name: 'Beta Systems',
        source: 'sales_navigator',
        headcount: '501-1000',
      });
    });

    it('skips ranking when rank=false', async () => {
      organizationsSearch.mockResolvedValueOnce({ organizations: [] });

      const result = await service.fetchIcpCandidates({
        icp: ICP_FIXTURE,
        source: 'apollo',
        rank: false,
        ...baseAuth,
      });
      console.log('fetchIcpCandidates rank=false result:', result);

      expect(result.candidates).toHaveLength(0);
      expect(result.ranking).toBeUndefined();
      expect(invoke).not.toHaveBeenCalled();
    });

    it('throws when ICP has no searchable signals and no keywords override', async () => {
      console.log('fetchIcpCandidates empty-signals test');
      await expect(
        service.fetchIcpCandidates({
          icp: { ...ICP_FIXTURE, tech_stack_signals: [], industry: [] },
          source: 'apollo',
          ...baseAuth,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('extractIcpFromResume', () => {
    it('throws when neither resume file nor resumeText is provided', async () => {
      console.log('extractIcpFromResume missing-input test');
      await expect(
        service.extractIcpFromResume({ ...baseAuth }),
      ).rejects.toThrow(BadRequestException);
    });

    it('delegates to LinkedIn extractIcp when resume contains a LinkedIn URL', async () => {
      parseResumeText.mockResolvedValueOnce({
        fullName: 'Prince Kumar',
        email: 'prince@example.com',
        linkedinUrl: 'https://www.linkedin.com/in/prince-kumar',
        workExperience: [
          { company: 'Acme Corp', jobTitle: 'Account Executive' },
        ],
      });
      fetchLinkedinUserProfile.mockResolvedValueOnce(PERSON_PROFILE_FIXTURE);
      getCompanyProfile.mockResolvedValueOnce(COMPANY_PROFILE_FIXTURE);
      mockIcpAndMomTestInvokes(invoke);

      const result = await service.extractIcpFromResume({
        resumeText:
          'Prince Kumar\nhttps://www.linkedin.com/in/prince-kumar\nAE at Acme',
        ...baseAuth,
      });
      console.log(
        'extractIcpFromResume linkedin path contextUsed:',
        result.contextUsed,
      );

      expect(parseResumeText).toHaveBeenCalled();
      expect(withOutreachLinkedinSession).toHaveBeenCalled();
      expect(result.parsedResume).toEqual({
        name: 'Prince Kumar',
        email: 'prince@example.com',
        linkedinUrl: 'https://www.linkedin.com/in/prince-kumar',
        currentCompany: 'Acme Corp',
        currentRole: 'Account Executive',
      });
      expect(result.contextUsed.linkedinUrlFromResume).toBe(
        'https://www.linkedin.com/in/prince-kumar',
      );
      expect(result.contextUsed.resumeFileName).toBe('resume.txt');
      expect(result.relevant_recipient_for_target_account_lure).toBe(true);
    });

    it('uses parsed resume + company websearch when no LinkedIn URL is present', async () => {
      parseResumeText.mockResolvedValueOnce({
        fullName: 'Prince Kumar',
        location: 'Bangalore',
        workExperience: [
          {
            company: 'Acme Corp',
            jobTitle: 'Account Executive',
            jobSummary: 'Sells CRM to mid-market',
          },
        ],
        skills: 'Salesforce, HubSpot',
      });
      jest
        .spyOn(service as never, 'fetchCompanyProfileViaWebSearch' as never)
        .mockResolvedValue({
          name: 'Acme Corp',
          description: 'B2B CRM platform for mid-market sales teams',
          industry: 'SaaS',
          employee_count: 120,
          website: 'https://acme.example',
          headquarters: 'Bangalore',
          products_services: 'CRM',
          linkedin_url: null,
          notes: 'Matched via web search',
        } as never);
      mockIcpAndMomTestInvokes(invoke);

      const result = await service.extractIcpFromResume({
        resumeText:
          'Prince Kumar\nAccount Executive at Acme Corp\nBangalore\nNo LinkedIn listed',
        includeMomTestQuestions: true,
        ...baseAuth,
      });
      console.log(
        'extractIcpFromResume websearch path contextUsed:',
        result.contextUsed,
      );

      expect(result.contextUsed.personSource).toBe('resume');
      expect(result.contextUsed.companySource).toBe('web_search');
      expect(result.contextUsed.linkedinUrlFromResume).toBeUndefined();
      expect(result.parsedResume.linkedinUrl).toBeNull();
      expect(result.parsedResume.currentCompany).toBe('Acme Corp');
      expect(result.momTestQuestions?.core_questions.length).toBeGreaterThanOrEqual(
        4,
      );

      const icpCall = invoke.mock.calls.find(
        (call) => typeof call[0] === 'string',
      );
      const prompt = icpCall?.[0] as string;
      expect(prompt).toContain('Acme Corp');
      expect(prompt).toContain('B2B CRM platform');
    });
    it('reads and parses a resume from a local file path', async () => {
      readAndParseResumeFile.mockResolvedValueOnce({
        content: {
          text: 'Prince Kumar\nAccount Executive at Acme Corp\nBangalore',
          fileName: 'Prince cv 26.pdf',
        },
        parsed: {
          fullName: 'Prince Kumar',
          workExperience: [
            { company: 'Acme Corp', jobTitle: 'Account Executive' },
          ],
        },
      });
      jest
        .spyOn(service as never, 'fetchCompanyProfileViaWebSearch' as never)
        .mockResolvedValue({
          name: 'Acme Corp',
          description: 'B2B CRM',
          industry: 'SaaS',
          employee_count: 120,
          website: 'https://acme.example',
          headquarters: 'Bangalore',
          products_services: 'CRM',
          linkedin_url: null,
          notes: 'Matched via web search',
        } as never);
      mockIcpAndMomTestInvokes(invoke);

      const result = await service.extractIcpFromResume({
        resumeFilePath: '/Users/arnavsaxena/Downloads/Prince cv 26.pdf',
        ...baseAuth,
      });
      console.log(
        'extractIcpFromResume file path contextUsed:',
        result.contextUsed,
      );

      expect(readAndParseResumeFile).toHaveBeenCalledWith(
        '/Users/arnavsaxena/Downloads/Prince cv 26.pdf',
      );
      expect(parseResumeText).not.toHaveBeenCalled();
      expect(result.contextUsed.resumeFileName).toBe('Prince cv 26.pdf');
      expect(result.parsedResume.currentCompany).toBe('Acme Corp');
    });
  });
});
