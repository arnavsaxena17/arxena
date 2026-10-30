import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import {
  JevDecisionsService,
  type JevDecisionAnswer,
  type JevDecisionQuestion,
} from 'src/engine/core-modules/bright-data/services/jev-decisions.service';
import {
  getFakeProfileThreshold,
  getFitmentThreshold,
  getSamePersonThreshold,
} from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-threshold.util';
import {
  scoreFitment,
  type FitmentCriterion,
  type FitmentResult,
  type FitmentStage,
} from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-score.util';
import { buildFakeProfileInvestigationBrief } from 'src/engine/core-modules/outreach-command/utils/outreach-fake-profile-investigation.util';

// People per Jev call: every person adds four questions
const BATCH_SIZE = 8;
const MAX_BATCHES = 25;
const CONCURRENT_CALLS = 4;
const MAX_PAIRS = 60;
const MAX_CRITERIA = 4;

// Jev is called for every company batch; 50 companies in flight would open
// hundreds of connections at once and the endpoint throttles them. One shared
// window keeps the pipe full without the retry storm.
const DEFAULT_JEV_CONCURRENCY = 12;
const MAX_JEV_CONCURRENCY = 32;

const getJevConcurrency = (): number => {
  const configured = Number(process.env.JEV_CONCURRENCY);

  return Number.isInteger(configured) && configured > 0
    ? Math.min(configured, MAX_JEV_CONCURRENCY)
    : DEFAULT_JEV_CONCURRENCY;
};

let activeJevCalls = 0;
const waitingJevCalls: Array<() => void> = [];

const withJevSlot = async <TResult>(
  task: () => Promise<TResult>,
): Promise<TResult> => {
  if (activeJevCalls >= getJevConcurrency()) {
    await new Promise<void>((resolve) => waitingJevCalls.push(resolve));
  } else {
    activeJevCalls += 1;
  }

  try {
    return await task();
  } finally {
    const next = waitingJevCalls.shift();

    if (isDefined(next)) {
      next();
    } else {
      activeJevCalls -= 1;
    }
  }
};

export type PersonToJudge = {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  // Text the person was read from, when there is no profile
  evidence?: string;
  // The full provider record; its education and experience feed the fake check
  profile?: unknown;
};

export type CompanyRelation = 'same' | 'related' | 'different' | 'unknown';
export type RoleFit = 'exact' | 'related' | 'none';

export type CriterionVerdict = {
  criterion: string;
  verdict: 'match' | 'unknown' | 'mismatch';
};

export type PersonJudgement = {
  company: CompanyRelation;
  companyNote: string;
  role: RoleFit;
  roleNote: string;
  // The user's stated person criteria, read from the profile or evidence
  criteria?: CriterionVerdict[];
  // True when the person matches the search (the place, the company, the role)
  fitsSearch: boolean;
  likelyFake: boolean;
  // The same verdicts through the shared fitment score: fit, company and role
  // are must-haves; a related company or role counts as a pass here, and
  // `company`/`role` still say how close it is
  fitment: FitmentResult;
};

export type PersonToCompare = {
  id: string;
  name: string;
  title: string;
  company: string;
  linkedinUrl: string;
};

const FAKE_SIGNALS = `likelyFake: true when the profile looks fabricated, impersonated or generated filler rather than a coherent real professional. Strong signals, especially combined: a stub profile (no photo, no education, no work history beyond one bare line, no followers or activity) that claims a top role (MD, CEO, Founder, Owner) at a large, well-known company; a lowercase, sloppy or gibberish name or headline; education ending recently while experience at a top firm started years earlier; elite firms (Egon Zehnder, Korn Ferry, McKinsey, Goldman, ...) listed as self-employed or freelance; an About text that is a company brochure or generic LLM English; company HQ pasted as the person's location; overlapping full-time roles at competing firms. A thin profile alone is not fake (juniors, small-business owners, people who rarely use LinkedIn), but a thin profile claiming a top role at a big brand is suspicious. A full, coherent career history is not fake.`;

const COMPANY_AND_ROLE_RULES = `company: how the company on the profile relates to the target company. same = the target itself or the same business under another name (brand, trade name, legal name, regional unit). related = a parent, subsidiary, group company, joint venture, master franchisee or licensee, or the operator of the target's brand. different = clearly an unrelated business or a namesake. unknown = no company and nothing connects them. If you are not sure two companies are linked, unknown, never related. When search.targetWebsite or search.targetIndustry is given, a company with the same name in another industry, or whose profile points to another website, is a namesake: different.
role: does the person hold one of the wanted roles now? exact = the wanted role or the same position under another title (CEO = chief executive officer = MD and CEO; founder & CEO is a CEO). related = a nearby senior role: deputy, vice, acting, executive chair, co-founder or founder when not asked for, another C-suite officer. none = any other role, a former role, or no role stated.`;

