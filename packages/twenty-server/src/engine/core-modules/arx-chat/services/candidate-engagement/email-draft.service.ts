import { Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  graphQLtoCreateOneAttachmentFromFilePath,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

export interface EmailAttachment {
  filename: string;
  path: string;
}

export interface EmailDraftResult {
  success: boolean;
  draft_id?: string;
  error?: string;
}

@Injectable()
export class EmailDraftService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async createDraftEmailWithShortlist(
    user: any,
    job: any,
    candidateIds: string[],
    shortlistPath: string,
    excelPath: string | undefined,
    attachments: any[],
    cvSentId: string,
    origin: string,
    apiToken: string,
  ): Promise<EmailDraftResult> {
    try {
      console.log('Creating draft email with shortlist');
      console.log('Project:', job.name);
      console.log('Candidate IDs:', candidateIds);

      // Step 1: Upload shortlist documents
      const shortlistAttachment = await this.uploadShortlistDocument(
        user,
        shortlistPath,
        cvSentId,
        apiToken,
      );

      let excelAttachment;
      if (excelPath) {
        excelAttachment = await this.uploadShortlistDocument(
          user,
          excelPath,
          cvSentId,
          apiToken,
          true, // isExcel
        );
      }

      // Step 2: Prepare email attachments
      const emailAttachments: EmailAttachment[] = [];

      // Add candidate attachments
      attachments.forEach(attachment => {
        emailAttachments.push({
          filename: attachment.name,
          path: attachment.fullPath,
        });
      });

      // Add shortlist documents
      if (shortlistAttachment) {
        emailAttachments.push({
          filename: shortlistAttachment.name,
          path: shortlistAttachment.fullPath,
        });
      }

      if (excelAttachment) {
        emailAttachments.push({
          filename: excelAttachment.name,
          path: excelAttachment.fullPath,
        });
      }

      // Step 3: Create email draft
      const emailData = {
        phoneNumber: '918411937769', // This should be configurable
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
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  private async uploadShortlistDocument(
    user: any,
    filePath: string,
    cvSentId: string,
    apiToken: string,
    isExcel: boolean = false,
  ): Promise<any> {
    try {
      const uploadUrl = `${process.env.SERVER_BASE_URL}/graphql`;

      const fileExtension = filePath.split('.').pop();
      const fileName = isExcel
        ? 'shortlist.xlsx'
        : fileExtension === 'docx'
          ? 'Executive Shortlist.docx'
          : 'Executive Shortlist.pdf';

      const payload = {
        operations: JSON.stringify({
          operationName: 'uploadFile',
          variables: { file: null, fileFolder: 'Attachment' },
          query: 'mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\\n  uploadFile(file: $file, fileFolder: $fileFolder)\\n}',
        }),
        map: JSON.stringify({ '1': ['variables.file'] }),
      };

      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('operations', payload.operations);
      formData.append('map', payload.map);
      formData.append('1', require('fs').createReadStream(filePath), {
        filename: fileName,
        contentType: 'application/octet-stream',
      });

      const headers = {
        accept: '*/*',
        authorization: `Bearer ${apiToken}`,
        ...formData.getHeaders(),
      };

      const response = await axios.post(uploadUrl, formData, { headers });

      // Check for GraphQL errors
      if (response.data.errors) {
        console.error('GraphQL errors in uploadFile response:', response.data.errors);
        throw new Error(`GraphQL error: ${JSON.stringify(response.data.errors)}`);
      }

      const uploadedFilePath = response.data?.data?.uploadFile;
      if (!uploadedFilePath) {
        console.error('Upload response structure:', JSON.stringify(response.data, null, 2));
        throw new Error('Failed to get upload file path from response');
      }

      // Create attachment record
      const createAttachmentPayload = {
        operationName: 'CreateOneAttachment',
        variables: {
          input: {
            name: fileName,
            fullPath: uploadedFilePath,
            fileCategory: 'OTHER',
            cvSentId: cvSentId,
          },
        },
        query: graphQLtoCreateOneAttachmentFromFilePath,
      };

      const attachmentResponse = await axios.post(
        uploadUrl,
        createAttachmentPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${apiToken}`,
          },
        },
      );

      // Check for GraphQL errors
      if (attachmentResponse.data.errors) {
        console.error('GraphQL errors in createAttachment response:', attachmentResponse.data.errors);
        throw new Error(`GraphQL error: ${JSON.stringify(attachmentResponse.data.errors)}`);
      }

      const createdAttachment = attachmentResponse.data?.data?.createAttachment;
      if (!createdAttachment) {
        console.error('Create attachment response structure:', JSON.stringify(attachmentResponse.data, null, 2));
        throw new Error('Failed to create attachment record');
      }

      return createdAttachment;
    } catch (error) {
      console.error('Error uploading shortlist document:', error);
      return null;
    }
  }

  private async createDraftEmail(
    emailData: any,
    origin: string,
    apiToken: string,
  ): Promise<any> {
    try {
      const url = `${process.env.SERVER_BASE_URL}/gmail-calendar-contacts/save-draft-mail-with-attachment`;

      const headers = {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      };

      console.log('Creating draft email:', url);
      console.log('Email data:', emailData);

      const response = await axios.post(url, emailData, { headers, timeout: 60000 });

      console.log('Draft email response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating draft email:', error);
      throw error;
    }
  }
}
