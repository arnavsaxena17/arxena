


// // sendRequestsSequentially();

// import axios from "axios";
// import { axiosRequest } from "../../utils/arx-chat-agent-utils";
// import * as allGraphQLQueries from "../../services/candidate-engagement/graphql-queries-chatbot";
// const FormData = require('form-data');
// import fs from 'fs';
// import path from 'path';
// import { GraphQLClient, gql } from 'graphql-request';

// export class AttachmentProcessingService {

//   async  uploadAttachmentToTwenty(){
//     let data = new FormData();
//     data.append('operations', '{"operationName":"uploadFile","variables":{"file":null,"fileFolder":"Attachment"},"query":"mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\\n  uploadFile(file: $file, fileFolder: $fileFolder)\\n}"}');
//     data.append('map', '{"1":["variables.file"]}');
//     data.append('1', fs.createReadStream('JD - Unit Head  - Environment Infra - Ahmedabad.pdf'));
//     let config = {
//       method: 'post',
//       maxBodyLength: Infinity,
//       url: 'http://localhost:3000/graphql',
//       headers: { 
//         'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"', 
//         'DNT': '1', 
//         'sec-ch-ua-mobile': '?0', 
//         'authorization': 'Bearer '+process.env.TWENTY_JWT_TOKEN, 
//         'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 
//         'x-schema-version': '41', 
//         'accept': '*/*', 
//         'Referer': 'http://localhost:3001/', 
//         'sec-ch-ua-platform': '"macOS"', 
//         ...data.getHeaders()
//       },
//       data : data
//     };
//     try {
//         const response = await axios.request(config);
//         console.log("This is the response from the axios request::", response.data);
//         return response.data;    
//     } catch (error) {
//         console.log(error);
//     }
//   }

//   async  fetchAllAttachmentsByJobId(jobId:string){
//     console.log("REceived Job ID:", jobId)
//       let graphqlQueryObj = JSON.stringify({
//         query: allGraphQLQueries.graphqlQueryTofindManyAttachmentsByJobId,
//         variables: {"filter":{"jobId":{"eq":jobId}},"orderBy":{"createdAt":"DescNullsFirst"}}
//       });
//       try {
//           const response = await axiosRequest(graphqlQueryObj);
//           console.log("Received ressponse for JD attachmentsResponse:", response);
//           const attachments = response?.data?.data?.attachments?.edges[0];
//           console.log("Atachments:", attachments)
//           return attachments;
//       } catch (error) {
//           console.log(error);
//       }
//   }
//     // getJDForJob(candidateId: string) {
//     //     console.log("Running getJDForJob")
//     //     console.log("This is the jobId to get JD for:", jobId)
//     //     const jobDocument = await findJob(jobId);
//     //     console.log("This is the job document:", jobDocument)
//     //     if (!jobDocument || !jobDocument.jobDescription) {
//     //         // Handle the case where no document is found or there is no job description
//     //         console.error('No job description found.');
//     //         return [];
//     //     }
//     //     return jobDocument.jobDescription;
//     // }



//   async fetchAllAttachmentsByCandidateID(candidateID){
//     const directoryPath = `/Users/aryanbansal/arxena-fork-twenty/twenty/packages/twenty-server/dist/src/engine/core-modules/arx-chat/services/whatsapp-api/downloads/${candidateID}`;
//     try {
//         // Check if the directory exists
//         if (fs.existsSync(directoryPath)) {
//             // Read the contents of the directory
//             const files = fs.readdirSync(directoryPath);
//             // Return the array of documents
//             return files;
//         } else {
//             console.log(`No documents found for candidate with ID ${candidateID}`);
//             return [];
//         }
//     } catch (error) {
//         console.error('Error fetching attachments:', error);
//         throw error;
//     }
//   }





//   async uploadFile(candidateId: string, filePath: string, graphQLEndpoint: string, token: string) {
//     const fileName = path.basename(filePath);
//     const fileContent = fs.readFileSync(filePath);

