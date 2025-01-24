// sendRequestsSequentially();

import axios from "axios";
import { axiosRequest } from "../../utils/arx-chat-agent-utils";
import * as allGraphQLQueries from "../../graphql-queries/graphql-queries-chatbot";
const FormData = require("form-data");
const fs = require("fs");

export class AttachmentProcessingService {
  async uploadAttachmentToTwenty(filePath: string, apiToken:string) {
    let data = new FormData();
    data.append( "operations", '{"operationName":"uploadFile","variables":{"file":null,"fileFolder":"Attachment"},"query":"mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\\n  uploadFile(file: $file, fileFolder: $fileFolder)\\n}"}' );
    data.append("map", '{"1":["variables.file"]}');
    data.append("1", fs.createReadStream(filePath));
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.SERVER_BASE_URL+"/graphql",
      headers: {
        authorization: "Bearer " + apiToken,
        accept: "*/*",
        ...data.getHeaders(),
      },
      data: data,
    };
    try {
        const response = await axios.request(config);
        console.log("This is the response from the axios request in upload Attachment to TWenty::", response.data);
        return response.data;
    } catch (error) {
        console.log("This is error", error);
    }
  }

  async createOneAttachmentFromFilePath(documentObj: { input: { authorId: string; name: string; fullPath: string; type: string; candidateId?: string; responseId?: string;};
  },apiToken:string) {
    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphQLtoCreateOneAttachmentFromFilePath,
      variables: documentObj,
    });
    const response = await axiosRequest(graphqlQueryObj,  apiToken);
    return response.data;
  }

  async fetchAllAttachmentsByJobId(jobId: string,  apiToken:string) {
    console.log("Received Job ID:", jobId);
    let graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryTofindManyAttachmentsByJobId,
      variables: {
        filter: { jobId: { eq: jobId } },
        orderBy: { createdAt: "DescNullsFirst" },
      },
    });
    try {
      const response = await axiosRequest(graphqlQueryObj,  apiToken);
      const attachments = response?.data?.data?.attachments?.edges[0];
      console.log("Attachments:", attachments);
      return attachments;
    } catch (error) {
      console.log(error);
    }
  }
}
