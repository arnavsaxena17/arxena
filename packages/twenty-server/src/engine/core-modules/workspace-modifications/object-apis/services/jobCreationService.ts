// jobCreationService.ts

import axios from 'axios';
import { CreateOneJob } from 'twenty-shared';

// import { GoogleSheetsService } from 'src/engine/core-modules/google-sheets/google-sheets.service';


interface JobCreationResponse {
  jobId: string;
  arxenaJobId: string;
  arxenaResponse: any;
  // candidatesResponse: any;
  googleSheetId: string;
  googleSheetUrl: string;
}

console.log("This is the process.env.SERVER_BASE_URL::", process.env.SERVER_BASE_URL)

export class JobCreationService {
  private apiToken: string;
  private baseUrl: string;
  constructor(apiToken: string, baseUrl: string = process.env.SERVER_BASE_URL || 'http://app.arxena.com') {
    this.apiToken = apiToken;
    this.baseUrl = baseUrl;
  }

  private async createNewJob(jobName: string): Promise<string> {
    const response = await axios.request({
      method: 'post',
      url: `${this.baseUrl}/graphql`,
      headers: { 'authorization': `Bearer ${this.apiToken}`, 'content-type': 'application/json', },
      data: { variables: { input: { name: jobName, position: "first" } }, query: CreateOneJob }
    });

    console.log("This is the response from createNewJob::", response.data); // This is the response from createNewJob:: { data: { createJob: { id: '7bf69cfb-19ad-42d8-935d-b552341cfb6a', name: 'Test Job', position: 'first' } } }
    if (!response.data?.data.createJob?.id) {
      console.log('Failed to create job: No job ID received');
    }
    return response.data.data.createJob.id;
  }

  private async createJobInArxena(jobName: string, newJobId: string, jobId: string): Promise<any> {
    const response = await axios.request({
      method: 'post',
      url: `${this.baseUrl}/candidate-sourcing/create-job-in-arxena-and-sheets`,
      headers: { 'Authorization': `Bearer ${this.apiToken}`, 'Content-Type': 'application/json', },
      data: { job_name: jobName, new_job_id: newJobId, id_to_update: jobId }
    });
    return response.data;
  }

  private async postCandidates(candidatesData: any): Promise<any> {
    const response = await axios.request({
      method: 'post',
      url: `${this.baseUrl}/candidate-sourcing/post-candidates`,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiToken}` },
      data: candidatesData
    });
    console.log("This is the response from post-candidates::", response.data);

    return response.data;
  }

  public async executeJobCreationFlow( jobName: string, candidatesData: any, twentyToken: string, arxenaJobId:string ): Promise<JobCreationResponse | undefined> {
    let googleSheetId: string = '';
    let googleSheetUrl: string = '';
    try {
      try {
        console.log("There is a candidate flow::", candidatesData);
        if (Array.isArray(candidatesData)) {
          const candidateRows = candidatesData.map(candidate => [
            candidate.name || '',
            candidate.email || '',
            candidate.phone || '',
            candidate.currentCompany || '',
            candidate.currentTitle || '',
            'New',
            ''
          ]);
          console.log("GOign to update some values::::", candidateRows);
        }
      } catch (error) {
        console.log('Error creating Google Spreadsheet:', error);
      }
      const jobId = await this.createNewJob(jobName);
      console.log("This is the jobId::", jobId);
      const arxenaResponse = await this.createJobInArxena( jobName, arxenaJobId, jobId );
      return {
        jobId,
        arxenaJobId,
        arxenaResponse,
        // candidatesResponse,
        googleSheetId,
        googleSheetUrl
      };

    } catch (error) {
      console.log('Error in job creation flow:', error);
    }
  }
}