//     // GraphQL mutation for creating an attachment
//     const mutation = gql`
//         mutation CreateOneAttachment($input: AttachmentCreateInput!) {
//             createAttachment(data: $input) {
//                 id
//                 name
//                 fullPath
//                 candidateId
//                 createdAt
//                 updatedAt
//             }
//         }
//     `;

//     // Prepare the variables for the mutation
//     const variables = {
//         input: {
//             authorId: "20202020-0687-4c41-b707-ed1bfca972a7", // Example authorId, replace with actual value
//             name: fileName,
//             candidateId: candidateId,
//             fullPath: `attachment/${fileName}`, // This should be adjusted based on your backend setup
//             type: "TextDocument",
//             createdAt: new Date().toISOString(),
//             updatedAt: new Date().toISOString(),
//         }
//     };

//     const client = new GraphQLClient(graphQLEndpoint, {
//         headers: {
//             Authorization: `Bearer ${token}`,
//         },
//     });

//     try {
//         const response = await client.request(mutation, variables);
//         console.log('File uploaded successfully:', response.createAttachment);
//     } catch (error) {
//         console.error('Error uploading file:', error);
//     }
//   }

// // Function to upload all files of a candidate
//   async uploadAllFilesByCandidateID(candidateID: string, directoryPath: string, graphQLEndpoint: string, token: string) {
//       const candidateDir = path.join(directoryPath, candidateID);

//       // Check if the directory exists
//       if (!fs.existsSync(candidateDir)) {
//           console.log(`No documents found for candidate with ID ${candidateID}`);
//           return;
//       }

//       // Read all files in the candidate's directory
//       const files = fs.readdirSync(candidateDir);

//       // Upload each file
//       for (const file of files) {
//           const filePath = path.join(candidateDir, file);
//           await this.uploadFile(candidateID, filePath, graphQLEndpoint, token);
//       }
//   }

// }
























import axios from "axios";
import { axiosRequest } from "../../utils/arx-chat-agent-utils";
import * as allGraphQLQueries from "../../services/candidate-engagement/graphql-queries-chatbot";
const FormData = require('form-data');
import fs from 'fs';
import path from 'path';
import { GraphQLClient, gql } from 'graphql-request';



interface CreateAttachmentResponse {
  createAttachment: {
      id: string;
      name: string;
      fullPath: string;
      candidateId: string;
      createdAt: string;
      updatedAt: string;
  };
}

export class AttachmentProcessingService {


  // async uploadAttachmentToTwenty(documentUrl, documentId, mimeType, candidateID, documentName) {
  //   let data = new FormData();
  //   data.append('operations', '{"operationName":"uploadFile","variables":{"file":null,"fileFolder":"Attachment"},"query":"mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\\n  uploadFile(file: $file, fileFolder: $fileFolder)\\n}"}');
  //   data.append('map', '{"1":["variables.file"]}');
  //   data.append('1', fs.createReadStream(`${documentName}`));

  //   let config = {
  //     method: 'post',
  //     maxBodyLength: Infinity,
  //     url: 'http://localhost:3000/graphql',
  //     headers: { 
  //       'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"', 
  //       'DNT': '1', 
  //       'sec-ch-ua-mobile': '?0', 
  //       'authorization': 'Bearer ' + process.env.TWENTY_JWT_TOKEN, 
  //       'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 
  //       'x-schema-version': '41', 
  //       'accept': '*/*', 
  //       'Referer': 'http://localhost:3001/', 
  //       'sec-ch-ua-platform': '"macOS"', 
  //       ...data.getHeaders()
  //     },
  //     data: data
  //   };

  //   try {
  //     const response = await axios.request(config);
  //     console.log("This is the response from the axios request::", response.data);
  //     return response.data;
  //   } catch (error) {
  //     console.log(error);
  //   }
  // }







