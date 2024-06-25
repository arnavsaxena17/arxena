// sendRequestsSequentially();

import axios from "axios";
import { axiosRequest } from "../../utils/arx-chat-agent-utils";
import * as allGraphQLQueries from "../../services/candidate-engagement/graphql-queries-chatbot";
const FormData = require("form-data");
const fs = require("fs");

export class AttachmentProcessingService {
  async uploadAttachmentToTwenty(filePath: string) {
    // debugger;
    let data = new FormData();
    data.append(
      "operations",
      '{"operationName":"uploadFile","variables":{"file":null,"fileFolder":"Attachment"},"query":"mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\\n  uploadFile(file: $file, fileFolder: $fileFolder)\\n}"}'
    );
    data.append("map", '{"1":["variables.file"]}');
    data.append("1", fs.createReadStream(filePath));
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "http://localhost:3000/graphql",
      headers: {
        "sec-ch-ua":
          '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        DNT: "1",
        "sec-ch-ua-mobile": "?0",
        authorization: "Bearer " + process.env.TWENTY_JWT_SECRET,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "x-schema-version": "41",
        accept: "*/*",
        Referer: "http://localhost:3001/",
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

  async createOneAttachmentFromFilePath(documentObj: {
    input: {
      authorId: string;
      name: string;
      fullPath: string;
      type: string;
      candidateId: string;
    };
  }) {
    const headers = {
      "sec-ch-ua":
        '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      DNT: "1",
      "sec-ch-ua-mobile": "?0",
      authorization: "Bearer " + process.env.TWENTY_JWT_SECRET,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "x-schema-version": "41",
      accept: "*/*",
      Referer: "http://localhost:3001/",
    };

    // const variables = {
    //     "authorId": documentObj.authorId,
    //     "name": documentObj.name,
    //     "fullPath": documentObj.fullPath,
    //     "type": documentObj.type,
    //     "candidateId": documentObj.candidateId
    // }
    const graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphQLtoCreateOneAttachmentFromFilePath,
      variables: documentObj,
    });
    // debugger
    const response = await axiosRequest(graphqlQueryObj);
    console.log(response);
    // debugger
  }

  async fetchAllAttachmentsByJobId(jobId: string) {
    console.log("REceived Job ID:", jobId);
    let graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryTofindManyAttachmentsByJobId,
      variables: {
        filter: { jobId: { eq: jobId } },
        orderBy: { createdAt: "DescNullsFirst" },
      },
    });
    try {
      const response = await axiosRequest(graphqlQueryObj);
      console.log("Received ressponse for JD attachmentsResponse:", response);
      const attachments = response?.data?.data?.attachments?.edges[0];
      console.log("Atachments:", attachments);
      return attachments;
    } catch (error) {
      console.log(error);
    }
  }
  // getJDForJob(candidateId: string) {
  //     console.log("Running getJDForJob")
  //     console.log("This is the jobId to get JD for:", jobId)
  //     const jobDocument = await findJob(jobId);
  //     console.log("This is the job document:", jobDocument)
  //     if (!jobDocument || !jobDocument.jobDescription) {
  //         // Handle the case where no document is found or there is no job description
  //         console.error('No job description found.');
  //         return [];
  //     }
  //     return jobDocument.jobDescription;
  // }
}
