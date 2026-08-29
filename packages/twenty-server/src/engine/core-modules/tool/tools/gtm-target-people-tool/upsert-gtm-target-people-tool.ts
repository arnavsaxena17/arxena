import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';

import {
  type GtmEphemeralPerson,
  GtmPeopleCacheService,
} from 'src/engine/core-modules/gtm-command/services/gtm-people-cache.service';
import {
  type UpsertGtmTargetPeopleInput,
  UpsertGtmTargetPeopleInputZodSchema,
} from 'src/engine/core-modules/tool/tools/gtm-target-people-tool/upsert-gtm-target-people-tool.schema';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

const normalizeLinkedinUrl = (linkedinUrl: string): string =>
  linkedinUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .split('?')[0];

const normalizeName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const personDedupeKey = (person: {
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

const toEphemeralPerson = (person: {
  id?: string;
  name: string;
  title?: string;
  companyId?: string;
  companyName?: string;
  linkedinUrl?: string;
  warmPath?: string;
  stage?: string;
  email?: string;
  connectionDegree?: number;
  personaPriorityScore?: number;
}): GtmEphemeralPerson => ({
  id: buildEphemeralId({
    id: person.id,
    name: person.name,
    companyName: person.companyName ?? '',
    linkedinUrl: person.linkedinUrl ?? '',
  }),
  name: person.name.trim(),
  title: person.title ?? '',
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
export class UpsertGtmTargetPeopleTool implements Tool {
  description = `Write target people to the GTM Command People tab (ephemeral Redis list per projectId).
Use this when the user is on /gtm-home and asks to find/fetch/search people (MD/CEO, buyers, etc.) for companies in this GTM project.
Do NOT create CRM Candidate / Person records for the People tab — only call this tool.
CRM writes happen only after the user selects rows and confirms Add to CRM / Enroll.
Prefer mode=merge. Pass projectId from the gtmCommand browsing context.`;

  inputSchema = UpsertGtmTargetPeopleInputZodSchema;

  constructor(
    private readonly gtmPeopleCacheService: GtmPeopleCacheService,
  ) {}

  async execute(
    parameters: ToolInput,
    context: ToolExecutionContext,
  ): Promise<ToolOutput> {
    const parseResult =
      UpsertGtmTargetPeopleInputZodSchema.safeParse(parameters);

    if (!parseResult.success) {
      return {
        success: false,
        message: 'Invalid upsert_gtm_target_people input',
        error: parseResult.error.message,
      };
    }

    const input: UpsertGtmTargetPeopleInput = parseResult.data;
    const incoming = input.people.map(toEphemeralPerson);

    const existingPayload = await this.gtmPeopleCacheService.get(
      context.workspaceId,
      input.projectId,
    );
    const existing = existingPayload?.people ?? [];

    let next: GtmEphemeralPerson[];

    if (input.mode === 'replace') {
      next = dedupePeople(incoming);
    } else {
      const byKey = new Map<string, GtmEphemeralPerson>();

      for (const person of existing) {
        byKey.set(personDedupeKey(person), person);
      }

      for (const person of incoming) {
        const key = personDedupeKey(person);
        const previous = byKey.get(key);

        byKey.set(key, {
          ...(previous ?? person),
          ...person,
          id: previous?.id ?? person.id ?? randomUUID(),
        });
      }

      next = [...byKey.values()];
    }

    await this.gtmPeopleCacheService.set(
      context.workspaceId,
      input.projectId,
      next,
    );

    return {
      success: true,
      message: `Wrote ${incoming.length} person(s) to GTM People tab (${input.mode}). Total now ${next.length} for project ${input.projectId}. Do not create CRM Candidates until the user confirms Add to CRM / Enroll.`,
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

const dedupePeople = (people: GtmEphemeralPerson[]): GtmEphemeralPerson[] => {
  const byKey = new Map<string, GtmEphemeralPerson>();

  for (const person of people) {
    byKey.set(personDedupeKey(person), person);
  }

  return [...byKey.values()];
};