  async uploadAttachmentToTwenty(documentUrl, documentName) {
    console.log("Just entered uploading attachment to twenty!-----------");
    let data = new FormData();
    
    // Define the GraphQL mutation with variables
    data.append('operations', '{"operationName":"uploadFile","variables":{"file":null,"fileFolder":"Attachment"},"query":"mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\\n  uploadFile(file: $file, fileFolder: $fileFolder)\\n}"}');
    data.append('map', '{"1":["variables.file"]} ');
    data.append('1', fs.createReadStream(`${documentUrl}/${documentName}`));

    console.log("This is the data being used for operations: ", data);
  
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'http://localhost:3000/graphql',
      headers: { 
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"', 
        'DNT': '1', 
        'sec-ch-ua-mobile': '?0', 
        'authorization': `Bearer ${process.env.TWENTY_JWT_SECRET}`, 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 
        'x-schema-version': '41', 
        'accept': '*/*', 
        'Referer': 'http://localhost:3001/', 
        'sec-ch-ua-platform': '"macOS"', 
        ...data.getHeaders()
      },
      data: data
    };

    console.log("This just passed the config in uploading to twenty: ", data);
    debugger;
  
    try {
      const response = await axios.request(config);
      console.log("This is the response from the axios request::", response.data);
      return response.data;
    } catch (error) {
      console.error("Error uploading file:", error.message);
      throw error;
    }
  }





  async createOneAttachmentfunc(documentUrl, documentName, candidateID){
    const axios = require('axios');
    let data = JSON.stringify({
      query: `mutation CreateOneAttachment($input: AttachmentCreateInput!) {
      createAttachment(data: $input) {
        __typename
        whatsappMessageId
        company {
          __typename
          createdAt
          position
          idealCustomerProfile
          employees
          id
          address
          updatedAt
          name
          descriptionOneliner
          annualRecurringRevenue {
            amountMicros
            currencyCode
            __typename
          }
          accountOwnerId
          xLink {
            label
            url
            __typename
          }
          domainName
          linkedinLink {
            label
            url
            __typename
          }
        }
        authorId
        recruiterInterview {
          __typename
          createdAt
          analysis
          updatedAt
          name
          candidateId
          transcription
          schedule
          id
          position
        }
        candidateId
        fullPath
        clientInterview {
          __typename
          updatedAt
          id
          position
          name
          createdAt
          candidateId
          dateofInterview
        }
        personId
        answer {
          __typename
          position
          candidateId
          createdAt
          name
          updatedAt
          questionsId
          id
        }
        name
        opportunityId
        screening {
          __typename
          candidateId
          createdAt
          updatedAt
          name
          position
          id
        }
        cvsentId
        updatedAt
        offer {
          __typename
          updatedAt
          createdAt
          name
          numberofDays
          dateofJoining
          position
          id
        }
        createdAt
        jobId
        companyId
        question {
          __typename
          createdAt
          position
          id
          jobsId
          name
          updatedAt
        }
        screeningId
        clientInterviewId
        job {
          __typename
          recruiterId
          id
          companiesId
          name
          position
          createdAt
          isActive
          attachments{
            __typename
            # name
          }
          jobLocation
          updatedAt
        }
        id
        whatsappMessage {
          __typename
          updatedAt
          phoneFrom
          createdAt
          messageObj
          position
          message
          name
          id
          candidateId
          phoneTo
          recruiterId
          jobsId
        }
        person {
          __typename
          createdAt
          phone
          email
          avatarUrl
          city
          jobTitle
          updatedAt
          id
          linkedinLink {
            label
            url
            __typename
          }
          name {
            firstName
            lastName
            __typename
          }
          position
          companyId
          xLink {
            label
            url
            __typename
          }
        }
        recruiterInterviewId
        author {
          __typename
          name {
            firstName
            lastName
            __typename
          }
          userId
          locale
          userEmail
          id
          colorScheme
          avatarUrl
          updatedAt
          createdAt
        }
        activityId
        offerId
        questionId
        candidate {
          __typename
          id
          position
          engagementStatus
          peopleId
          jobsId
          name
          status
          createdAt
          updatedAt
          startChat
        }
        opportunity {
          __typename
          pointOfContactId
          amount {
            amountMicros
            currencyCode
            __typename
          }
          position
          closeDate
          stage
          createdAt
          updatedAt
          companyId
          id
          probability
          name
        }
        answerId
      }
    }`,
      variables: {"input":{
        "authorId":"20202020-0687-4c41-b707-ed1bfca972a7",
        "name": documentName,
        "fullPath":documentUrl,
        "type":"TextDocument",
        "candidateId":candidateID,
        "createdAt": new Date().toISOString(),
        "updatedAt": new Date().toISOString()
      }}
    });
    
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'http://localhost:3000/graphql',
      headers: { 
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8', 
        'Connection': 'keep-alive', 
        'DNT': '1', 
        'Origin': 'http://localhost:3001',
        'Referer': 'http://localhost:3001/', 
        'Sec-Fetch-Dest': 'empty', 
        'Sec-Fetch-Mode': 'cors', 
        'Sec-Fetch-Site': 'same-site', 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 
        'accept': '*/*', 
        'authorization': `Bearer ${process.env.TWENTY_JWT_SECRET}`,
        'content-type': 'application/json', 
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"', 
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"', 
        'x-schema-version': '41'
      },
      data : data
    };
    
    axios.request(config)
    .then((response) => {
      console.log("This is the creatingAttachment success",JSON.stringify(response.data));
    })
    .catch((error) => {
      console.log("Error in creatingAttachment: ",error);
    });
    debugger;
    
  }

























  async fetchAllAttachmentsByJobId(jobId: string) {
    console.log("Received Job ID:", jobId)
    let graphqlQueryObj = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryTofindManyAttachmentsByJobId,
      variables: { "filter": { "jobId": { "eq": jobId } }, "orderBy": { "createdAt": "DescNullsFirst" } }
    });
    try {
      const response = await axiosRequest(graphqlQueryObj);
      console.log("Received response for JD attachmentsResponse:", response);
      const attachments = response?.data?.data?.attachments?.edges[0];
      console.log("Attachments:", attachments)
      return attachments;
    } catch (error) {
      console.log(error);
    }
  }













  async fetchAllAttachmentsByCandidateID(candidateID: string) {
    const directoryPath = `/Users/aryanbansal/arxena-fork-twenty/twenty/packages/twenty-server/dist/src/engine/core-modules/arx-chat/services/whatsapp-api/downloads/${candidateID}`;
    try {
      // Check if the directory exists
      if (fs.existsSync(directoryPath)) {
        // Read the contents of the directory
        const files = fs.readdirSync(directoryPath);
        // Return the array of documents
        return files;
      } else {
        console.log(`No documents found for candidate with ID ${candidateID}`);
        return [];
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
      throw error;
    }
  }








  async UploadFileToGetPath(filePath){
    const axios = require('axios');
    const FormData = require('form-data');
    const fs = require('fs');
    let data = new FormData();
    data.append('operations', '{"operationName":"uploadFile","variables":{"file":null,"fileFolder":"Attachment"},"query":"mutation uploadFile($file: Upload!, $fileFolder: FileFolder) {\\n  uploadFile(file: $file, fileFolder: $fileFolder)\\n}"}');
    data.append('map', '{"1":["variables.file"]} ');
    data.append('1', fs.createReadStream(filePath));
    
    debugger;
    console.log("this is the filepath to upload: ", filePath);
  
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'http://localhost:3000/graphql',
      headers: { 
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8', 
        'Connection': 'keep-alive', 
        'DNT': '1', 
        'Origin': 'http://localhost:3001', 
        'Referer': 'http://localhost:3001/', 
        'Sec-Fetch-Dest': 'empty', 
        'Sec-Fetch-Mode': 'cors', 
        'Sec-Fetch-Site': 'same-site', 
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 
        'accept': '*/*', 
        'authorization': `Bearer ${process.env.TWENTY_JWT_SECRET}`,
        'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"', 
        'sec-ch-ua-mobile': '?0', 
        'sec-ch-ua-platform': '"macOS"', 
        'x-schema-version': '41', 
        ...data.getHeaders()
      },
      data : data
    };
    debugger;
  
    try {
      const response = await axios.request(config);
      console.log("This is the response of getFilePath from the axios request::", response.data);
      debugger;
      return response.data.data.uploadFile;
    } catch (error) {
      console.error("Error fetching path for file:", error.message);
      throw error;
    }
    
  }
}











































