// sendRequestsSequentially();

import fs from 'fs';

import axios from 'axios';
import FormData from 'form-data';
import {
  findManyAttachmentsQuery,
  graphQLtoCreateOneAttachmentFromFilePath,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';

export class AttachmentProcessingService {
  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}
  async uploadAttachmentToTwenty(filePath: string, apiToken: string) {
    const data = new FormData();

    data.append(
      'operations',
      '{"operationName":"uploadFile","variables":{"file":null,"fileFolder":"Attachment"},"query":"mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\\n  uploadFile(file: $file, fileFolder: $fileFolder)\\n}"}',
    );
    data.append('map', '{"1":["variables.file"]}');
    data.append('1', fs.createReadStream(filePath));
    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: process.env.SERVER_BASE_URL + '/graphql',
      headers: {
        authorization: 'Bearer ' + apiToken,
        accept: '*/*',
        ...data.getHeaders(),
      },
      data: data,
    };

    try {
      const response = await axios.request(config);

      console.log(
        'This is the response from the axios request in upload Attachment to Arxena::',
        response.data,
      );

      return response.data;
    } catch (error) {
      console.log('This is error', error);
    }
  }

  async createOneAttachmentFromFilePath(
    documentObj: {
      input: {
        name: string;
        fullPath: string;
        fileCategory: string;
        candidateId?: string;
        responseId?: string;
        personId?: string;
        cvSentId?: string;
        videoInterviewResponseId?: string;
      };
    },
    apiToken: string,
  ) {

    const response = await this.staticGraphQLService.executeGraphQL(graphQLtoCreateOneAttachmentFromFilePath, documentObj, apiToken);

    return response.data;
  }

  async fetchAllAttachmentsByProjectId(projectId: string, apiToken: string) {
    console.log('Received Project ID:', projectId);

    try {
      const response = await this.staticGraphQLService.executeGraphQL(findManyAttachmentsQuery, { filter: { projectId: { eq: projectId } }, orderBy: { createdAt: 'DescNullsFirst' } }, apiToken);
      const attachments = response?.data?.data?.attachments?.edges[0];

      console.log('Attachments:', attachments);

      return attachments;
    } catch (error) {
      console.log(error);
    }
  }
}
