// jobCreationService.ts

import axios from 'axios';
import mongoose from 'mongoose';

interface JobCreationResponse {
  jobId: string;
  arxenaJobId: string;
  arxenaResponse: any;
  candidatesResponse: any;
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
      headers: {
        'authorization': `Bearer ${this.apiToken}`,
        'content-type': 'application/json',
      },
      data: {
        operationName: "CreateOneJob",
        variables: {
          input: {
            id: '7bf69cfb-19ad-42d8-935d-b552341cfb6a',
            name: jobName,
            position: "first"
          }
        },
        query: `mutation CreateOneJob($input: JobCreateInput!) {
          createJob(data: $input) {
            id
            name
            position
          }
        }`
      }
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
      url: `${this.baseUrl}/candidate-sourcing/create-job-in-arxena`,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        job_name: jobName,
        new_job_id: newJobId,
        id_to_update: jobId
      }
    });

    return response.data;
  }

  private async postCandidates(candidatesData: any): Promise<any> {
    const response = await axios.request({
      method: 'post',
      url: `${this.baseUrl}/candidate-sourcing/post-candidates`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`
      },
      data: candidatesData
    });
    console.log("This is the response from post-candidates::", response.data);

    return response.data;
  }

  public async executeJobCreationFlow(
    jobName: string, 
    candidatesData: any
  ): Promise<JobCreationResponse | undefined> {
    try {
      // Create new job
      const jobId = await this.createNewJob(jobName);
      console.log("This is the jobId::", jobId);

      // Generate new Arxena job ID
      const arxenaJobId = '64b29dbdf9822851831e4de9'


      // Create job in Arxena
      const arxenaResponse = await this.createJobInArxena(
        jobName,
        arxenaJobId,
        jobId
      );
      const candidateDataObj = JSON.stringify({
        "data": candidatesData,
        "job_id": arxenaJobId,     // Changed from jobId to job_id
        "job_name": jobName        // Changed from jobName to job_name
      });
        // Post candidates
      const candidatesResponse = await this.postCandidates(candidateDataObj);

      return {
        jobId,
        arxenaJobId,
        arxenaResponse,
        candidatesResponse
      };

    } catch (error) {
      console.log('Error in job creation flow:', error);
    }
  }
}