// {
//   "input": {
//     "name": "folaola.pdf",
//     "fullPath": "/Users/aryanbansal/arxena-fork-twenty/twenty/packages/twenty-server/dist/src/engine/core-modules/arx-chat/services/whatsapp-api/downloads/17a81551-8cbc-4c9a-9f00-1a09a39270ed/folaola.pdf",
//     "type": "pdf",
//     "candidateId": "17a81551-8cbc-4c9a-9f00-1a09a39270ed",
//     "createdAt": "2024-05-22T14:30:09.122Z",
//     "updatedAt": "2024-05-22T14:30:09.122Z"
//   }
// }












// async uploadFile(candidateId, filePath, graphQLEndpoint, token) {
//   const fileName = path.basename(filePath);
//   const fileContent = fs.readFileSync(filePath);

//   // GraphQL mutation for creating an attachment
//   const mutation = gql`
//     mutation CreateOneAttachment($input: AttachmentCreateInput!) {
//       createAttachment(data: $input) {
//         id
//         name
//         fullPath
//         candidateId
//         createdAt
//         updatedAt
//       }
//     }
//   `;

//   // Prepare the variables for the mutation
//   const variables = {
//     input: {
//       name: fileName,
//       candidateId: candidateId,
//       fullPath: filePath, // This should be adjusted based on your backend setup
//       type: "document",
//       createdAt: new Date().toISOString(),
//       updatedAt: new Date().toISOString(),
//     }
//   };

