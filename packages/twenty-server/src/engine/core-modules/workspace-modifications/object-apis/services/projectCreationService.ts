// // projectCreationService.ts

// import axios from 'axios';
// import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
// import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
// import { graphqlToAddNewProject } from 'twenty-shared';

// // import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';

// interface JobCreationResponse {
//   projectId: string;
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

// export class ProjectCreationService {
//   private baseUrl: string = process.env.SERVER_BASE_URL || 'http://app.arxena.com';
  
//   constructor(
//     private readonly staticGraphQLService: StaticGraphQLService,
//     private readonly workspaceQueryService: WorkspaceQueryService,
//   ) {}

//   private async createNewJob(jobName: string, apiToken: string): Promise<string> {
//     const graphqlVariables = { input: { name: jobName, position: 'first', }, };
//     const response = await this.staticGraphQLService.executeGraphQL(graphqlToAddNewProject, graphqlVariables, apiToken);
//     // await this.markOldJobsInactive(apiToken);
//     console.log('This is the response from createNewJob::', response.data);
//     if (!response.data?.data.createProject?.id) {
//       console.log('Failed to create job: No job ID received');
//     }

//     return response.data.data.createProject.id;
//   }

//   // async markOldJobsInactive(apiToken: string): Promise<void> {
//   //   console.log('Marking old jobs inactive in job creation service');
//   //   let projects: any[] = [];
//   //   try {
//   //     const responseForAllJobs = await this.staticGraphQLService.executeGraphQL(graphqlToFindManyProjects, {}, apiToken);
//   //     console.log('This is the response for all projects::', responseForAllJobs);
//   //     projects = responseForAllJobs?.data?.data?.projects?.edges || [];
//   //     console.log('This is the projects::', jobs);
//   //   } catch (error) {
//   //     console.log('Error in markOldJobsInactive', error);
//   //   }
//   //   console.log('This is the projects::', jobs);
//   //   const sortedJobs = jobs.sort((a, b) => {
//   //     const dateA = new Date(a.node.createdAt);
//   //     const dateB = new Date(b.node.createdAt);
//   //     return dateB.getTime() - dateA.getTime();
//   //   });
//   //   console.log('This is the sorted projects::', sortedJobs);
//   //   for (let i = 0; i < sortedJobs.length; i++) {
//   //     const projectId = sortedJobs[i].node.id;
//   //     const isActive = sortedJobs[i].node.isActive;

//   //     if (isActive && i >= 5) {
//   //       console.log('This is the job id::', projectId, 'and the isActive::', isActive);
//   //       await this.staticGraphQLService.executeGraphQL(UpdateOneProject,
//   //         {
//   //           input: {
//   //             id: projectId,
//   //             isActive: false
//   //           }
//   //         },
//   //         apiToken
//   //       );
//   //     }
//   //   }
//   // }


  
//   private async createProjectInArxena(
//     jobName: string,
//     newProjectId: string,
//     projectId: string,
//     apiToken: string,
//   ): Promise<any> {
//     const response = await axios.request({
//       method: 'post',
//       url: `${this.baseUrl}/candidate-sourcing/create-project-in-arxena-and-sheets`,
//       headers: {
//         Authorization: `Bearer ${apiToken}`,
//         'Content-Type': 'application/json',
//       },
//       data: { job_name: jobName, new_job_id: newProjectId, id_to_update: projectId },
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
//       const projectId = await this.createNewJob(jobName, twentyToken);

//       console.log('This is the projectId::', projectId);
//       const arxenaResponse = await this.createProjectInArxena(
//         jobName,
//         arxenaSiteId,
//         projectId,
//         twentyToken,
//       );

//       return {
//         projectId,
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
