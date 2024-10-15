// sendRequestsSequentially();

import axios from "axios";
import { axiosRequest } from "../../utils/arx-chat-agent-utils";
import * as allGraphQLQueries from "../../services/candidate-engagement/graphql-queries-chatbot";
const FormData = require("form-data");
const fs = require("fs");

export class AttachmentProcessingService {
  async uploadAttachmentToTwenty(filePath: string) {
    let data = new FormData();
    data.append( "operations", '{"operationName":"uploadFile","variables":{"file":null,"fileFolder":"Attachment"},"query":"mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\\n  uploadFile(file: $file, fileFolder: $fileFolder)\\n}"}' );
    data.append("map", '{"1":["variables.file"]}');
    data.append("1", fs.createReadStream(filePath));
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: process.env.SERVER_BASE_URL+"/graphql",
      headers: {
        "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        DNT: "1", "sec-ch-ua-mobile": "?0",
        authorization: "Bearer " + process.env.TWENTY_JWT_SECRET,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "x-schema-version": "41",
        accept: "*/*",
        Referer: process.env.FRONT_BASE_URL+"/",
        "sec-ch-ua-platform": '"macOS"',
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

  async createOneAttachmentFromFilePath(documentObj: { input: { authorId: string; name: string; fullPath: string; type: string; candidateId: string; };
  }) {
    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphQLtoCreateOneAttachmentFromFilePath,
      variables: documentObj,
    });
    const response = await axiosRequest(graphqlQueryObj);
  }

  async fetchAllAttachmentsByJobId(jobId: string) {
    console.log("Received Job ID:", jobId);
    let graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryTofindManyAttachmentsByJobId,
      variables: {
        filter: { jobId: { eq: jobId } },
        orderBy: { createdAt: "DescNullsFirst" },
      },
    });
    try {
      const response = await axiosRequest(graphqlQueryObj);
      const attachments = response?.data?.data?.attachments?.edges[0];
      console.log("Attachments:", attachments);
      return attachments;
    } catch (error) {
      console.log(error);
    }
  }
}