//   const client = new GraphQLClient(graphQLEndpoint, {
//     headers: {
//       Authorization: `bearer ${token}`,
//     },
//   });

//   try {
//     const response = await client.request<CreateAttachmentResponse>(mutation, variables);
//     console.log('File uploaded successfully:', response.createAttachment);
//   } catch (error) {
//     console.error('Error uploading file:', error);
//   }
// }

// // Function to upload all files of a candidate
// async uploadAllFilesByCandidateID(candidateID) {
//   console.log("Entered into uploadallfilesbycandidateID");
//   const graphQLEndpoint = 'http://localhost:3000/graphql';
//   const token = process.env.TWENTY_JWT_SECRET;
//   console.log("This is the token used fir authentication: ", token);
//   const directoryPath = `/Users/aryanbansal/arxena-fork-twenty/twenty/packages/twenty-server/dist/src/engine/core-modules/arx-chat/services/whatsapp-api/downloads/${candidateID}`;

//   const candidateDir = `${directoryPath}`;
//   console.log("this is the directory in uploadallfilesbycandidateID: ", candidateDir);

//   // Check if the directory exists
//   if (!fs.existsSync(candidateDir)) {
//     console.log(`No documents found for candidate with ID ${candidateID}`);
//     return;
//   }

//   // Read all files in the candidate's directory
//   const files = fs.readdirSync(candidateDir);

//   // Upload each file
//   for (const file of files) {
//     const filePath = `${directoryPath}/${file}`;
//     console.log("This is the file founded in CandidateID's Folder", file);
//     await this.uploadFile(candidateID, filePath, graphQLEndpoint, token);
//   }
// }