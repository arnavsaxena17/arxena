import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import {
  type OutreachEphemeralPerson,
  OutreachPeopleCacheService,
} from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { OutreachCompaniesCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { OutreachWorkingSetService } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import { resolvePeopleCompanyIds } from 'src/engine/core-modules/outreach-command/utils/resolve-people-company-ids.util';
import { isDeprioritisedPerson } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/outreach-people-deprioritisation.util';
import { personNamesRoughlyMatch } from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/person-name-matching.util';
import {
  type UpsertOutreachTargetPeopleInput,
  UpsertOutreachTargetPeopleInputZodSchema,
} from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool.schema';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

// The same profile is written as www.linkedin.com/in/x, in.linkedin.com/in/x
// (country subdomains), with a trailing slash or tracking query; all of those
// are one person, so profile URLs are compared by their /in/<slug> only
const normalizeLinkedinUrl = (linkedinUrl: string): string => {
  const trimmed = linkedinUrl.trim().toLowerCase();
  const profile = trimmed.match(/linkedin\.com\/in\/([^/?#\s]+)/);

  if (profile !== null) {
    let slug = profile[1];

    try {
      slug = decodeURIComponent(slug);
    } catch {
      // keep the raw slug
    }

    return `in/${slug}`;
  }

  return trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .split('?')[0];
};

const normalizeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const personDedupeKey = (person: {
  name: string;
  companyName: string;
  linkedinUrl: string;
}): string => {
  const linkedinUrl = normalizeLinkedinUrl(person.linkedinUrl);

  if (isNonEmptyString(linkedinUrl)) {
    return `linkedin:${linkedinUrl}`;
  }

  return `name:${normalizeName(person.name)}|company:${normalizeName(person.companyName)}`;
};

const buildEphemeralId = (person: {
  id?: string;
  name: string;
  companyName: string;
  linkedinUrl: string;
}): string => {
  if (isNonEmptyString(person.id)) {
    return person.id;
  }

  const seed = personDedupeKey(person);

  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
};

export const toEphemeralPerson = (person: {
  id?: string;
  name: string;
  title?: string;
  headline?: string;
  summary?: string;
  companyId?: string;
  companyName?: string;
  linkedinUrl?: string;
  warmPath?: string;
  stage?: string;
  email?: string;
  connectionDegree?: number;
  personaPriorityScore?: number;
  otherFields?: Record<string, unknown>;
}): OutreachEphemeralPerson => ({
  id: buildEphemeralId({
    id: person.id,
    name: person.name,
    companyName: person.companyName ?? '',
    linkedinUrl: person.linkedinUrl ?? '',
  }),
  name: person.name.trim(),
  title: person.title ?? '',
  ...(isDefined(person.otherFields) ? { otherFields: person.otherFields } : {}),
  ...(isNonEmptyString(person.headline?.trim())
    ? { headline: person.headline!.trim() }
    : {}),
  ...(isNonEmptyString(person.summary?.trim())
    ? { summary: person.summary!.trim() }
    : {}),
  companyId: person.companyId ?? '',
  companyName: person.companyName ?? '',
  linkedinUrl: person.linkedinUrl?.trim() ?? '',
  warmPath: isNonEmptyString(person.warmPath) ? person.warmPath : '—',
  stage: isNonEmptyString(person.stage) ? person.stage : 'queued',
  email: person.email ?? '',
  ...(typeof person.connectionDegree === 'number'
    ? { connectionDegree: person.connectionDegree }
    : {}),
  ...(typeof person.personaPriorityScore === 'number'
    ? { personaPriorityScore: person.personaPriorityScore }
    : {}),
});

@Injectable()
export class UpsertOutreachTargetPeopleTool implements Tool {
  description = `Write target people to the Outreach People tab (ephemeral Redis list per projectId).
Use this when the user is on /outreach-home and asks to find/fetch/search people (MD/CEO, target titles, etc.) for companies in this project.
Do NOT create CRM Candidate / Person records for the People tab — only call this tool.
CRM writes happen only after the user selects rows and confirms Add to CRM / Enroll.
Prefer mode=merge. Pass projectId from the outreachCommand browsing context.`;

  inputSchema = UpsertOutreachTargetPeopleInputZodSchema;

  constructor(
    private readonly outreachPeopleCacheService: OutreachPeopleCacheService,
    private readonly outreachCompaniesCacheService: OutreachCompaniesCacheService,
    private readonly outreachWorkingSetService: OutreachWorkingSetService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parseResult =
      UpsertOutreachTargetPeopleInputZodSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid upsert_outreach_target_people input',
        error: parseResult.error.message,
      };
    }

    const input: UpsertOutreachTargetPeopleInput = parseResult.data;
    const companiesPayload = await this.outreachCompaniesCacheService.get(
      context.workspaceId,
      input.projectId,
    );
    // people from a general search carry only an employer name; link them to
    // the Companies-tab row so selecting that company shows them
    const incoming = resolvePeopleCompanyIds(
      input.people,
      companiesPayload?.companies ?? [],
    ).map(toEphemeralPerson);

    const existingPayload = await this.outreachPeopleCacheService.get(
      context.workspaceId,
      input.projectId,
    );
    const existing = existingPayload?.people ?? [];

    const next =
      input.mode === 'replace'
        ? mergePeople([], incoming)
        : mergePeople(existing, incoming);

    await this.outreachPeopleCacheService.set(
      context.workspaceId,
      input.projectId,
      next,
    );

    await this.outreachWorkingSetService
      .syncPeopleFound({
        workspaceId: context.workspaceId,
        projectId: input.projectId,
      })
      .catch(() => undefined);

    return {
      success: true,
      message: `Wrote ${incoming.length} person(s) to People tab (${input.mode}). Total now ${next.length} for project ${input.projectId}. Do not create CRM Candidates until the user confirms Add to CRM / Enroll.`,
      result: {
        projectId: input.projectId,
        mode: input.mode,
        writtenCount: incoming.length,
        totalCount: next.length,
        people: next.slice(0, 25).map((person) => ({
          id: person.id,
          name: person.name,
          title: person.title,
          companyName: person.companyName,
          linkedinUrl: person.linkedinUrl,
          stage: person.stage,
        })),
      },
    };
  }
}

const nameAndCompanyKey = (person: {
  name: string;
  companyName: string;
}): string =>
  `${normalizeName(person.name)}|${normalizeName(person.companyName)}`;

// One row per person. Same LinkedIn profile is one person whatever the URL
// form, and the same name at the same company is one person too (a lookup
// often finds one MD through two profiles). The same name at different
// companies stays two people.
export const mergePeople = (
  existing: OutreachEphemeralPerson[],
  incoming: OutreachEphemeralPerson[],
): OutreachEphemeralPerson[] => {
  const byKey = new Map<string, OutreachEphemeralPerson>();
  const keyByNameAndCompany = new Map<string, string>();
  // only rows at the same company can be one person, so the spelling check
  // looks at that company's rows, not the whole list
  const keysByCompany = new Map<string, string[]>();

  const add = (person: OutreachEphemeralPerson, isIncoming: boolean) => {
    let key = personDedupeKey(person);
    let previous = byKey.get(key);
    const nameKey = nameAndCompanyKey(person);

    // The same person under a one-letter spelling slip, where one of the two
    // rows has no profile URL to tell them apart by
    if (previous === undefined) {
      const similarKey = (keysByCompany.get(normalizeName(person.companyName)) ?? [])
        .map((candidateKey) => [candidateKey, byKey.get(candidateKey)] as const)
        .find(
          ([, other]) =>
            other !== undefined &&
            (!isNonEmptyString(other.linkedinUrl) ||
              !isNonEmptyString(person.linkedinUrl)) &&
            personNamesRoughlyMatch(other.name, person.name),
        )?.[0];

      if (similarKey !== undefined) {
        key = similarKey;
        previous = byKey.get(similarKey);
      }
    }

    if (previous === undefined) {
      const candidateKey = keyByNameAndCompany.get(nameKey);
      const candidate =
        candidateKey === undefined ? undefined : byKey.get(candidateKey);

      if (candidate !== undefined && candidateKey !== undefined) {
        key = candidateKey;
        previous = candidate;
      }
    }

    const merged: OutreachEphemeralPerson = {
      ...(previous ?? person),
      ...(isIncoming || previous === undefined ? person : {}),
      id: previous?.id ?? person.id ?? randomUUID(),
    };

    // keep a profile URL once one is known
    if (
      previous !== undefined &&
      !isNonEmptyString(merged.linkedinUrl) &&
      isNonEmptyString(previous.linkedinUrl)
    ) {
      merged.linkedinUrl = previous.linkedinUrl;
    }

    if (previous !== undefined && key !== personDedupeKey(merged)) {
      byKey.delete(key);
      key = personDedupeKey(merged);
    }

    byKey.set(key, merged);
    keyByNameAndCompany.set(nameKey, key);

    const companyKey = normalizeName(merged.companyName);
    const companyKeys = keysByCompany.get(companyKey) ?? [];

    if (!companyKeys.includes(key)) {
      keysByCompany.set(companyKey, [...companyKeys, key]);
    }
  };

  existing.forEach((person) => add(person, false));
  incoming.forEach((person) => add(person, true));

  // ids are row keys in the table: they must be unique
  const seenIds = new Set<string>();

  const merged = [...byKey.entries()].map(([key, person]) => {
    if (!seenIds.has(person.id)) {
      seenIds.add(person.id);

      return person;
    }

    const id = createHash('sha256').update(key).digest('hex').slice(0, 32);

    seenIds.add(id);

    return { ...person, id };
  });

  // Likely-fake and off-target rows go below the rest; the sort is stable, so
  // every other row keeps its position
  return [
    ...merged.filter((person) => !isDeprioritisedPerson(person)),
    ...merged.filter((person) => isDeprioritisedPerson(person)),
  ];
};