const countOf = (value: unknown): number =>
  Array.isArray(value) ? value.length : 0;

// How filled-in the profile is, stated plainly so the model need not infer it
// from missing fields
const describeProfileCompleteness = (profile: unknown): string => {
  const record =
    typeof profile === 'object' && profile !== null
      ? (profile as Record<string, unknown>)
      : {};
  const hasPhoto = [
    'avatar',
    'profile_pic_url',
    'profile_picture',
    'image',
  ].some((key) => typeof record[key] === 'string' && record[key] !== '');

  return `Completeness: photo=${hasPhoto ? 'yes' : 'no'}, followers=${String(record.followers ?? 'unknown')}, connections=${String(record.connections ?? 'unknown')}, education entries=${countOf(record.education)}, experience entries=${countOf(record.experience)}, about=${typeof record.about === 'string' && record.about !== '' ? 'yes' : 'no'}.`;
};

const briefOf = (person: PersonToJudge): string =>
  isDefined(person.profile)
    ? `${describeProfileCompleteness(person.profile)}\n${buildFakeProfileInvestigationBrief(person.profile)}`.slice(
        0,
        1500,
      )
    : '';

const toJudgedRecord = (person: PersonToJudge) => ({
  name: person.name,
  title: person.title,
  company: person.company,
  location: person.location,
  evidence: (person.evidence ?? '').slice(0, 250),
  profile: briefOf(person),
});

const toComparedRecord = (person: PersonToCompare) => ({
  name: person.name,
  title: person.title,
  company: person.company,
  linkedinUrl: person.linkedinUrl,
});

const noul = (
  instructions: string,
  whenTrue: string,
  whenFalse: string,
): JevDecisionQuestion => ({
  type: 'noul',
  instructions,
  criteria: { true: whenTrue, false: whenFalse },
});

// Each caller passes the bar for its own question: fit, fake profile or same
// person (see fitment-threshold.util)
const isTrue = (
  answer: JevDecisionAnswer | undefined,
  probability: number,
): boolean | undefined =>
  answer?.type === 'noul' && typeof answer.noul === 'number'
    ? answer.noul >= probability
    : undefined;

const FIT_CRITERION: FitmentCriterion = {
  key: 'fits',
  description: 'fits the search',
  mustHave: true,
  weight: 1,
};
const COMPANY_CRITERION: FitmentCriterion = {
  key: 'company',
  description: 'works at the target company or a related one',
  mustHave: true,
  weight: 1,
};
const ROLE_CRITERION: FitmentCriterion = {
  key: 'role',
  description: 'holds a wanted role',
  mustHave: true,
  weight: 1,
};

export const scorePersonFitment = ({
  fits,
  company,
  role,
  withCompanyAndRole,
  hasProfile,
}: {
  fits: boolean | undefined;
  company: CompanyRelation;
  role: RoleFit;
  withCompanyAndRole: boolean;
  hasProfile: boolean;
}): FitmentResult => {
  const stage: FitmentStage = hasProfile ? 'profile' : 'snapshot';
  const verdicts: Record<string, 'pass' | 'fail' | 'unknown'> = {
    // No answer is the benefit of the doubt the question itself asks for
    fits: fits === false ? 'fail' : 'pass',
    company:
      company === 'same' || company === 'related'
        ? 'pass'
        : company === 'different'
          ? 'fail'
          : 'unknown',
    role: role === 'none' ? 'fail' : 'pass',
  };

  return scoreFitment({
    criteria: withCompanyAndRole
      ? [FIT_CRITERION, COMPANY_CRITERION, ROLE_CRITERION]
      : [FIT_CRITERION],
    verdicts,
    stage,
    threshold: getFitmentThreshold(),
  });
};

const runPool = async <TItem>(
  items: TItem[],
  limit: number,
  worker: (item: TItem) => Promise<void>,
): Promise<void> => {
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        await worker(items[next++]);
      }
    }),
  );
};

// Every people path (find_people_by_company, Bright Data search) judges people
// with Jev (typesafe/jev-1.13 on OpenRouter): does the person fit the search, is
// the profile real, and is this row the same person as another. A batch the
// model fails on is skipped: nobody is rejected, flagged or merged on a guess.
@Injectable()
export class BrightDataPersonFitFilterService {
  private readonly logger = new Logger(BrightDataPersonFitFilterService.name);

  constructor(private readonly jevDecisionsService: JevDecisionsService) {}

