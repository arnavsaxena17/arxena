import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import type { SearchType } from './constants';
import { buildEvalPrompt } from './prompts/eval-prompt';
import type { AnySearchRequest } from './schemas';

export interface ScoreBreakdown {
  dim1: number;  // Stem quality          0–3
  dim2: number;  // Filter assignment     0–4
  dim3: number;  // Archetype coverage    0–2
  dim4: number;  // Signal completeness   0–1
  dim5: number;  // Location quality      0–2
  dim6: number;  // Keyword discipline    0–2  (primary over-narrowing penalty)
  total: number; // max 14
  weaknesses?: string[];              // LLM-identified weaknesses
  reasoning?: Record<string, string>; // LLM reasoning per dimension
  verdict?: string;                   // LLM overall verdict
}

// Judge model — using gpt-4.1 (stronger + avoids same-family leniency vs generation models)
export const EVAL_MODEL = 'gpt-4.1';

// ── Zod schema for structured eval response ──
const evalResultSchema = z.object({
  requirementPattern:  z.enum(['A','B','C','D']),
  weaknesses:          z.array(z.string()).min(0).max(6),
  stemQuality:         z.object({ score: z.number().int().min(0).max(3), reasoning: z.string().max(300) }),
  filterAssignment:    z.object({ score: z.number().int().min(0).max(4), reasoning: z.string().max(400) }),
  archetypeCoverage:   z.object({ score: z.number().int().min(0).max(2), reasoning: z.string().max(300) }),
  signalCompleteness:  z.object({ score: z.number().int().min(0).max(1), reasoning: z.string().max(200) }),
  locationQuality:     z.object({ score: z.number().int().min(0).max(2), reasoning: z.string().max(300) }),
  keywordDiscipline:   z.object({ score: z.number().int().min(0).max(2), reasoning: z.string().max(300) }),
  total:   z.number().int().min(0).max(14),
  verdict: z.string().max(300),
});
// ── Search-type-specific eval rubric (injected as system prompt for the judge) ──




// ── Async LLM judge call ──────────────────────────────────────────────────────
export async function scoreRequestsWithLLM(
  openaiClient: OpenAI,
  reqs: AnySearchRequest[],
  searchType: SearchType,
  requirementText: string,
): Promise<{ score: ScoreBreakdown; evalTokens: { input: number; output: number } }> {
  const systemPrompt = buildEvalPrompt(searchType);
  const userMessage  =
    `RECRUITER REQUIREMENT:\n${requirementText}\n\n` +
    `GENERATED QUERIES (${searchType}):\n${JSON.stringify(reqs, null, 2)}\n\n` +
    `Follow the REQUIRED PROCESS: (1) identify pattern, (2) list weaknesses, ` +
    `(3) score all 6 dimensions, (4) verify total = sum of all 6 scores (max 14).`;

  const doCall = async () => openaiClient.chat.completions.create({
    model:           EVAL_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage  },
    ],
    response_format: zodResponseFormat(evalResultSchema, 'eval_result'),
    temperature:     0,
    max_tokens:      6000,
  });

  let completion = await doCall();
  // Retry once if the response is truncated / empty
  if (!completion.choices[0]?.message?.content) {
    completion = await doCall();
  }

  const raw = completion.choices[0]?.message?.content ?? '{}';
  const parsed = evalResultSchema.parse(JSON.parse(raw));
  const evalTokens = {
    input:  completion.usage?.prompt_tokens     ?? 0,
    output: completion.usage?.completion_tokens ?? 0,
  };

  const MAX_TOTAL = 14;
  const score: ScoreBreakdown = {
    dim1:  parsed.stemQuality.score,
    dim2:  parsed.filterAssignment.score,
    dim3:  parsed.archetypeCoverage.score,
    dim4:  parsed.signalCompleteness.score,
    dim5:  parsed.locationQuality.score,
    dim6:  parsed.keywordDiscipline.score,
    total: Math.min(parsed.total,
      parsed.stemQuality.score + parsed.filterAssignment.score + parsed.archetypeCoverage.score +
      parsed.signalCompleteness.score + parsed.locationQuality.score + parsed.keywordDiscipline.score,
      MAX_TOTAL,
    ),
    weaknesses: parsed.weaknesses,
    reasoning: {
      stemQuality:        parsed.stemQuality.reasoning,
      filterAssignment:   parsed.filterAssignment.reasoning,
      archetypeCoverage:  parsed.archetypeCoverage.reasoning,
      signalCompleteness: parsed.signalCompleteness.reasoning,
      locationQuality:    parsed.locationQuality.reasoning,
      keywordDiscipline:  parsed.keywordDiscipline.reasoning,
    },
    verdict: parsed.verdict,
  };

  return { score, evalTokens };
}
