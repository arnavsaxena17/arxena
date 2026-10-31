import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import {
  type OutreachEphemeralPerson,
  OutreachPeopleCacheService,
} from 'src/engine/core-modules/outreach-command/services/outreach-people-cache.service';
import { OutreachCompaniesCacheService } from 'src/engine/core-modules/outreach-command/services/outreach-companies-cache.service';
import { ChatTabWritesService } from 'src/engine/core-modules/outreach-command/services/chat-tab-writes.service';
import { OutreachTabService } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { mergePeople } from 'src/engine/core-modules/outreach-command/utils/merge-people.util';
import {
  personIdentityKey,
  personIdentityKeys,
} from 'src/engine/core-modules/outreach-command/utils/person-identity.util';
import { resolvePeopleCompanyIds } from 'src/engine/core-modules/outreach-command/utils/resolve-people-company-ids.util';
import {
  type UpsertOutreachTargetPeopleInput,
  UpsertOutreachTargetPeopleInputZodSchema,
} from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool.schema';
import { type ToolInput } from 'src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type ToolExecutionContext } from 'src/engine/core-modules/tool/types/tool-execution-context.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';

export { mergePeople };

const buildEphemeralId = (person: {
  id?: string;
  name: string;
  companyName: string;
  linkedinUrl: string;
  email?: string;
}): string => {
  if (isNonEmptyString(person.id)) {
    return person.id;
  }

  const seed = personIdentityKey(person);

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
    email: person.email,
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
    private readonly outreachTabService: OutreachTabService,
    private readonly chatTabWritesService: ChatTabWritesService,
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
    const existingIds = new Set(existing.map((person) => person.id));

    // Every identity key the merge retained points at the surviving row id, so
    // an incoming row is counted under the row it actually landed on
    const keyIndex = new Map<string, string>();
    const next =
      input.mode === 'replace'
        ? mergePeople([], incoming, { keyIndex })
        : mergePeople(existing, incoming, { keyIndex });
    const nextById = new Map(next.map((person) => [person.id, person]));

    const writtenRowIds: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const person of incoming) {
      const rowId = personIdentityKeys(person)
        .map((key) => keyIndex.get(key))
        .find(isDefined);
      const row =
        (rowId === undefined ? undefined : nextById.get(rowId)) ??
        nextById.get(person.id);

      if (!isDefined(row) || writtenRowIds.includes(row.id)) {
        continue;
      }

      writtenRowIds.push(row.id);

      if (existingIds.has(row.id)) {
        updatedCount += 1;
      } else {
        createdCount += 1;
      }
    }

    // Hand the written rows to the cache so the People tab can upsert them
    // without refetching. Only for merge: a replace can also drop rows, which
    // a caller that only sees additions would keep showing.
    const writtenRowIdSet = new Set(writtenRowIds);
    const writtenRows =
      input.mode === 'merge'
        ? next.filter((person) => writtenRowIdSet.has(person.id))
        : [];

    await this.outreachPeopleCacheService.set(
      context.workspaceId,
      input.projectId,
      next,
      writtenRows.length > 0 ? { writtenRows } : undefined,
    );

    await this.outreachTabService
      .syncPeopleFound({
        workspaceId: context.workspaceId,
        projectId: input.projectId,
      })
      .catch(() => undefined);

    await this.chatTabWritesService.append(
      context.threadId,
      input.projectId,
      'people',
      writtenRowIds,
    );

    return {
      success: true,
      message: `Wrote ${incoming.length} person(s) to People tab (${input.mode}). Total now ${next.length} for project ${input.projectId}. Do not create CRM Candidates until the user confirms Add to CRM / Enroll.`,
      result: {
        projectId: input.projectId,
        mode: input.mode,
        writtenCount: incoming.length,
        totalCount: next.length,
        writtenRowIds,
        createdCount,
        updatedCount,
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
