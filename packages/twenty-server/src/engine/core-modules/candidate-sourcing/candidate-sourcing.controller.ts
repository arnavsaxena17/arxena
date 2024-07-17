import { Body, Controller, Post } from '@nestjs/common';
import { job, panda } from './constant';
import axios from 'axios';
import { CreateManyCandidates, CreateManyPeople, CreateOneJob } from './graphql-queries';
import { v4 as uuidv4 } from 'uuid';

import { axiosRequest } from '../arx-chat/utils/arx-chat-agent-utils';
import { url } from 'inspector';
@Controller('candidate-sourcing')
export class CandidateSourcingController {
  @Post('post-candidates')
  async sourceCandidates(@Body() body: any) {
    // first create companies
    // then create people
    // console.log(panda);
    // console.log(body);
    // return panda;

    console.log('Sourcing candidates', body);

    const data: UserProfile[] = body;

    const manyPersonObjects: Person[] = [];
    const manyCandidateObjects: Candidate[] = [];

    for (let profile of data) {
      // const graphqlVariablesForCompany = {
      //     input: {
      //         name:
      //     }
      // }

      let uuid = uuidv4();

      const onePersonObject = {
        id: uuid,
        name: {
          firstName: profile?.names?.first_name || '',
          lastName: profile?.names?.last_name || '',
        },
        linkedinLink: {
          url: profile?.linkedin_url,
        },
        jobTitle: profile?.profile_title,
      };

      const oneCandidateObject = {
        name: profile?.names?.first_name + ' ' + profile?.names?.last_name,
        // companiesId: ""
        peopleId: uuid,
        status: 'SCREENING',
        engagementStatus: false,
        startChat: false,
        whatsappProvider: 'baileys',
      };
      // const graphqlQueryObj = JSON.stringify({
      //     query: CreateOneJob,
      //     variables: graphqlVariables,
      // });
      // const responseNew = await axiosRequest(graphqlQueryObj);
      // return { data: responseNew.data };
      manyPersonObjects.push(onePersonObject);
      manyCandidateObjects.push(oneCandidateObject);
    }

    const graphqlVariablesForPerson = {
      data: manyPersonObjects,
    };

    const graphqlVariablesForCandidate = {
      data: manyCandidateObjects,
    };

    const graphqlQueryObjForPerson = JSON.stringify({
      query: CreateManyPeople,
      variables: graphqlVariablesForPerson,
    });

    const graphqlQueryObjForCandidate = JSON.stringify({
      query: CreateManyCandidates,
      variables: graphqlVariablesForCandidate,
    });

    try {
      const responseForPerson = await axiosRequest(graphqlQueryObjForPerson);
    } catch (error) {
      console.log('Error in creating people', error);
      return { error: error.message };
    }

    try {
      const responseForCandidate = await axiosRequest(graphqlQueryObjForCandidate);
    } catch (error) {
      console.log('Error in creating candidates', error);
      return { error: error.message };
    }
    // const candidatesArray:
  }

  @Post('post-job')
  async postJob(@Body() body: any) {
    // console.log(panda);
    // console.log(body);
    // return
    try {
      const data = body;
      console.log(body);

      //   const headers = {
      //     Authorization: body?.headers?.authorization,
      //   };
      //   const response = await axios.get('http://localhost:3000/socket-auth/verify', { headers });

      //   console.log('UserId connected:', response?.data);
      //   const workspaceMemberId = response?.data;

      const graphqlVariables = {
        input: {
          name: data?.job_name,
          isActive: true,
          // jobLocation: "",
          //   recruiterId: workspaceMemberId,
          // companiesId: ""
        },
      };
      const graphqlQueryObj = JSON.stringify({
        query: CreateOneJob,
        variables: graphqlVariables,
      });
      const responseNew = await axiosRequest(graphqlQueryObj);
      return { data: responseNew.data };
    } catch (error) {
      console.log('Error in postJob', error);
      return { error: error.message };
    }
  }
}
