import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import {
  type FitmentCriterion,
  type FitmentResult,
  scoreFitment,
} from 'src/engine/core-modules/judge/fitment-score.util';
import {
  getFakeProfileThreshold,
  getFitmentThreshold,
  getSamePersonThreshold,
} from 'src/engine/core-modules/judge/fitment-threshold.util';
import { JudgeService } from 'src/engine/core-modules/judge/judge.service';
import { buildFakeProfileInvestigationBrief } from 'src/engine/core-modules/outreach-command/utils/outreach-fake-profile-investigation.util';

// People per jev call: every person adds up to four questions
const BATCH_SIZE = 8;
const CONCURRENT_CALLS = 4;
const MAX_PAIRS = 60;
const MAX_CRITERIA = 4;

// Fit, company and role are the fitment criteria. Fake and same-person are
// separate flags with their own bars, not part of the score.
const FIT_KEY = 'fits';
const COMPANY_KEY = 'company';
const ROLE_KEY = 'role';
const FAKE_KEY = 'fake';
const SAME_PERSON_KEY = 'same';

const FIT_CRITERION: FitmentCriterion = {
  key: FIT_KEY,
  description: 'fits the search',
  mustHave: true,
  weight: 1,
  values: ['true', 'false'],
  passValues: ['true'],
  failValues: ['false'],
};

const COMPANY_CRITERION: FitmentCriterion = {
  key: COMPANY_KEY,
  description: 'works at the target company or a related one',
  mustHave: true,
  weight: 1,
  values: ['same', 'related', 'different', 'unknown'],
  passValues: ['same', 'related'],
  failValues: ['different'],
};

const ROLE_CRITERION: FitmentCriterion = {
  key: ROLE_KEY,
  description: 'holds a wanted role',
  mustHave: true,
  weight: 1,
  values: ['exact', 'related', 'none'],
  passValues: ['exact', 'related'],
  failValues: ['none'],
};

