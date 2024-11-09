import { Body, Controller, Post } from '@nestjs/common';
import { CreateManyCandidates, CreateManyPeople, graphQltoStartChat, CreateOneJob, graphQltoStopChat, createOneQuestion, graphqlToFindManyJobByArxenaSiteId } from './graphql-queries';
import { FetchAndUpdateCandidatesChatsWhatsapps } from '../arx-chat/services/candidate-engagement/update-chat';
import * as allDataObjects from '../arx-chat/services/data-model-objects';
import * as allGraphQLQueries from '../arx-chat/services/candidate-engagement/graphql-queries-chatbot';

import { axiosRequest } from './utils/utils';
import { processArxCandidate } from './utils/data-transformation-utility';
import { ArxenaCandidateNode, ArxenaPersonNode, Jobs, UserProfile } from './types/candidate-sourcing-types';
import axios from 'axios';
@Controller('candidate-sourcing')
export class CandidateSourcingController {
  async getJobDetails(arxenaJobId: string): Promise<Jobs> {
    // hack to check for job name being sent instead of job ID from arxena-site.
    function isValidMongoDBId(str) {
      // Check if string exists and is exactly 24 characters
      if (!str || str.length !== 32) {
        console.log("This is not a mongoid")
        return false;
      }
      // Check if string only contains valid hexadecimal characters
      const hexRegex = /^[0-9a-fA-F]{32}$/;
      return hexRegex.test(str);
    }
    let graphlQlQuery: string;
    if (!isValidMongoDBId(arxenaJobId)) {
      console.log("This is not a mongo id so querying name ")
      graphlQlQuery = JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          filter: { name: { in: [arxenaJobId] } },
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      });
    } else {
      console.log("This is a mongo id so querying id")
      graphlQlQuery = JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          filter: { arxenaSiteId: { in: [arxenaJobId] } },
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      });
    }
    const response = await axiosRequest(graphlQlQuery);
    console.log('Response status from get job', response.status);
    return response.data?.data?.jobs?.edges[0]?.node;
  }

  async createPeople(manyPersonObjects: ArxenaPersonNode[]): Promise<any> {
    console.log('Creating people, manyPersonObjects:', manyPersonObjects.length);
    const graphqlVariablesForPerson = { data: manyPersonObjects };
    const graphqlQueryObjForPerson = JSON.stringify({
      query: CreateManyPeople,
      variables: graphqlVariablesForPerson,
    });

    try {
      const responseForPerson = await axiosRequest(graphqlQueryObjForPerson);
      console.log('Response from graphqlQueryObjForPerson:', responseForPerson.status);
      console.log('Response from graphqlQueryObjForPerson:', responseForPerson.status);
      return responseForPerson;
    } catch (error) {
      console.error('Error in creating people', error);
      throw error;
    }
  }

  async createCandidates(manyCandidateObjects: ArxenaCandidateNode[]): Promise<any> {
    console.log('Creating candidates, manyCandidateObjects:', manyCandidateObjects?.length);
    console.log('Creating candidates, manyCandidateObjects:', manyCandidateObjects);
    console.log(
      'Creating candidates, manyCandidateObjects:',
      manyCandidateObjects.map(x => x?.name),
    );
    const graphqlVariablesForCandidate = { data: manyCandidateObjects };
    const graphqlQueryObjForCandidate = JSON.stringify({
      query: CreateManyCandidates,
      variables: graphqlVariablesForCandidate,
    });

    try {
      const responseForCandidate = await axiosRequest(graphqlQueryObjForCandidate);
      console.log('Response from creating candidates', responseForCandidate?.data);
      return responseForCandidate;
    } catch (error) {
      console.error('Error in creating candidates', error?.message);
      console.error('Error in creating candidates', error?.data);
      // throw error;
    }
  }

  async batchGetPersonDetailsByPhoneNumbers(phoneNumbers: string[]): Promise<Map<string, allDataObjects.PersonNode>> {
    const graphqlVariables = {
      filter: { phone: { in: phoneNumbers } },
      limit: 30, // Adjust based on your API's limits
    };

    const graphqlQuery = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber,
      variables: graphqlVariables,
    });

    try {
      const response = await axiosRequest(graphqlQuery);
      const people = response.data?.data?.people?.edges || [];
      const personMap: Map<string, allDataObjects.PersonNode> = new Map(people.map((edge: any) => [edge.node.phone, edge.node]));
      return personMap;
    } catch (error) {
      console.error('Error in batchGetPersonDetails:', error);
      throw error;
    }
  }
  async batchGetPersonDetailsByStringKeys(uniqueStringKeys: string[]): Promise<Map<string, allDataObjects.PersonNode>> {
    const graphqlVariables = {
      filter: { uniqueStringKey: { in: uniqueStringKeys } },
      limit: 30, // Adjust based on your API's limits
    };

    const graphqlQuery = JSON.stringify({
      query: allGraphQLQueries.graphqlQueryToFindPeopleByPhoneNumber,
      variables: graphqlVariables,
    });

    try {
      const response = await axiosRequest(graphqlQuery);
      const people = response.data?.data?.people?.edges || [];
      console.log("number of people:", response.data?.data?.people?.edges.length)
      console.log("Sampel person:", people[0])
      const personMap: Map<string, allDataObjects.PersonNode> = new Map(people.map((edge: any) => [edge.node.uniqueStringKey, edge.node]));
      console.log("personMap:", personMap)
      return personMap;
    } catch (error) {
      console.error('Error in batchGetPersonDetails:', error);
      throw error;
    }
  }

  async processProfilesWithRateLimiting(data: UserProfile[], jobObject: Jobs): Promise<{ manyPersonObjects: ArxenaPersonNode[]; manyCandidateObjects: ArxenaCandidateNode[], allPersonObjects: allDataObjects.PersonNode[];}> {
    console.log('Total number of profiles received:', data.length);
    const manyPersonObjects: ArxenaPersonNode[] = [];
    const allPersonObjects: allDataObjects.PersonNode[] = [];
    console.log('Job Object:', jobObject);
    const manyCandidateObjects: ArxenaCandidateNode[] = [];
    const batchSize = 25;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      // const phoneNumbers = batch.map(profile => profile.phone_number).filter(Boolean);
      // console.log('Total number of phone numbers in batch:', phoneNumbers.length);
      // const personDetailsMap = await this.batchGetPersonDetailsByPhoneNumbers(phoneNumbers);
      const uniqueStringKeys = batch.map(profile => profile?.unique_key_string).filter(Boolean);
      console.log('Total number of unique string keys in batch:%s', uniqueStringKeys.length);
      const personDetailsMap = await this.batchGetPersonDetailsByStringKeys(uniqueStringKeys);
      console.log('personDetailsMap:', personDetailsMap);

      for (const profile of batch) {
        console.log('this is the prfoile:', profile);
        const unique_key_string = profile?.unique_key_string;
        console.log('unique_key_string:', unique_key_string);
        console.log('unique_key_string profile:', profile);
        const personObj = personDetailsMap.get(unique_key_string);
        console.log('personObj:', personObj);
        if (!personObj || !personObj.name) {
          console.log('person obj not foiund, will creatre a new person object');
          const { personNode, candidateNode } = processArxCandidate(profile, jobObject);
          manyPersonObjects.push(personNode);
          manyCandidateObjects.push(candidateNode);
        } else {
          if (personObj.candidates?.edges.filter(x=>x.node.jobs.id === jobObject.id).length === 0) {
            // check if the person object is for the same candidate and job as the current job object
            console.log('Person object already exists for unique key_string:', unique_key_string);
            const { personNode, candidateNode } = processArxCandidate(profile, jobObject);
            manyCandidateObjects.push(candidateNode);
          }
        allPersonObjects.push(personObj);
        }
      }
      if (i + batchSize < data.length) {
        await delay(1000);
      }
    }
    console.log('Received total numbers in manyCandidateObjects:', manyCandidateObjects.length);
    console.log('Received total numbers in manyPersonObjects:', manyPersonObjects.length);
    return { manyPersonObjects: manyPersonObjects, manyCandidateObjects: manyCandidateObjects, allPersonObjects: allPersonObjects };
  }

  @Post('create-job-in-arxena')
  async createJobInArxena(@Body() body: any): Promise<Jobs> {
    console.log("going to create job in arxena")
    try {
      const url = process.env.NODE_ENV === 'production' ? 'https://arxena.com/create_new_job' : 'http://127.0.0.1:5050/create_new_job';

      const response = await axios.post(
        url,
        { job_name: body.job_name },
        {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ARXENA_API_KEY}` },
        },
      );
      console.log('Response from create job', response?.data);
      return response.data.data.createJob;
    } catch (error) {
      console.error('Error in createJobInArxena:', error);
      throw error;
    }
  }

  @Post('post-candidates')
  async sourceCandidates(@Body() body: any) {
    console.log('Called post candidates API');
    const arxenaJobId = body?.job_id;
    console.log('arxenaJobId:', arxenaJobId);
    const data: UserProfile[] = body?.data;
    console.log('Going to add and process candidate profiles');
    console.log('Going to add and arxena job Id', arxenaJobId);
    try {
      const jobObject = await this.getJobDetails(arxenaJobId);
      console.log('jobObject that is sent by arxena-site:', jobObject);
      const { manyPersonObjects, manyCandidateObjects, allPersonObjects} = await this.processProfilesWithRateLimiting(data, jobObject);
      console.log('Number of person objects created:', manyPersonObjects?.length);
      console.log('Number of allPersonObjects created:', allPersonObjects?.length);
      console.log('Number of person candidates created:', manyPersonObjects?.length);
      // if (manyPersonObjects.length === 0) {
      //   console.log('All candidates already exist');
      //   return { message: 'All candidates already exist' };
      // } else {
      //   console.log('candidates do not exist, will create new candidates');
      // }
      console.log('Creating people and candidates');
      let responseForPerson;
      if (manyPersonObjects.length > 0) {
        responseForPerson = await this.createPeople(manyPersonObjects);
        const arrayOfPersonIds = responseForPerson?.data?.data?.createPeople?.map((person: any) => person.id);
        console.log('Number of person Ids Created:', arrayOfPersonIds.length);
      }
      // manyCandidateObjects.forEach((candidate, index) => {
      //   candidate.peopleId = arrayOfPersonIds[index];
      // });
      manyCandidateObjects.forEach(candidate => {
        const matchingPerson = allPersonObjects.find(person => person?.uniqueStringKey === candidate?.uniqueStringKey && person?.uniqueStringKey !== '');
        if (!matchingPerson) {
          const createdPerson = responseForPerson?.data?.data?.createPeople?.find((person: any) => person.uniqueStringKey === candidate.uniqueStringKey);
          if (createdPerson) {
            candidate.peopleId = createdPerson.id;
          }
        }
        if (matchingPerson) {
          candidate.peopleId = matchingPerson?.id;
        }
      });
      console.log("This is the manyCandidateObjects:", manyCandidateObjects)
      console.log("This is one of the manyCandidateObjects:", manyCandidateObjects[0])
      const responseForCandidate = await this.createCandidates(manyCandidateObjects);
      return { status: 'success' };
    } catch (error) {
      console.log('Error in sourceCandidates:', error);
      return { error: error.message };
    }
  }

  @Post('get-job-details')
  async getJobDetailsByArxenaId(arxenaJobId: string): Promise<Jobs> {
    return this.getJobDetails(arxenaJobId);
  }

  @Post('get-all-jobs')
  async getJobs(@Body() body: any) {
    // first create companies
    console.log('Getting all jobs');
    const responseFromGetAllJobs = await axiosRequest(
      JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          limit: 30,
          orderBy: [{ position: 'AscNullsFirst' }],
        },
      }),
    );
    // console.log('Response status from get job', responseFromGetAllJobs.status);
    // console.log('Response data from get job', responseFromGetAllJobs.data);
    const jobsObject: Jobs = responseFromGetAllJobs.data?.data?.jobs?.edges;
    // const jobIdMetadataInCamelCaseFormat: string = camelCase(jobIdMetadata).charAt(0).toUpperCase() + camelCase(jobIdMetadata).slice(1);
    // const dynamicQueryName = (jobName + jobIdMetadataInCamelCaseFormat).charAt(0).toUpperCase() + camelCase(jobName + jobIdMetadataInCamelCaseFormat).slice(1);
    return { jobs: jobsObject };
  }

  @Post('post-job')
  async postJob(@Body() body: any) {
    let uuid;
    try {
      const data = body;
      console.log(body);
      const graphqlVariables = { input: { name: data?.job_name, arxenaSiteId: data?.job_id, isActive: true, jobLocation: data?.jobLocation, jobCode: data?.jobCode, recruiterId: data?.recruiterId, companiesId: data?.companiesId } };
      const graphqlQueryObj = JSON.stringify({ query: CreateOneJob, variables: graphqlVariables });
      const responseNew = await axiosRequest(graphqlQueryObj);
      console.log('Response from create job', responseNew.data);
      uuid = responseNew.data.data.createJob.id;
      return { status: 'success', job_uuid: uuid };
    } catch (error) {
      console.log('Error in postJob', error);
      return { error: error.message };
    }
  }

  @Post('add-questions')
  async addQuestions(@Body() body: any) {
    try {
      // console.log(body);
      const data = body;
      const arxenaJobId = data?.job_id;
      const jobObject = await this.getJobDetails(arxenaJobId);
      // console.log("getJobDetails:", jobObject);
      const questions = data?.questions || [];
      console.log('Number Questions:', questions?.length);
      for (const question of questions) {
        const graphqlVariables = { input: { name: question, jobsId: jobObject?.id } };
        const graphqlQueryObj = JSON.stringify({ query: createOneQuestion, variables: graphqlVariables });
        // console.log("graphqlQueryObj:", graphqlQueryObj);
        const response = await axiosRequest(graphqlQueryObj);
        // console.log('Response from adding question:', response.data);
      }
      return { status: 'success' };
    } catch (error) {
      console.log('Error in add questions', error);
      return { error: error.message };
    }
  }

  @Post('start-chat')
  async startChat(@Body() body: any) {
    const graphqlVariables = {
      idToUpdate: body.candidateId,
      input: {
        startChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStartChat,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj);
    console.log('Response from create startChat', response.data);
  }

  @Post('stop-chat')
  async stopChat(@Body() body: any) {
    const graphqlVariables = {
      idToUpdate: body.candidateId,
      input: {
        stopChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStopChat,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj);
    console.log('Response from create startChat', response.data);
  }

  @Post('fetch-candidate-by-phone-number-start-chat')
  async fetchCandidateByPhoneNumber(@Body() body: any) {
    console.log('called fetchCandidateByPhoneNumber for phone:', body.phoneNumber);
    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(body.phoneNumber);
    const candidateId = personObj.candidates?.edges[0]?.node?.id;
    const graphqlVariables = {
      idToUpdate: candidateId,
      input: {
        startChat: true,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStartChat,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj);
    console.log('Response from create startChat::', response.data);
    return response.data;
  }
}
