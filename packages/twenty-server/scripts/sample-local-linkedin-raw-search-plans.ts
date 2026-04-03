import { LocalRawSearchPlanner } from 'src/engine/core-modules/linkedin-search/utils/local-raw-search-planner.util';

const accessToken =
  process.env.LINKEDIN_LI_AT?.trim() ??
  'REPLACE_WITH_LI_AT_OR_SET_LINKEDIN_LI_AT';

const session = {
  accountId: 'local-linkedin-account',
  accessToken,
  ip: process.env.LINKEDIN_SESSION_IP?.trim() ?? '127.0.0.1',
  provider: 'LINKEDIN' as const,
  userAgent:
    process.env.LINKEDIN_USER_AGENT?.trim() ??
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
};

const plans = [
  LocalRawSearchPlanner.planPeopleClassicSearch(
    'Arnav Saxena keywords',
    {
      keywords: 'Arnav Saxena',
    },
    session,
    { limit: 10 },
  ),
  LocalRawSearchPlanner.planPeopleClassicSearch(
    'Arnav Saxena first/last name',
    {
      advanced_keywords: {
        first_name: 'Arnav',
        last_name: 'Saxena',
      },
    },
    session,
    { limit: 10 },
  ),
  LocalRawSearchPlanner.planPeopleClassicSearch(
    'Arnav Saxena with title',
    {
      keywords: 'Arnav Saxena recruiter',
      advanced_keywords: {
        first_name: 'Arnav',
        last_name: 'Saxena',
        title: 'Founder',
      },
    },
    session,
    { limit: 10, start: 10 },
  ),
  LocalRawSearchPlanner.planPeopleClassicSearch(
    'People from Unipile',
    {
      advanced_keywords: {
        company: 'Unipile',
      },
    },
    session,
    { limit: 10 },
  ),
  LocalRawSearchPlanner.planPeopleClassicSearch(
    'Unipile plus platform keywords',
    {
      keywords: 'Unipile messaging api',
      advanced_keywords: {
        company: 'Unipile',
      },
    },
    session,
    {
      limit: 10,
      policy: {
        pacing: {
          minDelayMs: 4_000,
          maxDelayMs: 10_000,
          burstSize: 2,
          cooldownMs: 60_000,
        },
      },
    },
  ),
];

for (const plan of plans) {
  console.log(`\n=== ${plan.queryName} ===`);
  console.log(
    JSON.stringify(
      {
        session: plan.session,
        voyager_graphql_url: plan.voyagerGraphqlUrl,
        request_url: plan.request.request_url,
        request_body: plan.request.body,
        scheduling: plan.scheduling,
        retry: plan.operationalPolicy.retry,
        risk: plan.operationalPolicy.risk,
        notes: plan.notes,
      },
      null,
      2,
    ),
  );
}
