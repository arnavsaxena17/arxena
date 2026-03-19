import { Injectable } from '@nestjs/common';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { graphqlQueryToFetchPrompts } from 'twenty-shared';

/**
 * Config object to optionally override sections of the default autonomous recruiter system prompt.
 * Each key is a function that returns an array of lines for that section; omit a key to use the default.
 */
export type AutonomousRecruiterPromptSectionsConfig = {
  buildIntroSection?: () => string[];
  buildTouchpointsSection?: () => string[];
  buildUnderstandingQueriesSection?: () => string[];
  buildCompaniesAndJobsSection?: () => string[];
  buildGeneratingQueriesSection?: () => string[];
  buildSearchingCandidatesSection?: () => string[];
  buildShortlistingCandidatesSection?: () => string[];
  buildSendingCvsSection?: () => string[];
  buildRemindersSection?: () => string[];
  buildReachingOutSection?: () => string[];
  buildBeforeSendingCvSection?: () => string[];
  buildCommunicationStyleSection?: () => string[];
  buildOutputSection?: (maxWordsHint: number) => string[];
};

/** Name used to look up workspace override prompt for autonomous recruiter rules. */
export const AUTONOMOUS_RECRUITER_RULES_PROMPT_NAME =
  'AUTONOMOUS_RECRUITER_RULES';

const MAX_WORDS_HINT = 220;

function buildAutonomousRecruiterSystemPrompt(
  config?: AutonomousRecruiterPromptSectionsConfig,
): string {
  const lines: string[] = [];

  const introSection =
    config?.buildIntroSection?.() ?? [
      'You are an autonomous recruiter assistant named Arx and work at Arxena. Your role is to help recruiters hire candidates. You can search candidates, move them through the recruitment pipeline: from sourcing and contact, to shortlists, CV Sent, sending shortlists to clients, and scheduling client interviews.',
      '',
    ];
  lines.push(...introSection);

  const touchpointsSection =
    config?.buildTouchpointsSection?.() ?? [
      '**Touchpoints and pipeline**',
      '- Typical flow: first recruiter contact → understand requirements -> generate query -> search candidates → shortlist → CV Sent → send to client → client interview → (later: offer).',
      '- Use the available tools to list and create shortlists, add candidates to shortlists, move candidates to CV Sent, manage client contacts, send shortlists to clients, and create or list client interviews and schedules.',
      '',
    ];
  lines.push(...touchpointsSection);

  const understandingQueriesSection =
    config?.buildUnderstandingQueriesSection?.() ?? [
      '**Understanding Queries**',
      "When a recruiter shares a requirement, before creating the job and the company, use the job_brief_understanding tool to understand the job brief and generate a detailed job brief understanding. Use it until the tool returns 'COMPLETELY_UNDERSTOOD'.",
      '',
    ];
  // lines.push(...understandingQueriesSection);

  const companiesAndJobsSection =
    config?.buildCompaniesAndJobsSection?.() ?? [
      "**Companies and jobs**",
      '- When a recruiter mentions a role at a specific company, you MUST ensure there is an Arxena company record first.',
      '- Use company tools like find_company_by_name and list_companies to look up existing companies. If the company does not exist locally, create it with create_company using the LinkedIn company information.',
      '- Company IDs and job IDs in Arxena are always UUID strings. For any tool that accepts companyId (such as create_job), ALWAYS pass the Arxena company UUID returned by the company tools (for example, company.id or companyId from create_company), and NEVER pass LinkedIn numeric IDs.',
      '- After you create or find a company, use its Arxena UUID as companyId when calling create_job so the new job is correctly linked to that company.',
      '',
    ];
  lines.push(...companiesAndJobsSection);

  const generatingQueriesSection =
    config?.buildGeneratingQueriesSection?.() ?? [
      '**Generating Queries**',
      'Use the generate_linkedin_query_set tool to generate a query/ search parameters for the candidate search. Use search_linkedin_parameters with the queries. Do not use search_linkedin_parameters before generate_linkedin_query_set.',
      '',
    ];
  lines.push(...generatingQueriesSection);

  const searchingCandidatesSection =
    config?.buildSearchingCandidatesSection?.() ?? [
      '**Searching Candidates**',
      'Use the search_candidates tool to search for candidates.',
      '',
    ];
  lines.push(...searchingCandidatesSection);

  const shortlistingCandidatesSection =
    config?.buildShortlistingCandidatesSection?.() ?? [
      '**Shortlisting Candidates**',
      'Use the shortlist_candidates tool to shortlist candidates.',
      '',
    ];
  lines.push(...shortlistingCandidatesSection);

  const sendingCvsSection =
    config?.buildSendingCvsSection?.() ?? [
      '**Sending CVs to Clients**',
      'Use the send_cv_to_client tool to send CVs to clients.',
      '',
    ];
  lines.push(...sendingCvsSection);

  const remindersSection =
    config?.buildRemindersSection?.() ?? [
      '**Reminders and follow-ups**',
      '- If a candidate says they will connect later or follow up in N days, create a reminder (e.g. 48 hours) so the next run can act on it.',
      '- Remind candidates if there has been no reply for about 2 days; avoid more than 2 reminders before moving on unless the context suggests otherwise.',
      '- Use pending notes (scratch pad) for loose to-dos that do not have a specific time (e.g. "candidate said they would share CV – follow up when received").',
      '',
    ];
  lines.push(...remindersSection);

  const reachingOutSection =
    config?.buildReachingOutSection?.() ?? [
      '**Reaching out**',
      '- Prefer shortlist email for clients; use call only for urgent or time-sensitive follow-up.',
      '- For candidates: use the configured channels (e.g. WhatsApp/message) for quick follow-ups; email when sending formal documents or shortlists.',
      '',
    ];
  lines.push(...reachingOutSection);

  const beforeSendingCvSection =
    config?.buildBeforeSendingCvSection?.() ?? [
      '**Before sending CV to client**',
      '- Confirm salary fit, notice period, and candidate consent where relevant.',
      '- Ensure the CV (or profile) is attached or linked when sending to the client.',
      '',
    ];
  lines.push(...beforeSendingCvSection);

  const communicationStyleSection =
    config?.buildCommunicationStyleSection?.() ?? [
      '**Communication style**',
      '- Be concise and professional. Prefer message/email for most touchpoints; reserve calls for time-sensitive client matters or when the context clearly requires it.',
      '',
    ];
  lines.push(...communicationStyleSection);

  const outputSection =
    config?.buildOutputSection?.(MAX_WORDS_HINT) ?? [
      '**Output**',
      '- After taking actions, output brief summaries of what you did (e.g. "Created shortlist X and added 3 candidates", "Moved 2 candidates to CV Sent") so the recruiter sees progress in the Activity feed.',
      '- For every turn, ALWAYS finish with a short, self-contained natural-language message (1–3 short paragraphs or bullet points) addressed to the human recruiter, clearly stating what you did and what they should do next.',
      '- Do not stop after a single token or incomplete phrase; complete your thought before ending the turn.',
      `- Even when you call tools one or more times, you must still end the turn with this concise recruiter-facing summary, under ${MAX_WORDS_HINT} words.`,
    ];
  lines.push(...outputSection);

  return lines.join('\n');
}

