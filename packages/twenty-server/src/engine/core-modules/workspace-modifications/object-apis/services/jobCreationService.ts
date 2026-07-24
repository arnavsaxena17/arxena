// // jobCreationService.ts

// import axios from 'axios';
// import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
// import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// import { graphqlToAddNewJob } from 'twenty-shared';

// // import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';

// interface JobCreationResponse {
//   jobId: string;
//   arxenaSiteId: string;
//   arxenaResponse: any;
//   // candidatesResponse: any;
//   googleSheetId: string;
//   googleSheetUrl: string;
// }

// console.log(
//   'This is the process.env.SERVER_BASE_URL::',
//   process.env.SERVER_BASE_URL,
// );

// export class JobCreationService {
//   private baseUrl: string = process.env.SERVER_BASE_URL || 'http://app.arxena.com';
  
//   constructor(
//     private readonly staticGraphQLService: StaticGraphQLService,
//     private readonly workspaceQueryService: WorkspaceQueryService,
//   ) {}

//   private async createNewJob(jobName: string, apiToken: string): Promise<string> {
//     const graphqlVariables = { input: { name: jobName, position: 'first', }, };
//     const response = await this.staticGraphQLService.executeGraphQL(graphqlToAddNewJob, graphqlVariables, apiToken);
//     // await this.markOldJobsInactive(apiToken);
//     console.log('This is the response from createNewJob::', response.data);
//     if (!response.data?.data.createJob?.id) {
//       console.log('Failed to create job: No job ID received');
//     }

//     return response.data.data.createJob.id;
//   }

//   // async markOldJobsInactive(apiToken: string): Promise<void> {
//   //   console.log('Marking old jobs inactive in job creation service');
//   //   let jobs: any[] = [];
//   //   try {
//   //     const responseForAllJobs = await this.staticGraphQLService.executeGraphQL(graphqlToFindManyJobs, {}, apiToken);
//   //     console.log('This is the response for all jobs::', responseForAllJobs);
//   //     jobs = responseForAllJobs?.data?.data?.jobs?.edges || [];
//   //     console.log('This is the jobs::', jobs);
//   //   } catch (error) {
//   //     console.log('Error in markOldJobsInactive', error);
//   //   }
//   //   console.log('This is the jobs::', jobs);
//   //   const sortedJobs = jobs.sort((a, b) => {
//   //     const dateA = new Date(a.node.createdAt);
//   //     const dateB = new Date(b.node.createdAt);
//   //     return dateB.getTime() - dateA.getTime();
//   //   });
//   //   console.log('This is the sorted jobs::', sortedJobs);
//   //   for (let i = 0; i < sortedJobs.length; i++) {
//   //     const jobId = sortedJobs[i].node.id;
//   //     const isActive = sortedJobs[i].node.isActive;

//   //     if (isActive && i >= 5) {
//   //       console.log('This is the job id::', jobId, 'and the isActive::', isActive);
//   //       await this.staticGraphQLService.executeGraphQL(UpdateOneJob,
//   //         {
//   //           input: {
//   //             id: jobId,
//   //             isActive: false
//   //           }
//   //         },
//   //         apiToken
//   //       );
//   //     }
//   //   }
//   // }


  
//   private async createJobInArxena(
//     jobName: string,
//     newJobId: string,
//     jobId: string,
//     apiToken: string,
//   ): Promise<any> {
//     const response = await axios.request({
//       method: 'post',
//       url: `${this.baseUrl}/candidate-sourcing/create-job-in-arxena-and-sheets`,
//       headers: {
//         Authorization: `Bearer ${apiToken}`,
//         'Content-Type': 'application/json',
//       },
//       data: { job_name: jobName, new_job_id: newJobId, id_to_update: jobId },
//     });

//     return response.data;
//   }

//   private async postCandidates(candidatesData: any, apiToken: string): Promise<any> {
//     const response = await axios.request({
//       method: 'post',
//       url: `${this.baseUrl}/candidate-sourcing/post-candidates`,
//       headers: {
//         'Content-Type': 'application/json',
//         Authorization: `Bearer ${apiToken}`,
//       },
//       data: candidatesData,
//     });

//     console.log('This is the response from post-candidates::', response.data);

//     return response.data;
//   }

//   public async executeJobCreationFlow(
//     jobName: string,
//     candidatesData: any,
//     twentyToken: string,
//     arxenaSiteId: string,
//   ): Promise<JobCreationResponse | undefined> {
//     const googleSheetId = '';
//     const googleSheetUrl = '';

//     try {
//       try {
//         console.log('There is a candidate flow::', candidatesData);
//         if (Array.isArray(candidatesData)) {
//           const candidateRows = candidatesData.map((candidate) => [
//             candidate.name || '',
//             candidate.email || '',
//             candidate.phone || '',
//             candidate.currentCompany || '',
//             candidate.currentTitle || '',
//             'New',
//             '',
//           ]);

//           console.log('GOign to update some values::::', candidateRows);
//         }
//       } catch (error) {
//         console.log('Error creating Google Spreadsheet:', error);
//       }
//       const jobId = await this.createNewJob(jobName, twentyToken);

//       console.log('This is the jobId::', jobId);
//       const arxenaResponse = await this.createJobInArxena(
//         jobName,
//         arxenaSiteId,
//         jobId,
//         twentyToken,
//       );

//       return {
//         jobId,
//         arxenaSiteId,
//         arxenaResponse,
//         // candidatesResponse,
//         googleSheetId,
//         googleSheetUrl,
//       };
//     } catch (error) {
//       console.log('Error in job creation flow:', error);
//     }
//   }
// }