const FAKE_CRITERION: FitmentCriterion = {
  key: FAKE_KEY,
  description: 'the profile looks fabricated',
  mustHave: false,
  weight: 1,
  values: ['true', 'false'],
  passValues: ['false'],
  failValues: ['true'],
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

// One person as the `field: value` lines the judge reads. Evidence is the text
// a search row was read from; profile is the completeness brief plus the fake
// investigation, which is only sent when there is a profile to check.
const toJudgedRecord = (
  person: PersonToJudge,
): { id: string } & Record<string, unknown> => ({
  id: person.id,
  name: person.name,
  title: person.title,
  company: person.company,
  location: person.location,
  evidence: (person.evidence ?? '').slice(0, 250),
  ...(isDefined(person.profile) && { profile: briefOf(person) }),
});

const JUDGED_FIELDS = [
  'name',
  'title',
  'company',
  'location',
  'evidence',
  'profile',
];

const CRITERION_VALUES = ['match', 'unknown', 'mismatch'];

// The user's own criteria are verdicts of their own: they are reported, not
// scored, because a snapshot often cannot answer them
const criterionOf = (criterion: string, index: number): FitmentCriterion => ({
  key: `criterion${index}`,
  description: criterion,
  mustHave: false,
  weight: 1,
  values: CRITERION_VALUES,
  passValues: ['match'],
  failValues: ['mismatch'],
});

const roleDescription = (roles: string[]): string =>
  `holds one of the wanted roles (${roles.filter((role) => role !== '').join(', ')}) now`;

// Every people path (find_people_by_company, Bright Data search) judges people
// the same way: does the person fit the search, is the profile real, and is this
// row the same person as another. A batch the model fails on is skipped: nobody
// is rejected, flagged or merged on a guess.
@Injectable()
export class BrightDataPersonFitFilterService {
  private readonly logger = new Logger(BrightDataPersonFitFilterService.name);

  constructor(private readonly judgeService: JudgeService) {}

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
    const wantedRoles = roles.filter((role) => role !== '');
    const target = [
      `the target company is ${company}`,
      alternateNames.length > 0
        ? `also known as ${alternateNames.join(', ')}`
        : '',
      website !== undefined ? `its website is ${website}` : '',
      industry !== undefined ? `it is in ${industry}` : '',
      location !== undefined ? `the person must be based in ${location}` : '',
    ]
      .filter((part) => part !== '')
      .join('; ');

    return this.judgeAll({
      candidates,
      context: target,
      request: wantedCriteria.join('; '),
      withCompanyAndRole: true,
      criteria: wantedCriteria,
      roles: wantedRoles,
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
      candidates: people,
      context: '',
      request: query,
      withCompanyAndRole: false,
      criteria: [],
      roles: [],
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

    const pairRecords = pairs.map(([first, second], index) => ({
      id: `pair${index}`,
      first: [first.name, first.title, first.company, first.linkedinUrl].join(
        ' | ',
      ),
      second: [
        second.name,
        second.title,
        second.company,
        second.linkedinUrl,
      ].join(' | '),
    }));

    try {
      const { results } = await this.judgeService.judgeStage(pairRecords, {
        name: 'Same person',
        subject: 'person',
        stage: 'profile',
        criteria: [
          {
            key: SAME_PERSON_KEY,
            description:
              'the two rows are the same real person. A spelling slip, transliteration, nickname, initials or word order of one name at the same company, with a compatible role, is the same person. Different given names, or clearly different roles at the same company (a founder and the CFO), are different people. Different LinkedIn URLs are different profiles: say same person only when name, company and role all agree. When unsure, false.',
            mustHave: true,
            weight: 1,
            values: ['true', 'false'],
            passValues: ['true'],
            failValues: ['false'],
          },
        ],
        threshold: getSamePersonThreshold(),
        metadataFields: ['first', 'second'],
        batchSize: pairs.length,
        concurrency: 1,
      });

      pairs.forEach(([first, second], index) => {
        if (results.get(`pair${index}`)?.outcome !== 'pass') {
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
    candidates,
    context,
    request,
    withCompanyAndRole,
    criteria = [],
    roles = [],
  }: {
    candidates: PersonToJudge[];
    context: string;
    request: string;
    withCompanyAndRole: boolean;
    criteria?: string[];
    roles?: string[];
  }): Promise<Map<string, PersonJudgement>> {
    const judgements = new Map<string, PersonJudgement>();
    const records = candidates.map(toJudgedRecord);
    const fitmentCriteria: FitmentCriterion[] = withCompanyAndRole
      ? [
          FIT_CRITERION,
          COMPANY_CRITERION,
          roles.length === 0
            ? ROLE_CRITERION
            : { ...ROLE_CRITERION, description: roleDescription(roles) },
        ]
      : [FIT_CRITERION];

    try {
      // One call asks every question, including the user's own criteria and the
      // fake check. Only fit, company and role make up the fitment score.
      const { results } = await this.judgeService.judgeStage(records, {
        name: withCompanyAndRole ? 'People at company' : 'People search',
        subject: 'person',
        stage: 'snapshot',
        criteria: [
          ...fitmentCriteria,
          ...criteria.map(criterionOf),
          FAKE_CRITERION,
        ],
        request: [request, context].filter((part) => part !== '').join('\n'),
        threshold: getFitmentThreshold(),
        fieldThresholds: {
          [FIT_KEY]: getFitmentThreshold(),
          [FAKE_KEY]: getFakeProfileThreshold(),
        },
        metadataFields: JUDGED_FIELDS,
        batchSize: BATCH_SIZE,
        concurrency: CONCURRENT_CALLS,
      });

      for (const person of candidates) {
        const result = results.get(person.id);

        if (!isDefined(result)) {
          continue;
        }

        const company = String(
          result.verdicts[COMPANY_KEY] ?? 'unknown',
        ) as CompanyRelation;
        const role = String(result.verdicts[ROLE_KEY] ?? 'none') as RoleFit;
        const criterionVerdicts: CriterionVerdict[] = criteria.map(
          (criterion, index) => {
            const verdict = result.verdicts[`criterion${index}`];

            return {
              criterion,
              verdict:
                verdict === 'pass'
                  ? 'match'
                  : verdict === 'fail'
                    ? 'mismatch'
                    : 'unknown',
            };
          },
        );

        // A row read from a search result has no profile, so it is a snapshot:
        // its unknown criteria go to the profile fetch instead of failing.
        judgements.set(person.id, {
          company,
          companyNote: '',
          role,
          roleNote: '',
          fitsSearch: result.verdicts[FIT_KEY] !== 'fail',
          likelyFake: result.verdicts[FAKE_KEY] === 'pass',
          ...(criterionVerdicts.length > 0 && {
            criteria: criterionVerdicts,
          }),
          fitment: scoreFitment({
            criteria: fitmentCriteria,
            verdicts: result.verdicts,
            stage: isDefined(person.profile) ? 'profile' : 'snapshot',
            threshold: getFitmentThreshold(),
          }),
        });
      }
    } catch (error) {
      this.logger.warn(
        `Person judging failed for a batch: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return judgements;
  }
}
