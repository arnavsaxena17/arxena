import { Controller, Post, Body, UploadedFiles, Req, UseInterceptors, BadRequestException, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { GraphQLClient } from 'graphql-request';
import axios from "axios";
import * as multer from 'multer';
import { TranscriptionService } from './transcription.service';


export async function axiosRequest(data: string) {
  // console.log("Sending a post request to the graphql server:: with data", data);
  const response = await axios.request({
    method: "post",
    url: process.env.GRAPHQL_URL,
    headers: {
      authorization: "Bearer " + process.env.TWENTY_JWT_SECRET,
      "content-type": "application/json",
    },
    data: data,
  });
  return response;
}


@Controller('video-interview')
export class VideoInterviewController {
  constructor(private readonly transcriptionService: TranscriptionService) {}


  @Post('submit-response')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'video', maxCount: 1 },
        { name: 'audio', maxCount: 1 },
      ],
      {
        storage: multer.diskStorage({
          destination: './uploads',
          filename: (req, file, callback) => {
            callback(null, file.originalname);
          },
        }),
        limits: { fileSize: 100 * 1024 * 1024 },
        fileFilter: (req, file, callback) => {
          console.log(`Received file: ${file.fieldname}, mimetype: ${file.mimetype}`);
          if (file.fieldname === 'video' && file.mimetype !== 'video/webm') {
            return callback(new BadRequestException('Only webm files are allowed'), false);
          }
          if (file.fieldname === 'audio' && file.mimetype !== 'audio/wav') {
            return callback(new BadRequestException('Only WAV files are allowed'), false);
          }
          callback(null, true);
        },
      },
    ),
  )
  async submitResponse(@Req() req, @UploadedFiles() files: { video?: Express.Multer.File[]; audio?: Express.Multer.File[] }, @Body() responseData: any) {
    console.log("submitResponse method called");
    try {
      console.log("Received files:", JSON.stringify(files, null, 2));
      console.log("Received response data:", JSON.stringify(responseData, null, 2));

      if (!files.audio || !files.video) {
        throw new BadRequestException('Both video and audio files are required');
      }

      const audioFile = files.audio[0];
      const videoFile = files.video[0];

      console.log("Audio file:", JSON.stringify(audioFile, null, 2));
      console.log("Video file:", JSON.stringify(videoFile, null, 2));

      // Transcribe audio
      console.log("Starting audio transcription");
      const transcript = await this.transcriptionService.transcribeAudio(audioFile.path);
      console.log("Transcription completed");

      const token = req.user?.accessToken;
      console.log("User token:", token ? "Present" : "Missing");

      // Create response mutation
      console.log("Preparing GraphQL mutation for response creation");
      const createResponseMutation = `
        mutation CreateOneResponse($input: ResponseCreateInput!) {
          createResponse(data: $input) {
            id
            aIInterviewStatusId
            aIInterviewQuestionId
            transcript
            completedResponse
            createdAt
          }
        }
      `;

      const createResponseVariables = {
        input: {
          aIInterviewStatusId: responseData.aIInterviewStatusId,
          aIInterviewQuestionId: responseData.aIInterviewQuestionId,
          transcript: transcript,
          completedResponse: true,
          timeLimitAdherence: responseData.timeLimitAdherence,
        },
      };
      const graphqlQueryObjForCreationOfResponse = JSON.stringify({
        query: createResponseMutation,
        variables: createResponseVariables,
      });

      console.log("Sending GraphQL mutation for response creation");
      const responseResult = (await axiosRequest(graphqlQueryObjForCreationOfResponse)).data;
      console.log("Response creation result:", JSON.stringify(responseResult, null, 2));

      // Update AI Interview Status mutation
      console.log("Preparing GraphQL mutation for status update");
      const updateStatusMutation = `
        mutation UpdateOneAIInterviewStatus($idToUpdate: ID!, $input: AIInterviewStatusUpdateInput!) {
          updateAIInterviewStatus(id: $idToUpdate, data: $input) {
            id
            interviewStarted
            interviewCompleted
            updatedAt
          }
        }
      `;

      const updateStatusVariables = {
        idToUpdate: responseData.aIInterviewStatusId,
        input: {
          interviewStarted: true,
          interviewCompleted: responseData.isLastQuestion,
        },
      };
      const graphqlQueryObjForUpdationForStatus = JSON.stringify({
        query: updateStatusMutation,
        variables: updateStatusVariables,
      });

      console.log("Sending GraphQL mutation for status update");
      const statusResult = (await axiosRequest(graphqlQueryObjForUpdationForStatus)).data;
      console.log("Status update result:", JSON.stringify(statusResult, null, 2));

      console.log("Preparing response");
      const response = {
        response: responseResult.createResponse,
        status: statusResult.updateAIInterviewStatus,
        videoFile: videoFile.filename,
        audioFile: audioFile.filename,
      };
      console.log("Final response:", JSON.stringify(response, null, 2));

      return response;
    } catch (error) {
      console.error("Error in submitResponse:", error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }


  @Post('get-questions')
  async getQuestions(@Req() req, @Body() interviewData: { aIInterviewId: string }) {
    const token = req.interviewId;
    // this.graphqlClient.setHeader('Authorization', `Bearer ${token}`);

    const questionsQuery = `
      query FindManyAIInterviewQuestions($filter: AIInterviewQuestionFilterInput, $orderBy: [AIInterviewQuestionOrderByInput], $limit: Int) {
        aIInterviewQuestions(
          filter: $filter
          orderBy: $orderBy
          first: $limit
        ) {
          edges {
            node {
              id
              name
              questionValue
              timeLimit
              position
              aIInterviewId
            }
          }
        }
      }
    `;

    const questionsVariables = {
      filter: { aIInterviewId: { eq: interviewData.aIInterviewId } },
      limit: 30,
      orderBy: { position: "AscNullsFirst" },
    };

    const graphqlQueryObjForaIInterviewQuestions = JSON.stringify({
      query: questionsQuery,
      variables: questionsVariables,
    });

    const result = (await axiosRequest(graphqlQueryObjForaIInterviewQuestions)).data as { aIInterviewQuestions: { edges: { node: { id: string; name: string; questionValue: string; timeLimit: number; position: number; aIInterviewId: string } }[] } };
    return  result.aIInterviewQuestions.edges.map(edge => edge.node);
  }


  @Post('test-questions')
  async testQuestions(@Req() req, @Body() interviewData: { aIInterviewId: string }) {
    console.log("tested questions")
    return  {"tested questions":"Tested questions"};
  }

  @Post('get-interview-details')
  async getInterViewDetails(@Req() req, @Body() interviewData: { aIInterviewId: string }) {
      if (req.method === 'POST') {
        const { interviewId } = req.body;
        const InterviewStatusesQuery = `query FindManyAIInterviewStatuses($filter: AIInterviewStatusFilterInput, $orderBy: [AIInterviewStatusOrderByInput], $lastCursor: String, $limit: Int) {
            aIInterviewStatuses( filter: $filter orderBy: $orderBy first: $limit after: $lastCursor ) {
              edges {
                node {
                  id
                  createdAt
                  cameraOn
                  interviewCompleted
                  name
                  micOn
                  interviewStarted
                  position
                  candidate {
                    jobs{
                      name
                    }
                    people{
                      id
                      name{
                          firstName
                          lastName
                      }
                      email
                      phone
                    }
                  }
                  aIInterview {
                    position
                    introduction
                    id
                    createdAt
                    jobId
                    name
                    aIModelId
                    aIInterviewQuestions{
                      __typename
                      edges{
                          node{
                              name
                              id
                              timeLimit
                              questionType
                              questionValue
                          }
                      }
                    }
                    instructions
                    updatedAt
                  }
                  interviewLink {
                    label
                    url
                  }
                }
              }
              pageInfo {
                hasNextPage
                startCursor
                endCursor
              }
              totalCount
            }
          } `;
        const InterviewStatusesVariables = {
          filter: {
            interviewLink: {
              url: {
                ilike: `%${interviewId}%`
              }
            }
          }
        };
        const graphqlQueryObjForaIInterviewQuestions = JSON.stringify({
          query: InterviewStatusesQuery,
          variables: InterviewStatusesVariables,
        });
        try {
          const response = await axiosRequest(graphqlQueryObjForaIInterviewQuestions);
          // console.log("REhis response:", response.data.data)
          return response.data;
        } catch (error) {
          console.error('Error fetching interview data:', error);
        }
      } else {
        console.log("Invalid request method");
        return null 
      }
    }
  
}

