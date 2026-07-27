import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { getAttachmentDownloadUrl } from 'twenty-shared';

import { AttachmentProcessingService } from 'src/engine/core-modules/arx-chat/utils/attachment-processes';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export type EmailAttachment = {
  filename: string;
  path: string;
};

export type EmailDraftResult = {
  success: boolean;
  draft_id?: string;
  error?: string;
};

@Injectable()
export class EmailDraftService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly attachmentProcessing: AttachmentProcessingService,
  ) {}

  async createDraftEmailWithShortlist(
    user: Record<string, unknown>,
    job: Record<string, unknown>,
    candidateIds: string[],
    shortlistPath: string,
    excelPath: string | undefined,
    attachments: Array<{ name: string; downloadUrl?: string | null; fullPath?: string }>,
    cvSentId: string,
    origin: string,
    apiToken: string,
  ): Promise<EmailDraftResult> {
    try {
      console.log('Creating draft email with shortlist');
      console.log('Project:', job.name);
      console.log('Candidate IDs:', candidateIds);

      const shortlistAttachment = await this.uploadShortlistDocument(
        shortlistPath,
        cvSentId,
        apiToken,
      );

      let excelAttachment;
      if (excelPath) {
        excelAttachment = await this.uploadShortlistDocument(
          excelPath,
          cvSentId,
          apiToken,
          true,
        );
      }

      const emailAttachments: EmailAttachment[] = [];

      attachments.forEach((attachment) => {
        const path =
          attachment.downloadUrl ||
          getAttachmentDownloadUrl(attachment) ||
          attachment.fullPath;
        if (!path) {
          return;
        }
        emailAttachments.push({
          filename: attachment.name,
          path,
        });
      });

      if (shortlistAttachment) {
        const shortlistUrl = getAttachmentDownloadUrl(shortlistAttachment);
        if (shortlistUrl) {
          emailAttachments.push({
            filename: shortlistAttachment.name,
            path: shortlistUrl,
          });
        }
      }

      if (excelAttachment) {
        const excelUrl = getAttachmentDownloadUrl(excelAttachment);
        if (excelUrl) {
          emailAttachments.push({
            filename: excelAttachment.name,
            path: excelUrl,
          });
        }
      }

      const emailData = {
        phoneNumber: '918411937769',
        candidateId: candidateIds[0],
        newPositionObj: job,
        subject: 'Candidate Shortlist and Documentation',
        message: 'Please find attached the candidate shortlist and related documents.',
        attachments: emailAttachments,
      };

      const draftResult = await this.createDraftEmail(
        emailData,
        origin,
        apiToken,
      );

      return {
        success: true,
        draft_id: draftResult.draft_id,
      };
    } catch (error) {
      console.error('Error creating draft email:', error);
      return {
        success: false,
        error: (error as Error).message || 'Unknown error occurred',
      };
    }
  }

  private async uploadShortlistDocument(
    filePath: string,
    cvSentId: string,
    apiToken: string,
    isExcel = false,
  ): Promise<{ id: string; name: string; file?: Array<{ url?: string | null }> } | null> {
    try {
      const fileExtension = filePath.split('.').pop();
      const fileName = isExcel
        ? 'shortlist.xlsx'
        : fileExtension === 'docx'
          ? 'Executive Shortlist.docx'
          : 'Executive Shortlist.pdf';

      const uploaded = await this.attachmentProcessing.uploadAttachmentFile(
        filePath,
        apiToken,
        fileName,
      );

      if (!uploaded?.fileId) {
        throw new Error('Failed to upload shortlist document to FILES field');
      }

      const attachmentResponse =
        await this.attachmentProcessing.createAttachmentFromUploadedFile(
          {
            input: {
              name: fileName,
              file: [{ fileId: uploaded.fileId, label: fileName }],
              fileCategory: 'OTHER',
              cvSentId,
            },
          },
          apiToken,
        );

      const createdAttachment =
        attachmentResponse?.data?.data?.createAttachment;

      if (!createdAttachment) {
        throw new Error('Failed to create shortlist attachment record');
      }

      return createdAttachment;
    } catch (error) {
      console.error('Error uploading shortlist document:', error);
      return null;
    }
  }

  private async createDraftEmail(
    emailData: Record<string, unknown>,
    origin: string,
    apiToken: string,
  ): Promise<{ draft_id?: string }> {
    try {
      const url = `${process.env.SERVER_BASE_URL}/gmail-calendar-contacts/save-draft-mail-with-attachment`;

      const headers = {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      };

      console.log('Creating draft email:', url);
      console.log('Email data:', emailData);

      const response = await axios.post(url, emailData, {
        headers,
        timeout: 60000,
      });

      console.log('Draft email response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating draft email:', error);
      throw error;
    }
  }
}
