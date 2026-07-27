import fs from 'fs';

import axios from 'axios';
import FormData from 'form-data';
import {
  ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER,
  findManyAttachmentsQuery,
  getAttachmentDownloadUrl,
  getAttachmentTargetFieldIdName,
  graphQLtoCreateOneAttachmentFromFilePath,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';

type AttachmentFileInput = {
  fileId: string;
  label: string;
};

type CreateAttachmentInput = {
  name: string;
  file: AttachmentFileInput[];
  fileCategory?: string;
  targetCandidateId?: string;
  targetProjectId?: string;
  targetPersonId?: string;
  targetCompanyId?: string;
  cvSentId?: string;
  videoInterviewResponseId?: string;
  whatsappMessageId?: string;
  // Legacy aliases — remapped to target*Id before create
  candidateId?: string;
  projectId?: string;
  personId?: string;
  companyId?: string;
  fullPath?: string;
};

type UploadedAttachmentFile = {
  fileId: string;
  url: string;
  label: string;
};

const UPLOAD_FILES_FIELD_BY_UNIVERSAL_IDENTIFIER_MUTATION = `
  mutation UploadFilesFieldFileByUniversalIdentifier(
    $file: Upload!
    $fieldMetadataUniversalIdentifier: String!
  ) {
    uploadFilesFieldFileByUniversalIdentifier(
      file: $file
      fieldMetadataUniversalIdentifier: $fieldMetadataUniversalIdentifier
    ) {
      id
      name
      path
      size
      type
      createdAt
      url
    }
  }
`;

const remapLegacyAttachmentInput = (
  input: CreateAttachmentInput,
): CreateAttachmentInput => {
  const {
    candidateId,
    projectId,
    personId,
    companyId,
    fullPath: _fullPath,
    ...rest
  } = input;

  return {
    ...rest,
    ...(candidateId && !rest.targetCandidateId
      ? { targetCandidateId: candidateId }
      : {}),
    ...(projectId && !rest.targetProjectId
      ? { targetProjectId: projectId }
      : {}),
    ...(personId && !rest.targetPersonId ? { targetPersonId: personId } : {}),
    ...(companyId && !rest.targetCompanyId
      ? { targetCompanyId: companyId }
      : {}),
  };
};

export class AttachmentProcessingService {
  constructor(private readonly staticGraphQLService: StaticGraphQLService) {}

  async uploadAttachmentFile(
    filePath: string,
    apiToken: string,
    label?: string,
  ): Promise<UploadedAttachmentFile | undefined> {
    const fileName = label ?? filePath.split('/').pop() ?? 'attachment';
    const data = new FormData();

    data.append(
      'operations',
      JSON.stringify({
        operationName: 'UploadFilesFieldFileByUniversalIdentifier',
        variables: {
          file: null,
          fieldMetadataUniversalIdentifier:
            ATTACHMENT_FILE_FIELD_UNIVERSAL_IDENTIFIER,
        },
        query: UPLOAD_FILES_FIELD_BY_UNIVERSAL_IDENTIFIER_MUTATION,
      }),
    );
    data.append(
      'map',
      JSON.stringify({ '1': ['variables.file'] }),
    );
    data.append('1', fs.createReadStream(filePath), { filename: fileName });

    try {
      const response = await axios.request({
        method: 'post',
        maxBodyLength: Infinity,
        url: `${process.env.SERVER_BASE_URL}/metadata`,
        headers: {
          authorization: `Bearer ${apiToken}`,
          accept: '*/*',
          ...data.getHeaders(),
        },
        data,
      });

      const uploaded =
        response.data?.data?.uploadFilesFieldFileByUniversalIdentifier;

      if (!uploaded?.id) {
        console.log(
          'uploadAttachmentFile: unexpected response',
          response.data,
        );

        return undefined;
      }

      return {
        fileId: uploaded.id,
        url: uploaded.url,
        label: fileName,
      };
    } catch (error) {
      console.log('uploadAttachmentFile error', error);

      return undefined;
    }
  }

  // Legacy name — prefer uploadAttachmentFile
  async uploadAttachmentToTwenty(filePath: string, apiToken: string) {
    const uploaded = await this.uploadAttachmentFile(filePath, apiToken);

    if (!uploaded) {
      return undefined;
    }

    // Shape compatible with callers that read data.uploadFile as a path/url
    return {
      data: {
        uploadFile: uploaded.url,
        uploadedFile: uploaded,
      },
    };
  }

  async createAttachmentFromUploadedFile(
    documentObj: { input: CreateAttachmentInput },
    apiToken: string,
  ) {
    const input = remapLegacyAttachmentInput(documentObj.input);

    if (!input.file?.length) {
      throw new Error(
        'createAttachmentFromUploadedFile requires file: [{ fileId, label }]',
      );
    }

    return this.staticGraphQLService.executeGraphQL(
      graphQLtoCreateOneAttachmentFromFilePath,
      { input },
      apiToken,
    );
  }

  // Legacy name — remaps short FKs / fullPath-era inputs when possible
  async createOneAttachmentFromFilePath(
    documentObj: {
      input: CreateAttachmentInput & {
        responseId?: string;
      };
    },
    apiToken: string,
  ) {
    const { responseId, ...rest } = documentObj.input;
    const input = remapLegacyAttachmentInput({
      ...rest,
      ...(responseId ? { videoInterviewResponseId: responseId } : {}),
    });

    // Legacy callers only had fullPath — cannot create FILES attachment without fileId
    if (!input.file?.length) {
      console.error(
        'createOneAttachmentFromFilePath: missing file[]; migrate caller to uploadAttachmentFile first',
        { name: input.name, fullPath: documentObj.input.fullPath },
      );
      throw new Error(
        'Attachment create requires file: [{ fileId, label }]. Use uploadAttachmentFile first.',
      );
    }

    return this.createAttachmentFromUploadedFile({ input }, apiToken);
  }

  async fetchAllAttachmentsByProjectId(projectId: string, apiToken: string) {
    try {
      const targetProjectFieldIdName = getAttachmentTargetFieldIdName('project');
      const response = await this.staticGraphQLService.executeGraphQL(
        findManyAttachmentsQuery,
        {
          filter: { [targetProjectFieldIdName]: { eq: projectId } },
          orderBy: { createdAt: 'DescNullsFirst' },
        },
        apiToken,
      );
      const attachments = response?.data?.data?.attachments?.edges?.[0];

      return attachments;
    } catch (error) {
      console.log(error);
    }
  }

  getDownloadUrl(attachment: {
    file?: Array<{ url?: string | null } | null> | null;
    fullPath?: string | null;
  }): string | null {
    return getAttachmentDownloadUrl(attachment);
  }
}
