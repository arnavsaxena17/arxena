import { Body, Controller, Post } from '@nestjs/common';
import { job, panda, arxenaColumns, arxenaColumnsV2 } from './constant';
import axios from 'axios';
import { CreateManyCandidates, CreateManyPeople, CreateOneFieldMetadataItem, CreateOneJob, CreateOneObjectMetadataItem, CreateOneRelationMetadata, ObjectMetadataItems, graphqlToFindManyJobByArxenaSiteId } from './graphql-queries';
import { v4 as uuidv4 } from 'uuid';
import camelCase from 'camelcase';
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
    console.log('Sourcing candidates', body);
    // // const responseBody = JSON.parse(body);
    const arxenaJobId = body?.job_id;
    const data: UserProfile[] = body?.data;
    const responseFromGetJob = await axiosRequest(
      JSON.stringify({
        query: graphqlToFindManyJobByArxenaSiteId,
        variables: {
          filter: {
            arxenaSiteId: {
              in: [arxenaJobId],
            },
          },
          limit: 30,
          orderBy: [
            {
              position: 'AscNullsFirst',
            },
          ],
        },
      }),
    );
    console.log('Response from get job', responseFromGetJob);
    const jobObject: Jobs = responseFromGetJob.data?.data?.jobs?.edges[0]?.node;
    const jobIdMetadata = responseFromGetJob.data?.data?.jobs?.edges[0]?.node?.id;
    // const jobIdMetadataInCamelCaseFormat: string = camelCase(jobIdMetadata).charAt(0).toUpperCase() + camelCase(jobIdMetadata).slice(1);
    // const dynamicQueryName = (jobName + jobIdMetadataInCamelCaseFormat).charAt(0).toUpperCase() + camelCase(jobName + jobIdMetadataInCamelCaseFormat).slice(1);
    let manyPersonObjects: ArxenaPersonNode[] = [];
    let manyCandidateObjects: ArxenaCandidateNode[] = [];
    let manyCandidateJobEnrichData: any[] = [];
    for (let profile of data) {
      //   // const graphqlVariablesForCompany = {
      //   //     input: {
      //   //         name:
      //   //     }
      //   // }
      let uuid = uuidv4();
      const { personNode, candidateNode } = processArxCandidate(profile, jobObject);
      // const onePersonObject = {
      //   id: uuid,
      //   name: {
      //     firstName: profile?.names?.first_name || '',
      //     lastName: profile?.names?.last_name || '',
      //   },
      //   linkedinLink: {
      //     url: profile?.linkedin_url,
      //   },
      //   jobTitle: profile?.profile_title,
      // };
      // const oneCandidateObject = {
      //   name: profile?.names?.first_name + ' ' + profile?.names?.last_name,
      //   // companiesId: ""
      //   peopleId: uuid,
      //   status: 'SCREENING',
      //   engagementStatus: false,
      //   startChat: false,
      //   whatsappProvider: 'baileys',
      // };
      //   // const graphqlQueryObj = JSON.stringify({
      //   //     query: CreateOneJob,
      //   //     variables: graphqlVariables,
      //   // });
      //   // const responseNew = await axiosRequest(graphqlQueryObj);
      //   // return { data: responseNew.data };
      //   const result = Object.entries(profile)
      //     .filter(([key1, value]) => typeof value !== 'object' || value === null)
      //     .map(([key1, value]) => {
      //       // Your mapping logic here, for example, return the key-value pair
      //       return { key1: value };
      //     });
      //   const oneCandidateJobEnrichData = {
      //     input: result,
      //   };
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
      const responseForPerson = await axiosRequest(graphqlQueryObjForPerson);
      responseForPerson.data.data.createPeople.forEach((person: any) => {
        console.log('Person ID', person?.id);
        arrayOfPersonIds.push(person?.id);
      });
      console.log('Response from creating people', responseForPerson.data);
    } catch (error) {
      console.log('Error in creating people', error);
      return { error: error.message };
    }

    manyCandidateObjects.map((candidate, index) => {
      manyCandidateObjects[index].peopleId = arrayOfPersonIds[index];
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
    } catch (error) {
      console.log('Error in creating candidates', error);
      return { error: error.message };
    }
    // try {
    //   const responseForCandidateJob = await axiosRequest(graphqlQueryObjForCandidate);
    // } catch (error) {
    //   console.log('Error in creating candidates', error);
    //   return { error: error.message };
    // }
    // // upload to new candidateJobTable as well
    // try {
    //   const response = await axiosRequest(
    //     JSON.stringify({
    //       query: CreateManyCustomMetadataObject(dynamicQueryName),
    //       variables: {
    //         data: manyCandidateJobEnrichData,
    //       },
    //     }),
    //   );
    // } catch (error) {
    //   console.log('Error in uploading to candidate job table', error);
    //   return { error: error.message };
    // }
    // const candidatesArray:
  }

  @Post('post-job')
  async postJob(@Body() body: any) {
    // console.log(panda);
    // console.log(body);
    // return
    let uuid;
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
          arxenaSiteId: data?.job_id,
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
      console.log('Response from create job', responseNew.data);
      uuid = responseNew.data.data.createJob.id;
      return { status: 'success' };
    } catch (error) {
      console.log('Error in postJob', error);
      return { error: error.message };
    }

    // let responseForField;

    // try {
    //   // CreateOneObjectMetadataItem

    //   const data = body;
    //   console.log(body);

    //   const graphqlVariablesToGetMetadata = {
    //     objectFilter: {
    //       isActive: {
    //         is: true,
    //       },
    //     },
    //   };

    //   const graphqlQueryObjToGetMetadataItems = JSON.stringify({
    //     query: ObjectMetadataItems,
    //     variables: {},
    //   });

    //   const responseForMetadata = await axiosRequestForMetadata(graphqlQueryObjToGetMetadataItems);

    //   const objects = responseForMetadata.data?.data?.objects?.edges;
    //   console.log('349844:: Objects', objects);

    //   const graphqlVariablesForCreate = {
    //     input: {
    //       object: {
    //         description: '',
    //         icon: 'IconBriefcase2',
    //         labelPlural: data.job_name + 's',
    //         labelSingular: data.job_name,
    //         nameSingular: camelCase(data.job_name + '_' + uuid),
    //         namePlural: camelCase(data.job_name + 's' + '_' + uuid),
    //       },
    //     },
    //   };
    //   const graphqlQueryObj = JSON.stringify({
    //     query: CreateOneObjectMetadataItem,
    //     variables: graphqlVariablesForCreate,
    //   });
    //   const responseNew = await axiosRequestForMetadata(graphqlQueryObj);

    //   const newObjectMetadataId = responseNew.data?.data?.createOneObject?.id; // !
    //   console.log('Response from creating object', responseNew.data);
    //   console.log('New Object Metadata ID', newObjectMetadataId);
    //   const graphqlVariablesForRelation = {
    //     input: {
    //       relation: {
    //         fromDescription: null,
    //         // "fromIcon": "IconBuilding",
    //         fromLabel: data.job_name,
    //         fromName: camelCase(data.job_name + '_' + uuid),
    //         fromObjectMetadataId: objects.find(obj => obj?.node?.nameSingular === 'job')?.node?.id,
    //         relationType: 'ONE_TO_MANY',
    //         toObjectMetadataId: newObjectMetadataId,
    //         toDescription: '',
    //         toLabel: 'Job',
    //         toName: 'job',
    //       },
    //     },
    //   };
    //   const graphqlQueryObjForRelation = JSON.stringify({
    //     query: CreateOneRelationMetadata,
    //     variables: graphqlVariablesForRelation,
    //   });

    //   const responseForRelation = await axiosRequestForMetadata(graphqlQueryObjForRelation); //! Error here

    //   console.log('Response from creating relation', responseForRelation.data);

    //   let graphqlVariablesForMetadataFields: any[] = [];

    //   arxenaColumnsV2.map((column: string) => {
    //     const graphqlVariablesForMetadataField = {
    //       input: {
    //         field: {
    //           description: '',
    //           label: camelCase(column),
    //           name: camelCase(column),
    //           objectMetadataId: newObjectMetadataId,
    //           type: 'TEXT',
    //         },
    //       },
    //     };

    //     graphqlVariablesForMetadataFields.push(graphqlVariablesForMetadataField);
    //   });

    //   for (let field of graphqlVariablesForMetadataFields) {
    //     const graphqlQueryObjForField = JSON.stringify({
    //       query: CreateOneFieldMetadataItem,
    //       variables: field,
    //     });
    //     responseForField = await axiosRequestForMetadata(graphqlQueryObjForField);
    //     console.log('Response from creating field', responseForField.data);
    //   }

    // const responseAfterUpdatingJobMetadataId = await axiosRequestForMetadata({
    //   query: j,

    // });

    //   return { status: 'success' };
    // } catch (error) {
    //   console.log('Error in postJob', error);
    //   return { error: error.message };
    // }
  }
}
