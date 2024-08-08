import { Body, Controller, Post } from '@nestjs/common';
import { job, panda, arxenaColumns, arxenaColumnsV2 } from './constant';
import axios from 'axios';
import { CreateManyCandidates, CreateManyPeople, graphQltoStartChat, CreateOneFieldMetadataItem, CreateOneJob, CreateOneObjectMetadataItem, CreateOneRelationMetadata, ObjectMetadataItems, graphqlToFindManyJobByArxenaSiteId } from './graphql-queries';
import {FetchAndUpdateCandidatesChatsWhatsapps} from '../arx-chat/services/candidate-engagement/update-chat';
import { v4 as uuidv4 } from 'uuid';
import camelCase from 'camelcase';
import * as allDataObjects from '../arx-chat/services/data-model-objects';
import capitalize from 'capitalize';

import { axiosRequest, axiosRequestForMetadata } from './utils/utils';
import { url } from 'inspector';
import { CreateManyCustomMetadataObject, FindOneJob } from './graphql-queries';
import { processArxCandidate } from './utils/data-transformation-utility';
import { ArxenaCandidateNode, ArxenaPersonNode, Jobs, UserProfile } from './types/candidate-sourcing-types';
@Controller('candidate-sourcing')
export class CandidateSourcingController {
  @Post('post-candidates')
  async sourceCandidates(@Body() body: any) {
    // first create companies
    // then create people
    // console.log(panda);
    // console.log(body);
    // return panda;
    // console.log('Sourcing candidates', body);
    // // const responseBody = JSON.parse(body);
    const arxenaJobId = body?.job_id;
    const data: UserProfile[] = body?.data;
    const responseFromGetJob = await axiosRequest(
      JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          filter: { arxenaSiteId: { in: [arxenaJobId] } },
          limit: 30,
          orderBy: [ { position: 'AscNullsFirst' } ],
        },
      }),
    );
    console.log('Response status from get job', responseFromGetJob.status);
    const jobObject: Jobs = responseFromGetJob.data?.data?.jobs?.edges[0]?.node;
    const jobIdMetadata = responseFromGetJob.data?.data?.jobs?.edges[0]?.node?.id;
    // const jobIdMetadataInCamelCaseFormat: string = camelCase(jobIdMetadata).charAt(0).toUpperCase() + camelCase(jobIdMetadata).slice(1);
    // const dynamicQueryName = (jobName + jobIdMetadataInCamelCaseFormat).charAt(0).toUpperCase() + camelCase(jobName + jobIdMetadataInCamelCaseFormat).slice(1);
    let manyPersonObjects: ArxenaPersonNode[] = [];
    let manyCandidateObjects: ArxenaCandidateNode[] = [];
    for (let profile of data) {
      let uuid = uuidv4();
      const { personNode, candidateNode } = processArxCandidate(profile, jobObject);
      manyPersonObjects.push(personNode);
      manyCandidateObjects.push(candidateNode);
    }
    const graphqlVariablesForPerson = {
      data: manyPersonObjects,
    };
    const graphqlQueryObjForPerson = JSON.stringify({
      query: CreateManyPeople,
      variables: graphqlVariablesForPerson,
    });
    // console.log('Query for candidate', graphqlQueryObjForCandidate);
    let arrayOfPersonIds: string[] = [];
    try {
      // console.log("graphqlQueryObjForPerson:  ", graphqlQueryObjForPerson);
      const responseForPerson = await axiosRequest(graphqlQueryObjForPerson);
      console.log("Response from graphqlQueryObjForPerson:", responseForPerson.status);
      responseForPerson.data.data.createPeople.forEach((person: any) => {
        console.log('Person ID', person?.id);
        arrayOfPersonIds.push(person?.id);
      });
      console.log('Response from creating people', responseForPerson.data);
    } catch (error) {
      console.log('Error in creating people', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Error data:", error.response.data);
        console.error("Error status:", error.response.status);
        console.error("Error headers:", error.response.headers);
      } else if (error.request) {
        // The request was made but no response was received
        console.error("Error request:", error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error message:", error.message);
      }
      console.error("Error config:", error.config);
    
      return { error: error.message };
    }

    manyCandidateObjects.map((candidate, index) => {
      candidate.peopleId = arrayOfPersonIds[index];
    });

    const graphqlVariablesForCandidate = {
      data: manyCandidateObjects,
    };

    const graphqlQueryObjForCandidate = JSON.stringify({
      query: CreateManyCandidates,
      variables: graphqlVariablesForCandidate,
    });

    try {
      const responseForCandidate = await axiosRequest(graphqlQueryObjForCandidate);
      console.log('Response from creating candidates', responseForCandidate.data);
      return {data: responseForCandidate.data};
    } catch (error) {
      console.log('Error in creating candidates', error);
      return { error: error.message };
    }

  }

  @Post('post-job')
  async postJob(@Body() body: any) {
    let uuid;
    try {
      const data = body;
      console.log(body);

      const graphqlVariables = { input: { name: data?.job_name, arxenaSiteId: data?.job_id, isActive: true },
      };
      const graphqlQueryObj = JSON.stringify({ query: CreateOneJob, variables: graphqlVariables, });
      const responseNew = await axiosRequest(graphqlQueryObj);
      console.log('Response from create job', responseNew.data);
      uuid = responseNew.data.data.createJob.id;
      return { status: 'success', job_uuid: uuid };
    } catch (error) {
      console.log('Error in postJob', error);
      return { error: error.message };
    }
  }


  @Post('start-chat')
  async startChat(@Body() body: any) {

    const graphqlVariables = {
      "idToUpdate": body.candidateId,
      "input": {
        "startChat": true
      }
    }
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStartChat,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj);
    console.log('Response from create startChat', response.data);
  }

  @Post('fetch-candidate-by-phone-number-start-chat')
  async fetchCandidateByPhoneNumber(@Body() body: any) {

    const personObj: allDataObjects.PersonNode = await new FetchAndUpdateCandidatesChatsWhatsapps().getPersonDetailsByPhoneNumber(body.phoneNumber);

    const candidateId = personObj.candidates?.edges[0]?.node?.id;
    const graphqlVariables = {
      "idToUpdate": candidateId,
      "input": {
        "startChat": true
      }
    }
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoStartChat,
      variables: graphqlVariables,
    });

    const response = await axiosRequest(graphqlQueryObj);
    console.log('Response from create startChat', response.data);
    return response.data;

  }
}
