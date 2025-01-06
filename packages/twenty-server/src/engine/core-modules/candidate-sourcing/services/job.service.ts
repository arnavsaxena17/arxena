import { Injectable } from '@nestjs/common';
import { axiosRequest } from '../utils/utils';
import { JobCandidateUtils } from '../utils/job-candidate-utils';
import { CreateOneJob, createOneQuestion, graphqlToFindManyJobByArxenaSiteId } from '../graphql-queries';
import axios from 'axios';
import * as CandidateSourcingTypes from '../types/candidate-sourcing-types';

@Injectable()
export class JobService {
  async getJobDetails(jobId: string, jobName: string, apiToken: string): Promise<CandidateSourcingTypes.Jobs> {
    function isValidMongoDBId(str: string) {
      if (!str || str.length !== 32) {
        return false;
      }
      const hexRegex = /^[0-9a-fA-F]{32}$/;
      return hexRegex.test(str);
    }

    function isValidUUIDv4(str: string) {
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidV4Regex.test(str);
    }

    let graphlQlQuery: string;
    if (isValidUUIDv4(jobId)) {
      graphlQlQuery = JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          filter: { id: { in: [jobId] } },
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      });
    } else if (isValidMongoDBId(jobId)) {
      graphlQlQuery = JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          filter: { arxenaSiteId: { in: [jobId] } },
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      });
    } else {
      graphlQlQuery = JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          filter: { name: { in: [jobName] } },
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      });
    }

    const response = await axiosRequest(graphlQlQuery, apiToken);
    return response.data?.data?.jobs?.edges[0]?.node;
  }

  async createJobInArxena(jobData: any, apiToken: string): Promise<any> {
    try {
      const url = process.env.ENV_NODE === 'production' 
        ? 'https://arxena.com/create_new_job' 
        : 'http://127.0.0.1:5050/create_new_job';

      if (!jobData?.job_name || !jobData?.new_job_id) {
        throw new Error('Missing required fields: job_name or new_job_id');
      }

      const response = await axios.post(
        url,
        { 
          job_name: jobData.job_name, 
          new_job_id: jobData.new_job_id 
        },
        { 
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${apiToken}` 
          } 
        },
      );
      return response.data.data.createJob;
    } catch (error) {
      console.error('Error in createJobInArxena:', error);
      throw error;
    }
  }

  async getAllJobs(apiToken: string) {
    const response = await axiosRequest(
      JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        }
      }),
      apiToken
    );
    return { jobs: response.data?.data?.jobs?.edges };
  }

  async testArxenaConnection(apiToken: string) {
    try {
      let arxenaSiteBaseUrl = process.env.NODE_ENV === 'development'
        ? (process.env.ARXENA_SITE_BASE_URL || 'http://127.0.0.1:5050')
        : (process.env.ARXENA_SITE_BASE_URL || 'https://arxena.com');

      arxenaSiteBaseUrl = 'http://127.0.0.1:5050';
      
      const response = await axios.post(
        `${arxenaSiteBaseUrl}/test-connection-from-arx-twenty`,
        { jobId: 'some-id' },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
        }
      );
      return { jobs: response.data };
    } catch (error) {
      console.error("Error in testArxenaConnection", error);
      throw error;
    }
  }

  async postJob(jobData: any, apiToken: string) {
    try {
      const graphqlVariables = { 
        input: { 
          name: jobData?.job_name, 
          arxenaSiteId: jobData?.job_id, 
          isActive: true, 
          jobLocation: jobData?.jobLocation, 
          jobCode: jobData?.jobCode, 
          recruiterId: jobData?.recruiterId, 
          companyId: jobData?.companyId 
        } 
      };
      
      const graphqlQueryObj = JSON.stringify({ 
        query: CreateOneJob, 
        variables: graphqlVariables 
      });
      
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      return { 
        status: 'success', 
        job_uuid: response.data.data.createJob.id 
      };
    } catch (error) {
      console.error('Error in postJob', error);
      throw error;
    }
  }

  async addQuestions(data: any, apiToken: string) {
    try {
      const jobObject = await this.getJobDetails(data?.job_id, data?.job_name, apiToken);
      const questions = data?.questions || [];

      for (const question of questions) {
        const graphqlVariables = { 
          input: { 
            name: question, 
            jobsId: jobObject?.id 
          } 
        };
        
        const graphqlQueryObj = JSON.stringify({ 
          query: createOneQuestion, 
          variables: graphqlVariables 
        });
        
        await axiosRequest(graphqlQueryObj, apiToken);
      }
      return { status: 'success' };
    } catch (error) {
      console.error('Error in add questions', error);
      throw error;
    }
  }
}