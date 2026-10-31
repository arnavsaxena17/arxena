import { Injectable, Logger, Optional } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';

import { AI_TELEMETRY_CONFIG } from 'src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import {
  AiSdkExecutionService,
  runGenerateObject,
} from 'src/engine/metadata-modules/ai/ai-billing/services/ai-sdk-execution.service';
import { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

const JUDGE_TIMEOUT_MS = 45_000;
const JUDGE_MAX_OUTPUT_TOKENS = 4_000;
const MAX_CANDIDATES = 40;

export type CandidateToJudge = {
  id: string;
  name: string;
  title: string;
  companyName: string;
  // Text the candidate was read from (result title, snippet, page sentence)
  evidence: string;
};

export type CompanyRelation = 'same' | 'related' | 'different' | 'unknown';
export type RoleFit = 'exact' | 'related' | 'none';

export type CandidateVerdict = {
  company: CompanyRelation;
  // Why, e.g. which parent, brand or franchise link joins the two companies
  companyNote: string;
  role: RoleFit;
  roleNote: string;
};

// Strict structured-output providers need every key present
const verdictSchema = z.object({
  verdicts: z.array(
    z.object({
      index: z.number().int(),
      company: z.enum(['same', 'related', 'different', 'unknown']),
      // What supports a "related" answer; "none" when nothing does
      companyLinkBasis: z.enum(['evidence', 'known_fact', 'none']),
      companyNote: z.string(),
      role: z.enum(['exact', 'related', 'none']),
      roleNote: z.string(),
    }),
  ),
});

const SYSTEM_PROMPT = `You judge whether people found by search are the people a user is looking for: someone who holds a given role at a given company.
For every candidate answer two questions.

1. company: how is the company on the candidate's profile (or in their evidence) related to the target company?
- same: the target itself, or the same business under another name: a brand, trade name, legal name, former name or regional unit.
- related: a parent, subsidiary, group company, joint venture, master franchisee or licensee, or the company that operates the target's brand. A person can hold positions at several related companies, so someone at the parent who is tied to the target (founded it, ran it, sits on its board, led it) is related.
- different: clearly an unrelated business, or a namesake who works elsewhere.
- unknown: the candidate gives no company and nothing connects them to the target.
Use what the evidence says and what you reliably know about these companies. If you are not sure two companies are linked, answer unknown, never related. Put the link you relied on in companyNote, in one short sentence. companyLinkBasis says what supports a "related" answer: evidence (the candidate's own text states the link), known_fact (a relationship you are certain is documented), or none. A shared word in two names is not a link. If the basis is none the answer is unknown, not related.

2. role: does the candidate hold one of the wanted roles now?
- exact: the wanted role or the same position under another title (CEO = chief executive officer = group CEO = MD and CEO; managing director = MD = whole-time director and CEO). A title that holds the wanted role together with others is exact: Founder & CEO is a CEO, Chairman & Managing Director is a managing director.
- related: a nearby senior role: deputy, vice, acting, executive chair, co-founder or founder when it was not asked for, another C-suite officer. When the wanted role joins two functions ("Head of Supply Chain & Logistics"), a title that leads either of them ("Head of Logistics", "Head of Procurement") is related, not none. When the wanted role names one function, a title that leads a different function in the same department is not related: "Head of Logistics" is none for "Head of Supply Chain". An explicitly equivalent title is exact (an industrial "Head of Operations" for "Head of Manufacturing").
- none: any other role, a former role, or no role stated.
Put the reason in roleNote, in one short sentence.

Judge each candidate on its own. Never invent facts that the evidence and your reliable knowledge do not support.`;

@Injectable()
export class CandidateJudgeService {
  private readonly logger = new Logger(CandidateJudgeService.name);

  constructor(
    @Optional()
    private readonly aiModelRegistryService?: AiModelRegistryService,
    @Optional()
    private readonly aiSdkExecutionService?: AiSdkExecutionService,
  ) {}

  // A model reads each candidate against the target company instead of a name
  // being matched as text, so "the brand", "the operator" and "the parent" are
  // understood to be linked. Keyed by candidate id; a candidate the model skips
  // has no entry.
  async judge({
    workspaceId,
    company,
    alternateNames,
    roles,
    candidates,
  }: {
    workspaceId: string;
    company: string;
    alternateNames: string[];
    roles: string[];
    candidates: CandidateToJudge[];
  }): Promise<Map<string, CandidateVerdict>> {
    const verdicts = new Map<string, CandidateVerdict>();
    const judged = candidates.slice(0, MAX_CANDIDATES);

    if (judged.length === 0) {
      return verdicts;
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
        schema: verdictSchema,
        system: SYSTEM_PROMPT,
        prompt: [
          `Target company: ${company}`,
          alternateNames.length > 0
            ? `Also known as: ${alternateNames.join('; ')}`
            : null,
          `Wanted roles: ${roles.join(', ')}`,
          'Candidates:',
          ...judged.map(
            (candidate, index) =>
              `${index}. ${candidate.name} | title: ${candidate.title || '(none)'} | company on profile: ${candidate.companyName || '(none)'} | evidence: ${candidate.evidence.slice(0, 300) || '(none)'}`,
          ),
        ]
          .filter((line): line is string => line !== null)
          .join('\n'),
        maxOutputTokens: JUDGE_MAX_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(JUDGE_TIMEOUT_MS),
        providerOptions: { openrouter: { reasoning: { enabled: false } } },
        experimental_telemetry: AI_TELEMETRY_CONFIG,
      },
    });

    for (const verdict of verdictSchema.parse(response.object).verdicts) {
      const candidate = judged[verdict.index];

      if (isDefined(candidate)) {
        verdicts.set(candidate.id, {
          // "Related" with nothing behind it is a guess, and a guess is unknown
          company:
            verdict.company === 'related' && verdict.companyLinkBasis === 'none'
              ? 'unknown'
              : verdict.company,
          companyNote: verdict.companyNote.trim(),
          role: verdict.role,
          roleNote: verdict.roleNote.trim(),
        });
      }
    }

    this.logger.log(
      `Judged ${verdicts.size} of ${judged.length} candidates for "${company}"`,
    );

    return verdicts;
  }
}
