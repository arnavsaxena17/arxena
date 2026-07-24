/**
 * Live end-to-end checks for the ICP extraction + candidate fetch controllers
 * against a running twenty-server. Skipped unless ICP_LIVE_E2E=1.
 *
 * Prerequisites:
 *   - Server running on ICP_LIVE_BASE_URL (default http://localhost:3000)
 *     with OPENAI/LLM, Unipile, and (optionally) Apollo configured
 *   - ICP_LIVE_API_TOKEN=<Bearer JWT used by the app>
 *
 * Run:
 *   ICP_LIVE_E2E=1 ICP_LIVE_API_TOKEN=... \
 *     yarn nx run twenty-server:test --testPathPattern=icp-outreach.live --skip-nx-cache
 *
 * Apollo candidate search consumes 1 Apollo credit per call, so it is gated
 * separately behind ICP_LIVE_EXERCISE_APOLLO=1.
 */

const LIVE = process.env.ICP_LIVE_E2E === '1';
const describeLive = LIVE ? describe : describe.skip;

const PERSON_PROFILE: Record<string, unknown> = {
  object: 'UserProfile',
  provider: 'LINKEDIN',
  provider_id: 'ACoAAAHU7vABvj0KTKkaLOIc5El2eMWE5aLnPq4',
  public_identifier: 'gaurav-sherlocks-ai',
  first_name: 'Gaurav',
  last_name: 'Toshniwal',
  headline:
    'Alerts / Tickets → Root Cause → Fix... in Minutes | Co-founder @Sherlocks.ai | Ex-CTO at Doubtnut (50M+ users)',
  location: 'San Francisco, California, United States',
  follower_count: 11284,
  connections_count: 8220,
  work_experience: [
    {
      company_id: '105905196',
      company: 'Sherlocks.ai',
      position: 'Founder',
      location: 'San Francisco Bay Area, Mumbai · Hybrid',
      description:
        "We're building AI that thinks like an SRE, works like a beast, and never needs coffee (but you still can). Less firefighting, more winning. If your infra's playing games, we're here to outsmart it. Let's talk AI, ops, and the future of reliability.",
      status: 'Full-time',
      skills: ['Site Reliability Engineering', 'On-call Support', 'DevOps'],
      start: '1/1/2025',
      end: null,
    },
    {
      company_id: '13222185',
      company: 'Doubtnut',
      position: 'Chief Technology Officer',
      location: 'Gurugram, Haryana, India',
      status: 'Full-time',
      skills: ['Node.js', 'Kubernetes', 'AWS', 'DevOps', 'Microservices'],
      start: '11/1/2019',
      end: '1/1/2025',
    },
  ],
};

const COMPANY_PROFILE: Record<string, unknown> = {
  object: 'CompanyProfile',
  id: '105905196',
  name: 'Sherlocks.ai',
  description:
    "Every production incident has a culprit. We built a detective agency to find it.\n\nSherlocks.ai is an agentic AI SRE platform. When an alert fires, our agents don't wait for a human to open six dashboards and start guessing. They investigate immediately: correlate signals across your stack, test hypotheses like a senior engineer would, and deliver root cause with clear next steps. Minutes, not hours.\n\n16+ specialized agents across Kubernetes, databases, networks, cloud infra, CI/CD. 30+ integrations. Read-only access, always. 70% less downtime. 90% less alert noise. SOC 2 Type 2 certified. Data stays in your VPC.",
  public_identifier: 'sherlocks-ai',
  tagline: 'The best (SRE) Investigators',
  activities: [
    'SRE',
    'Site Reliability',
    'AI',
    'incident management',
    'AIOps',
    'Observability',
    'Devops',
    'MTTR Reduction',
    'Incident Response',
    'Alert management',
    'Reliability Automation',
    'Agentic AI',
    'ITOps',
  ],
  website: 'https://www.sherlocks.ai',
  foundation_date: '01/01/2025',
  employee_count: 10,
  industry: ['IT System Operations and Maintenance'],
  locations: [
    {
      is_headquarter: true,
      city: 'Palo Alto',
      country: 'US',
      area: 'California',
    },
  ],
};

type IcpResponse = {
  sells: string;
  relevant_recipient_for_target_account_lure: boolean;
  reasoning: string;
  icp: {
    industry: string[];
    employee_range: string;
    tech_stack_signals: string[];
    buyer_titles: string[];
    pain_signals: string[];
  };
  chart_function: string | null;
  momTestQuestions?: {
    persona_read: string;
    core_questions: Array<{
      question: string;
      tag: string;
      listen_for: string;
    }>;
    money_probes: Array<{ question: string; tag: string }>;
    trap_check: string;
  };
  contextUsed: Record<string, unknown>;
};