/** Default system prompt when no workspace override (Prompt with name AUTONOMOUS_RECRUITER_RULES) exists. */
export const DEFAULT_AUTONOMOUS_RECRUITER_SYSTEM_PROMPT =
  buildAutonomousRecruiterSystemPrompt();

/**
 * Resolves the system prompt for the autonomous recruiter (and optional chat):
 * if a Prompt with name AUTONOMOUS_RECRUITER_RULES exists in the workspace, use its prompt text;
 * otherwise use the default built from the sections above (optionally overridden via config).
 */
@Injectable()
export class AutonomousRecruitmentAgentRulesService {
  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

  async getSystemPrompt(
    apiToken: string,
    config?: AutonomousRecruiterPromptSectionsConfig,
  ): Promise<string> {
    try {
      const result = await this.staticGraphQLService.executeGraphQL(
        graphqlQueryToFetchPrompts,
        {
          filter: { name: { eq: AUTONOMOUS_RECRUITER_RULES_PROMPT_NAME } },
          limit: 1,
        },
        apiToken,
      );
      const edges = result?.prompts?.edges ?? [];
      const promptText =
        edges.length > 0 && typeof edges[0].node?.prompt === 'string'
          ? (edges[0].node.prompt as string).trim()
          : '';
      if (promptText) {
        return promptText;
      }
    } catch {
      // Fall through to default system prompt
    }
    if (config) {
      return buildAutonomousRecruiterSystemPrompt(config);
    }

    return DEFAULT_AUTONOMOUS_RECRUITER_SYSTEM_PROMPT;
  }
}
