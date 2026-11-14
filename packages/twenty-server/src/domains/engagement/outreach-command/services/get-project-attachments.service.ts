import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { type FileOutput } from 'src/engine/api/common/common-args-processors/data-arg-processor/types/file-item.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

// Collateral the prospect can be sent by email. Capped so a project with many
// attachments cannot turn a reply into a file dump.
const MAX_PROJECT_ATTACHMENT_FILES = 3;

export type GetProjectAttachmentsInput = {
  projectId?: string;
  // Case-insensitive substring of the attachment or file name. Empty = all.
  fileName?: string;
};

export type ProjectAttachmentFile = { id: string; name: string };

type AttachmentRecord = ObjectLiteral & {
  id: string;
  name?: string | null;
  file?: FileOutput[] | null;
};

@Injectable()
export class GetProjectAttachmentsService {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: GetProjectAttachmentsInput;
  }): Promise<{
    success: boolean;
    files: ProjectAttachmentFile[];
    fileNames: string;
    error: string;
  }> {
    const projectId = input.projectId?.trim();

    if (!isNonEmptyString(projectId)) {
      return { success: true, files: [], fileNames: '', error: '' };
    }

    const nameHint = input.fileName?.trim().toLowerCase() ?? '';

    try {
      const files =
        await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
          async () => {
            const attachmentRepository =
              await this.globalWorkspaceOrmManager.getRepository<AttachmentRecord>(
                workspaceId,
                'attachment',
                { shouldBypassPermissionChecks: true },
              );
            const attachments = await attachmentRepository.find({
              where: { targetProjectId: projectId },
              order: { createdAt: 'DESC' },
              take: 20,
            });

            return attachments.flatMap((attachment) =>
              (attachment.file ?? []).flatMap((file) => {
                if (!isNonEmptyString(file?.fileId)) {
                  return [];
                }

                // Labels set through the UI usually already carry the extension.
                const label = file.label ?? '';
                const labelWithExtension =
                  isNonEmptyString(file.extension) &&
                  !label.toLowerCase().endsWith(file.extension.toLowerCase())
                    ? `${label}${file.extension}`
                    : label;
                const name =
                  labelWithExtension || attachment.name || file.fileId;

                return nameHint === '' || name.toLowerCase().includes(nameHint)
                  ? [{ id: file.fileId, name }]
                  : [];
              }),
            );
          },
          buildSystemAuthContext(workspaceId),
        );
      const selected = files
        .filter(
          (file, index) => files.findIndex((f) => f.id === file.id) === index,
        )
        .slice(0, MAX_PROJECT_ATTACHMENT_FILES);

      return {
        success: true,
        files: selected,
        fileNames: selected.map((file) => file.name).join(', '),
        error: '',
      };
    } catch (error) {
      return {
        success: false,
        files: [],
        fileNames: '',
        error:
          isDefined(error) && error instanceof Error
            ? error.message
            : String(error),
      };
    }
  }
}
