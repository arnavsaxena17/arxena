import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isNonEmptyString } from '@sniptt/guards';
import {
  OUTREACH_DRAFT_ATTACHMENTS_FIELD_NAME,
  OUTREACH_DRAFT_DEFAULT_TEMPLATES,
  OUTREACH_DRAFT_TEMPLATE_FIELD_NAMES,
  OUTREACH_DRAFT_TEMPLATE_KEYS,
  OUTREACH_DRAFT_VARIABLES,
  renderOutreachDraftTemplate,
  type OutreachDraftTemplateKey,
} from 'twenty-shared/arx';
import { isDefined } from 'twenty-shared/utils';
import { type WorkflowAttachment } from 'twenty-shared/workflow';
import { type ObjectLiteral, Repository } from 'typeorm';

import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

export type OutreachDraftTemplates = Record<OutreachDraftTemplateKey, string>;
export type OutreachDraftAttachments = Partial<
  Record<OutreachDraftTemplateKey, WorkflowAttachment[]>
>;

export type RenderOutreachDraftTemplateInput = {
  templateKey?: string;
  // Empty means the member never edited it: fall back to the seeded default.
  template?: string;
  personFirstName?: string;
  personLastName?: string;
  personFullName?: string;
  companyName?: string;
  senderFirstName?: string;
  senderLastName?: string;
  senderWebsite?: string;
};

export type RenderOutreachDraftTemplateOutput = {
  success: boolean;
  message: string;
  error: string;
};

type WorkspaceMemberDraftRecord = ObjectLiteral & {
  id: string;
  name?: { firstName?: string | null; lastName?: string | null } | null;
  outreachDraftAttachments?: OutreachDraftAttachments | null;
};

const isTemplateKey = (value: unknown): value is OutreachDraftTemplateKey =>
  OUTREACH_DRAFT_TEMPLATE_KEYS.includes(value as OutreachDraftTemplateKey);

const joinName = (
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string => [firstName, lastName].filter(isNonEmptyString).join(' ').trim();

@Injectable()
export class OutreachDraftTemplateService {
  private readonly logger = new Logger(OutreachDraftTemplateService.name);

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
  ) {}

  // Workflow step: fills the member's template for one candidate. A failure
  // result stops the run before the send node (continueOnFailure is off).
  async render({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: RenderOutreachDraftTemplateInput;
  }): Promise<RenderOutreachDraftTemplateOutput> {
    const templateKey = input.templateKey;

    if (!isTemplateKey(templateKey)) {
      return {
        success: false,
        message: '',
        error: `Unknown draft template "${String(templateKey)}"`,
      };
    }

    const template = isNonEmptyString(input.template?.trim())
      ? (input.template as string)
      : OUTREACH_DRAFT_DEFAULT_TEMPLATES[templateKey];
    const senderWebsite = isNonEmptyString(input.senderWebsite?.trim())
      ? (input.senderWebsite as string)
      : await this.getSenderWebsite(workspaceId);
    const personFullName = isNonEmptyString(input.personFullName?.trim())
      ? (input.personFullName as string)
      : joinName(input.personFirstName, input.personLastName);

    const rendered = renderOutreachDraftTemplate(template, {
      'person.firstName': input.personFirstName,
      'person.fullName': personFullName,
      'company.name': input.companyName,
      'sender.name': joinName(input.senderFirstName, input.senderLastName),
      'sender.website': senderWebsite,
    });

    const problems = [
      ...rendered.missingVariableKeys.map(
        (key) =>
          `${OUTREACH_DRAFT_VARIABLES.find((variable) => variable.key === key)?.label ?? key} is empty`,
      ),
      ...rendered.unknownVariableKeys.map(
        (key) => `${key} is not a known variable`,
      ),
    ];

    if (problems.length > 0) {
      return {
        success: false,
        message: '',
        error: `Draft message not sent: ${problems.join('; ')}`,
      };
    }

    return { success: true, message: rendered.message, error: '' };
  }

  async getSenderWebsite(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      select: ['id', 'companyDomain'],
    });

    return workspace?.companyDomain?.trim() ?? '';
  }

  async getDraftSettings({
    workspaceId,
    workspaceMemberId,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
  }): Promise<{
    templates: OutreachDraftTemplates;
    attachments: OutreachDraftAttachments;
    senderName: string;
    senderWebsite: string;
  }> {
    const member = await this.findMember(workspaceId, workspaceMemberId);
    const templates = {} as OutreachDraftTemplates;

    for (const key of OUTREACH_DRAFT_TEMPLATE_KEYS) {
      const stored = member?.[OUTREACH_DRAFT_TEMPLATE_FIELD_NAMES[key]];

      templates[key] = isNonEmptyString(stored)
        ? stored
        : OUTREACH_DRAFT_DEFAULT_TEMPLATES[key];
    }

    return {
      templates,
      attachments: member?.outreachDraftAttachments ?? {},
      senderName: joinName(member?.name?.firstName, member?.name?.lastName),
      senderWebsite: await this.getSenderWebsite(workspaceId),
    };
  }

  async saveDraftSettings({
    workspaceId,
    workspaceMemberId,
    templates,
    attachments,
  }: {
    workspaceId: string;
    workspaceMemberId: string;
    templates?: Partial<Record<string, string>>;
    attachments?: OutreachDraftAttachments;
  }): Promise<void> {
    const update: Record<string, unknown> = {};

    for (const key of OUTREACH_DRAFT_TEMPLATE_KEYS) {
      const value = templates?.[key];

      if (typeof value === 'string') {
        update[OUTREACH_DRAFT_TEMPLATE_FIELD_NAMES[key]] = value;
      }
    }

    if (isDefined(attachments)) {
      const sanitized: OutreachDraftAttachments = {};

      for (const key of OUTREACH_DRAFT_TEMPLATE_KEYS) {
        const files = attachments[key];

        if (Array.isArray(files)) {
          sanitized[key] = files.filter(
            (file) =>
              isNonEmptyString(file?.id) && isNonEmptyString(file?.name),
          );
        }
      }

      update[OUTREACH_DRAFT_ATTACHMENTS_FIELD_NAME] = sanitized;
    }

    if (Object.keys(update).length === 0) {
      return;
    }

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
      const repository =
        await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberDraftRecord>(
          workspaceId,
          'workspaceMember',
          { shouldBypassPermissionChecks: true },
        );

      await repository.update({ id: workspaceMemberId }, update as never);
    }, buildSystemAuthContext(workspaceId));
  }

  private async findMember(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<WorkspaceMemberDraftRecord | null> {
    try {
      return await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const repository =
            await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberDraftRecord>(
              workspaceId,
              'workspaceMember',
              { shouldBypassPermissionChecks: true },
            );

          return repository.findOne({ where: { id: workspaceMemberId } });
        },
        buildSystemAuthContext(workspaceId),
      );
    } catch (error) {
      this.logger.warn(
        `workspaceMember unavailable for draft templates: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