describeLive('ICP outreach controllers live E2E (localhost server)', () => {
  jest.setTimeout(300_000);

  const baseUrl = (
    process.env.ICP_LIVE_BASE_URL ?? 'http://localhost:3000'
  ).replace(/\/+$/, '');
  const apiToken = process.env.ICP_LIVE_API_TOKEN ?? '';

  let extractedIcp: IcpResponse | null = null;

  beforeAll(() => {
    if (!apiToken) {
      throw new Error('ICP_LIVE_API_TOKEN is required when ICP_LIVE_E2E=1');
    }
  });

  const authHeaders = (): Record<string, string> => ({
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  });

  it('POST /org-chart-outreach/icp/extract returns a screened ICP for Gaurav @ Sherlocks.ai', async () => {
    console.log('icp/extract: sending request to', `${baseUrl}/org-chart-outreach/icp/extract`);
    const res = await fetch(`${baseUrl}/org-chart-outreach/icp/extract`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        personProfile: PERSON_PROFILE,
        companyProfile: COMPANY_PROFILE,
      }),
    });
    const json = (await res.json()) as IcpResponse;
    console.log('icp/extract: status', res.status);
    console.log('icp/extract: response', JSON.stringify(json, null, 2));

    expect(res.ok).toBe(true);
    expect(typeof json.sells).toBe('string');
    expect(json.sells.length).toBeGreaterThan(0);
    // Co-founder at a 10-person startup pitching in his summary: clean TRUE case.
    expect(json.relevant_recipient_for_target_account_lure).toBe(true);
    expect(typeof json.reasoning).toBe('string');
    expect(Array.isArray(json.icp.industry)).toBe(true);
    expect(Array.isArray(json.icp.buyer_titles)).toBe(true);
    expect(json.icp.buyer_titles.length).toBeGreaterThan(0);
    expect(typeof json.icp.employee_range).toBe('string');
    expect(typeof json.chart_function).toBe('string');
    // An SRE tool should chart an engineering/infra function, not Sales.
    expect((json.chart_function ?? '').toLowerCase()).not.toContain('sales');

    expect(json.momTestQuestions).toBeDefined();
    expect(json.momTestQuestions?.persona_read.length).toBeGreaterThan(0);
    expect(json.momTestQuestions?.core_questions.length).toBeGreaterThanOrEqual(
      4,
    );
    expect(json.momTestQuestions?.money_probes.length).toBeGreaterThanOrEqual(2);
    expect(json.momTestQuestions?.trap_check.length).toBeGreaterThan(0);
    console.log(
      'icp/extract momTestQuestions persona:',
      json.momTestQuestions?.persona_read,
    );

    extractedIcp = json;
  });

  it('POST /org-chart-outreach/icp/extract rejects a body without person or company', async () => {
    console.log('icp/extract: sending invalid request (no inputs)');
    const res = await fetch(`${baseUrl}/org-chart-outreach/icp/extract`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    const json = (await res.json()) as Record<string, unknown>;
    console.log('icp/extract invalid: status', res.status, 'body', json);
    expect(res.status).toBe(400);
  });

  it('POST /org-chart-outreach/icp/candidates fetches + ranks via Sales Navigator (free)', async () => {
    const icp = extractedIcp?.icp ?? {
      industry: ['B2B SaaS'],
      employee_range: '200-2000',
      tech_stack_signals: ['Kubernetes', 'Datadog'],
      buyer_titles: ['VP Engineering', 'Head of SRE'],
      pain_signals: ['on-call fatigue', 'high MTTR'],
    };
    console.log('icp/candidates (sales_navigator): using ICP', JSON.stringify(icp, null, 2));

    const res = await fetch(`${baseUrl}/org-chart-outreach/icp/candidates`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        icp,
        chartFunction: extractedIcp?.chart_function ?? 'Engineering/Platform',
        source: 'sales_navigator',
        limit: 10,
      }),
    });
    const json = (await res.json()) as Record<string, unknown>;
    console.log('icp/candidates (sales_navigator): status', res.status);
    console.log('icp/candidates (sales_navigator): response', JSON.stringify(json, null, 2));

    expect(res.ok).toBe(true);
    expect(json.source).toBe('sales_navigator');
    expect(Array.isArray(json.candidates)).toBe(true);
    if ((json.candidates as unknown[]).length > 0) {
      const ranking = json.ranking as {
        proceed: boolean;
        ranked_candidates: Array<{ company_name: string }>;
      };
      expect(ranking).toBeDefined();
      expect(ranking.ranked_candidates.length).toBeGreaterThan(0);
      expect(ranking.ranked_candidates.length).toBeLessThanOrEqual(3);
    }
  });

  const itApollo =
    process.env.ICP_LIVE_EXERCISE_APOLLO === '1' ? it : it.skip;

  itApollo(
    'POST /org-chart-outreach/icp/candidates fetches + ranks via Apollo (consumes 1 credit)',
    async () => {
      const icp = extractedIcp?.icp ?? {
        industry: ['B2B SaaS'],
        employee_range: '200-2000',
        tech_stack_signals: ['Kubernetes', 'Datadog'],
        buyer_titles: ['VP Engineering', 'Head of SRE'],
        pain_signals: ['on-call fatigue', 'high MTTR'],
      };
      console.log('icp/candidates (apollo): using ICP', JSON.stringify(icp, null, 2));

      const res = await fetch(`${baseUrl}/org-chart-outreach/icp/candidates`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          icp,
          chartFunction: extractedIcp?.chart_function ?? 'Engineering/Platform',
          source: 'apollo',
          limit: 10,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      console.log('icp/candidates (apollo): status', res.status);
      console.log('icp/candidates (apollo): response', JSON.stringify(json, null, 2));

      expect(res.ok).toBe(true);
      expect(json.source).toBe('apollo');
      expect(Array.isArray(json.candidates)).toBe(true);
    },
  );

  it('rejects requests without an auth token', async () => {
    console.log('icp/extract: sending unauthenticated request');
    const res = await fetch(`${baseUrl}/org-chart-outreach/icp/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personProfile: PERSON_PROFILE,
        companyProfile: COMPANY_PROFILE,
      }),
    });
    console.log('icp/extract unauthenticated: status', res.status);
    expect([401, 403]).toContain(res.status);
  });
});
