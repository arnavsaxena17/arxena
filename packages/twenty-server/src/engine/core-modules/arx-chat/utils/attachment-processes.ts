// sendRequestsSequentially();

import fs from 'fs';

import axios from 'axios';
import FormData from 'form-data';
import {
  findManyAttachmentsQuery,
  graphQLtoCreateOneAttachmentFromFilePath,
} from 'twenty-shared';

import { axiosRequest } from './arx-chat-agent-utils';

export class AttachmentProcessingService {
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
        'This is the response from the axios request in upload Attachment to TWenty::',
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
        authorId: string;
        name: string;
        fullPath: string;
        type: string;
        candidateId?: string;
        responseId?: string;
      };
    },
    apiToken: string,
  ) {
    const graphqlQueryObj = JSON.stringify({
      query: graphQLtoCreateOneAttachmentFromFilePath,
      variables: documentObj,
    });
    const response = await axiosRequest(graphqlQueryObj, apiToken);

    return response.data;
  }

  async fetchAllAttachmentsByJobId(jobId: string, apiToken: string) {
    console.log('Received Job ID:', jobId);
    const graphqlQueryObj = JSON.stringify({
      query: findManyAttachmentsQuery,
      variables: {
        filter: { jobId: { eq: jobId } },
        orderBy: { createdAt: 'DescNullsFirst' },
      },
    });

    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const attachments = response?.data?.data?.attachments?.edges[0];

      console.log('Attachments:', attachments);

      return attachments;
    } catch (error) {
      console.log(error);
    }
  }
}