  // find_people_by_company: company, role, location and fake in one pass
  async judge({
    company,
    alternateNames,
    roles,
    location,
    candidates,
    website,
    industry,
    criteria,
  }: {
    workspaceId: string;
    company: string;
    alternateNames: string[];
    roles: string[];
    location?: string;
    candidates: PersonToJudge[];
    // Short brand names collide (Plum the skincare brand, Plum the benefits
    // platform): the site and industry tell namesakes apart
    website?: string;
    industry?: string;
    // What the user said the person must have, read from work history
    criteria?: string[];
  }): Promise<Map<string, PersonJudgement>> {
    const wantedCriteria = (criteria ?? [])
      .map((criterion) => criterion.trim())
      .filter((criterion) => criterion.length > 0)
      .slice(0, MAX_CRITERIA);

    return this.judgeAll({
      search: {
        targetCompany: company,
        alsoKnownAs: alternateNames,
        wantedRoles: roles,
        targetLocation: location ?? null,
        ...(website !== undefined && { targetWebsite: website }),
        ...(industry !== undefined && { targetIndustry: industry }),
        ...(wantedCriteria.length > 0 && { wantedCriteria }),
      },
      withCompanyAndRole: true,
      criteria: wantedCriteria,
      location,
      people: candidates,
    });
  }

  // Search paths with no target company: fit to the search query and fake
  async screen({
    query,
    people,
  }: {
    workspaceId: string;
    query: string;
    people: PersonToJudge[];
  }): Promise<Map<string, PersonJudgement>> {
    return this.judgeAll({
      search: { query },
      withCompanyAndRole: false,
      people,
    });
  }

  // Rows the model says are the same person, as duplicate id -> kept id. Only
  // pairs that could plausibly be one person are asked about.
  async findDuplicates({
    workspaceId,
    people,
  }: {
    workspaceId: string;
    people: PersonToCompare[];
  }): Promise<Map<string, string>> {
    const duplicates = new Map<string, string>();
    const pairs: Array<[PersonToCompare, PersonToCompare]> = [];
    const tokensOf = (name: string): string[] =>
      name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3);

    for (let first = 0; first < people.length; first += 1) {
      for (let second = first + 1; second < people.length; second += 1) {
        const a = people[first];
        const b = people[second];
        const sharesName = tokensOf(a.name).some((token) =>
          tokensOf(b.name).some(
            (other) =>
              other === token ||
              (token.length >= 5 &&
                other.length >= 5 &&
                (token.startsWith(other.slice(0, 4)) ||
                  other.startsWith(token.slice(0, 4)))),
          ),
        );

        if (sharesName && pairs.length < MAX_PAIRS) {
          pairs.push([a, b]);
        }
      }
    }

    if (pairs.length === 0) {
      return duplicates;
    }

    const state: Record<string, unknown> = {};
    const questions: Record<string, JevDecisionQuestion> = {};

    pairs.forEach(([first, second], index) => {
      state[`pair${index}`] = {
        first: toComparedRecord(first),
        second: toComparedRecord(second),
      };
      questions[`pair${index}__same`] = noul(
        `For \`pair${index}\`: are \`first\` and \`second\` the same real person? A spelling slip, transliteration, nickname, initials or word order of one name at the same company, with a compatible role, is the same person. Different given names, or clearly different roles at the same company (a founder and the CFO), are different people. Different LinkedIn URLs are different profiles: say same person only when name, company and role all agree. When unsure, false.`,
        'The same person.',
        'Different people, or unsure.',
      );
    });

