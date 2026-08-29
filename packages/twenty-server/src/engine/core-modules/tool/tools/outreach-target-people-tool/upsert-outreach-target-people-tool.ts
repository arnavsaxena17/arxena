import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';

import {
  type OutreachEphemeralPerson,
  OutreachPeopleCacheService,
} from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import {
  type UpsertOutreachTargetPeopleInput,
  UpsertOutreachTargetPeopleInputZodSchema,
} from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool.schema';
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
}): OutreachEphemeralPerson => ({
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
export class UpsertOutreachTargetPeopleTool implements Tool {
  description = `Write target people to the Outreach People tab (ephemeral Redis list per projectId).
Use this when the user is on /outreach-home and asks to find/fetch/search people (MD/CEO, target titles, etc.) for companies in this project.
Do NOT create CRM Candidate / Person records for the People tab — only call this tool.
CRM writes happen only after the user selects rows and confirms Add to CRM / Enroll.
Prefer mode=merge. Pass projectId from the outreachCommand browsing context.`;

  inputSchema = UpsertOutreachTargetPeopleInputZodSchema;

  constructor(
    private readonly outreachPeopleCacheService: OutreachPeopleCacheService,
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
    const incoming = input.people.map(toEphemeralPerson);

    const existingPayload = await this.outreachPeopleCacheService.get(
      context.workspaceId,
      input.projectId,
    );
    const existing = existingPayload?.people ?? [];

    let next: OutreachEphemeralPerson[];

    if (input.mode === 'replace') {
      next = dedupePeople(incoming);
    } else {
      const byKey = new Map<string, OutreachEphemeralPerson>();

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

    await this.outreachPeopleCacheService.set(
      context.workspaceId,
      input.projectId,
      next,
    );

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

const dedupePeople = (people: OutreachEphemeralPerson[]): OutreachEphemeralPerson[] => {
  const byKey = new Map<string, OutreachEphemeralPerson>();

  for (const person of people) {
    byKey.set(personDedupeKey(person), person);
  }

  return [...byKey.values()];
};