    try {
      const answers = await this.jevDecisionsService.decide({
        state,
        questions,
      });

      pairs.forEach(([first, second], index) => {
        if (
          isTrue(answers[`pair${index}__same`], getSamePersonThreshold()) !==
          true
        ) {
          return;
        }

        // keep the row that has a profile URL, else the earlier one
        const [kept, dropped] =
          first.linkedinUrl === '' && second.linkedinUrl !== ''
            ? [second, first]
            : [first, second];

        if (!duplicates.has(kept.id) && !duplicates.has(dropped.id)) {
          duplicates.set(dropped.id, kept.id);
        }
      });
    } catch (error) {
      this.logger.warn(
        `Duplicate check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return duplicates;
  }

  private async judgeAll({
    search,
    withCompanyAndRole,
    criteria = [],
    location,
    people,
  }: {
    search: Record<string, unknown>;
    withCompanyAndRole: boolean;
    criteria?: string[];
    location?: string;
    people: PersonToJudge[];
  }): Promise<Map<string, PersonJudgement>> {
    const judgements = new Map<string, PersonJudgement>();
    const batches: PersonToJudge[][] = [];

    for (
      let start = 0;
      start < people.length && batches.length < MAX_BATCHES;
      start += BATCH_SIZE
    ) {
      batches.push(people.slice(start, start + BATCH_SIZE));
    }

    await runPool(batches, CONCURRENT_CALLS, async (batch) => {
      const records: Record<string, unknown> = {};
      const questions: Record<string, JevDecisionQuestion> = {};

      batch.forEach((person, index) => {
        records[`p${index}`] = toJudgedRecord(person);

        const subject = `\`people.p${index}\``;

        if (withCompanyAndRole) {
          questions[`p${index}__company`] = {
            type: 'choice',
            instructions: `For ${subject}: how does the company on the profile relate to \`search.targetCompany\`?`,
            criteria: {
              same: 'The target itself or the same business under another name (brand, trade name, legal name, regional unit).',
              related:
                "A parent, subsidiary, group company, joint venture, master franchisee or licensee, or the operator of the target's brand.",
              different: 'An unrelated business, or a namesake.',
              unknown:
                'No company, or nothing connects them. If unsure two companies are linked, unknown, never related.',
            },
          };
          questions[`p${index}__role`] = {
            type: 'choice',
            instructions: `For ${subject}: does the person hold one of \`search.wantedRoles\` now?`,
            criteria: {
              exact:
                'The wanted role or the same position under another title (CEO = MD and CEO; founder & CEO is a CEO).',
              related:
                'A nearby senior role: deputy, vice, acting, executive chair, co-founder or founder when not asked for, another C-suite officer.',
              none: 'Any other role, a former role, or no role stated.',
            },
          };
        }

        criteria.forEach((criterion, criterionIndex) => {
          questions[`p${index}__criterion${criterionIndex}`] = {
            type: 'choice',
            instructions: `For ${subject}: does the person's work history or profile show \`search.wantedCriteria[${criterionIndex}]\`? Judge what the profile states (companies, titles, about, evidence), not what could be inferred from the company alone.`,
            criteria: {
              match:
                'The profile or evidence shows it: a role, company or description that is that thing.',
              unknown:
                'The profile does not say, or says too little to judge. Unknown is not a mismatch.',
              mismatch:
                'The profile shows the person has not done it, or did something clearly different.',
            },
          };
        });

        // Asked as "fits" so the fitment threshold reads the right way round:
        // a higher bar rejects more, not fewer
        questions[`p${index}__fits`] = noul(
          withCompanyAndRole
            ? `For ${subject}: does the person fit the search${location ? `, including being based in ${location}` : ''}? A missing location is not a mismatch; say yes when the evidence is too thin to rule the person out.`
            : `For ${subject}: does the person match what \`search.query\` asks for (the place, the kind of company or industry, the kind of role)? A missing field is not a mismatch; say yes when the evidence is too thin to rule the person out.`,
          'Fits, or the evidence is too thin to say otherwise.',
          'Clearly does not fit: another location, an unrelated industry, an unrelated role.',
        );
        // a person read from a search result alone has no profile to judge
        if (isDefined(person.profile)) {
          questions[`p${index}__fake`] = noul(
            `For ${subject}: is the profile fabricated, impersonated or generated filler rather than a coherent real professional? ${FAKE_SIGNALS}`,
            'Looks fabricated, or a bare stub claiming a top role at a big brand.',
            'Coherent, or too thin to say.',
          );
        }
      });

      try {
        const answers = await withJevSlot(() =>
          this.jevDecisionsService.decide({
            state: { search, people: records },
            questions,
          }),
        );

        batch.forEach((person, index) => {
          const company = answers[`p${index}__company`]?.choice;
          const role = answers[`p${index}__role`]?.choice;
          const fits = isTrue(
            answers[`p${index}__fits`],
            getFitmentThreshold(),
          );
          const fake = isDefined(person.profile)
            ? isTrue(answers[`p${index}__fake`], getFakeProfileThreshold())
            : false;
          const criterionVerdicts: CriterionVerdict[] = criteria.map(
            (criterion, criterionIndex) => {
              const answer = String(
                answers[`p${index}__criterion${criterionIndex}`]?.choice ?? '',
              );
              const verdict: CriterionVerdict['verdict'] = [
                'match',
                'unknown',
                'mismatch',
              ].includes(answer)
                ? (answer as CriterionVerdict['verdict'])
                : 'unknown';

              return { criterion, verdict };
            },
          );

          if (fits === undefined && fake === undefined) {
            return;
          }

          const companyRelation = (
            ['same', 'related', 'different', 'unknown'].includes(
              String(company),
            )
              ? company
              : 'unknown'
          ) as CompanyRelation;
          const roleFit = (
            ['exact', 'related', 'none'].includes(String(role)) ? role : 'none'
          ) as RoleFit;

          judgements.set(person.id, {
            company: companyRelation,
            companyNote: '',
            role: roleFit,
            roleNote: '',
            fitsSearch: fits !== false,
            likelyFake: fake === true,
            ...(criterionVerdicts.length > 0 && {
              criteria: criterionVerdicts,
            }),
            fitment: scorePersonFitment({
              fits,
              company: companyRelation,
              role: roleFit,
              withCompanyAndRole,
              hasProfile: isDefined(person.profile),
            }),
          });
        });
      } catch (error) {
        this.logger.warn(
          `Person judging failed for a batch: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });

    return judgements;
  }
}
