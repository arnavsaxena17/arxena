import { Controller, Post, Body, UploadedFiles, Req, UseInterceptors, BadRequestException, UseGuards, InternalServerErrorException, HttpException } from '@nestjs/common';


import { AuthGuard } from '@nestjs/passport';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { GraphQLClient } from 'graphql-request';
import axios from 'axios';
import * as multer from 'multer';
import { TranscriptionService } from './transcription.service';
import { AttachmentProcessingService } from '../arx-chat/services/candidate-engagement/attachment-processing';
import * as path from 'path';
import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

interface GetInterviewDetailsResponse {
  responseFromInterviewRequests: any;
  videoInterviewAttachmentResponse: any;
  questionsAttachments: { id: string; fullPath: string; name: string }[];
}

export async function axiosRequest(data: string) {
  // console.log("Sending a post request to the graphql server:: with data", data);
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL,
    headers: {
      authorization: 'Bearer ' + process.env.TWENTY_JWT_SECRET,
      'content-type': 'application/json',
    },
    data: data,
  });
  return response;
}

@Controller('video-interview')
export class VideoInterviewController {
  constructor(private readonly transcriptionService: TranscriptionService) {
    console.log('GraphQL URL configured as:', process.env.GRAPHQL_URL);
    console.log('JWT Secret present:', !!process.env.TWENTY_JWT_SECRET);
  }
  
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
            try {
              console.log(`Received file in the uploads multer disk storage: ${file.originalname}`);
              // Ensure uploads directory exists
              if (!fs.existsSync('./uploads')) {
                fs.mkdirSync('./uploads', { recursive: true });
              }
              callback(null, file.originalname);
            } catch (error) {
              console.error('Error in multer filename callback:', error);
              callback(error, "");
            }
          },
        }),
        limits: { fileSize: 100 * 1024 * 1024 },
        fileFilter: (req, file, callback) => {
          try {
            console.log(`Received file: ${file.fieldname}, mimetype: ${file.mimetype}`);
            
            if (!file.mimetype) {
              return callback(new BadRequestException('Missing mimetype'), false);
            }

            if (file.fieldname === 'video' && !['video/webm', 'video/mp4'].includes(file.mimetype)) {
              return callback(new BadRequestException(`Invalid video format: ${file.mimetype}. Only webm or mp4 files are allowed.`), false);
            }
            
            if (file.fieldname === 'audio' && file.mimetype !== 'audio/wav') {
              return callback(new BadRequestException(`Invalid audio format: ${file.mimetype}. Only WAV files are allowed.`), false);
            }
            
            callback(null, true);
          } catch (error) {
            console.error('Error in multer fileFilter:', error);
            callback(error, false);
          }
        },
      },
    ),
  )

  async submitResponse(@Req() req, @UploadedFiles() files: { video?: Express.Multer.File[]; audio?: Express.Multer.File[] }, @Body() responseData: any) {
    console.log("Received request data:: will start download")
    try {
      console.log("Step 1: Starting submission process");
      console.log("Response data:", responseData);
  
      console.log("REceived response data::", responseData)
      // console.log('Received files:', JSON.stringify(files, null, 2));
      // console.log('Received response data:', JSON.stringify(responseData, null, 2));
      const interviewData = JSON.parse(req?.body?.interviewData);
      const currentQuestionIndex = JSON.parse(req?.body?.currentQuestionIndex);
      console.log("REceived interviewData:", interviewData)
      console.log("REceived currentQuestionIndex:", currentQuestionIndex)
      const questionId = interviewData.aIInterview.aIInterviewQuestions.edges[currentQuestionIndex].node.id;
      if (!files.audio || !files.video) {
        throw new BadRequestException('Both video and audio files are required');

      }
      else{
        console.log("Both files received")
      }

      const audioFile = files.audio[0];
      const videoFile = files.video[0];

      console.log("audio file received:", audioFile)
      console.log("video file received:", videoFile)
      // Upload video file to Twenty
      let videoFilePath = `uploads/${videoFile.originalname}`;

      if (videoFile.mimetype !== 'video/webm') {
        videoFilePath = await this.convertToWebM(videoFilePath);
      }

      const videoAttachmentObj = await new AttachmentProcessingService().uploadAttachmentToTwenty(videoFilePath);
      // Upload audio file to Twenty
      const audioFilePath = `uploads/${audioFile.originalname}`;

      const audioAttachmentObj = await new AttachmentProcessingService().uploadAttachmentToTwenty(audioFilePath);
      console.log('Audio attachment upload response:', audioAttachmentObj);
      console.log('interviewData::', interviewData);
      // Prepare data for attachment table
      const videoDataToUploadInAttachmentTable = {
        input: {
          authorId: interviewData.candidate.jobs.recruiterId,
          name: videoFilePath.replace(`${process.cwd()}/`, ''),
          fullPath: videoAttachmentObj?.data?.uploadFile,
          type: 'Video',
          candidateId: interviewData.candidate.id,
        },
      };
      console.log('This is the video. Data to Uplaod in Attachment Table::', videoDataToUploadInAttachmentTable);
      const videoAttachment = await new AttachmentProcessingService().createOneAttachmentFromFilePath(videoDataToUploadInAttachmentTable);
      console.log("videoAttachment:"  , videoAttachment)

      const audioDataToUploadInAttachmentTable = {
        input: {
          authorId: interviewData.candidate.jobs.recruiterId,
          name: audioFilePath.replace(`${process.cwd()}/`, ''),
          fullPath: audioAttachmentObj?.data?.uploadFile,
          type: 'Audio',
          candidateId: interviewData.candidate.id,
        },
      };
      console.log('This is the audio. Data to Uplaod in Attachment Table::', audioDataToUploadInAttachmentTable);
      const audioAttachment = await new AttachmentProcessingService().createOneAttachmentFromFilePath(audioDataToUploadInAttachmentTable);
      console.log("audioAttachment:"  , audioAttachment)
      // console.log('Audio file:', JSON.stringify(audioFile, null, 2));
      // console.log('Video file:', JSON.stringify(videoFile, null, 2));

      console.log('Starting audio transcription');
      const transcript = await this.transcriptionService.transcribeAudio(audioFile.path);
      console.log('Transcription completed::', transcript);

      const token = req.user?.accessToken;
      console.log('User token:', token ? 'Present' : 'Missing');

      // Create response mutation
      console.log('Preparing GraphQL mutation for response creation');
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

      console.log("This is the responseData:", responseData.aIInterviewStatusId)
      console.log("This is the responseData:", responseData.aIInterviewQuestionId)
      console.log("This is the timeLimitAdherence:", responseData.timeLimitAdherence)

      const createResponseVariables = {
        input: {
          name: `Response for ${responseData.aIInterviewQuestionId}`,
          aIInterviewStatusId: interviewData.id.replace("/video-interview/", ""),
          aIInterviewQuestionId: questionId,
          transcript: transcript,
          completedResponse: true,
          timeLimitAdherence: responseData?.timeLimitAdherence,
        },
      };
      const graphqlQueryObjForCreationOfResponse = JSON.stringify({
        query: createResponseMutation,
        variables: createResponseVariables,
      });

      console.log('Sending GraphQL mutation for response creation::', graphqlQueryObjForCreationOfResponse);
      const responseResult = (await axiosRequest(graphqlQueryObjForCreationOfResponse)).data;
      console.log('Response creation result:', JSON.stringify(responseResult, null, 2));
      console.log("ResponseResult data:", responseResult.data)
      console.log("ResponseResult ID:", responseResult.data.createResponse.id)

      const responseId = responseResult.data.createResponse.id;


      const videoDataToUploadInAttachmentResponseTable = {
        input: {
          authorId: interviewData.candidate.jobs.recruiterId,
          name: videoFilePath.replace(`${process.cwd()}/`, ''),
          fullPath: videoAttachmentObj?.data?.uploadFile,
          type: 'Video',
          responseId: responseId,
        },
      };
      console.log('This is the video. Data to Uplaod in Attachment Table::', videoDataToUploadInAttachmentResponseTable);
      const videoAttachmentResponseUpload = await new AttachmentProcessingService().createOneAttachmentFromFilePath(videoDataToUploadInAttachmentResponseTable);
      console.log("videoAttachmentResponseUpload:"  , videoAttachmentResponseUpload)

      const audioDataToUploadInAttachmentResponseTable = {
        input: {
          authorId: interviewData.candidate.jobs.recruiterId,
          name: audioFilePath.replace(`${process.cwd()}/`, ''),
          fullPath: audioAttachmentObj?.data?.uploadFile,
          type: 'Audio',
          responseId: responseId,
        },
      };
      console.log('This is the audio. Data to Uplaod in Attachment Table::', audioDataToUploadInAttachmentTable);
      const audioAttachmentResponseUpload = await new AttachmentProcessingService().createOneAttachmentFromFilePath(audioDataToUploadInAttachmentResponseTable);
      console.log("audioAttachmentResponseUpload:"  , audioAttachmentResponseUpload)




      // Update AI Interview Status mutation
      console.log('Preparing GraphQL mutation for status update');
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
        idToUpdate: interviewData.id.replace("/video-interview/", ""),
        input: {
          interviewStarted: true,
          interviewCompleted: responseData.isLastQuestion,
        },
      };
      const graphqlQueryObjForUpdationForStatus = JSON.stringify({
        query: updateStatusMutation,
        variables: updateStatusVariables,
      });
      console.log('graphqlQueryObjForUpdationForStatus::', graphqlQueryObjForUpdationForStatus);

      // console.log('Sending GraphQL mutation for status update');
      const statusResult = (await axiosRequest(graphqlQueryObjForUpdationForStatus)).data;
      // console.log('Status update result:', JSON.stringify(statusResult, null, 2));

      console.log('Preparing response');
      const response = {
        response: responseResult.createResponse,
        status: statusResult.updateAIInterviewStatus,
        videoFile: videoFile.filename,
        audioFile: audioFile.filename,
      };
      console.log('Final response:', JSON.stringify(response, null, 2));

      return response;
    } catch (error) {
      console.error('Error in submitResponse:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }


  private async convertToWebM(inputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputPath = inputPath.replace(path.extname(inputPath), '.webm');
      ffmpeg(inputPath)
        .outputOptions('-c:v libvpx-vp9')
        .outputOptions('-crf 30')
        .outputOptions('-b:v 0')
        .outputOptions('-b:a 128k')
        .outputOptions('-c:a libopus')
        .save(outputPath)
        .on('end', () => {
          fs.unlinkSync(inputPath);  // Remove the original file
          resolve(outputPath);
        })
        .on('error', (err) => {
          reject(new Error(`Error converting video: ${err.message}`));
        });
    });
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
      orderBy: { position: 'AscNullsFirst' },
    };

    const graphqlQueryObjForaIInterviewQuestions = JSON.stringify({
      query: questionsQuery,
      variables: questionsVariables,
    });

    const result = (await axiosRequest(graphqlQueryObjForaIInterviewQuestions)).data as { aIInterviewQuestions: { edges: { node: { id: string; name: string; questionValue: string; timeLimit: number; position: number; aIInterviewId: string } }[] } };
    return result.aIInterviewQuestions.edges.map(edge => edge.node);
  }

  @Post('update-feedback')
  async updateFeedback(@Req() req, @Body() feedbackData) {
    const updateStatusMutation = `mutation UpdateOneAIInterviewStatus($idToUpdate: ID!, $input: AIInterviewStatusUpdateInput!) {
      updateAIInterviewStatus(id: $idToUpdate, data: $input) {
        id
        interviewStarted
        interviewCompleted
        updatedAt
        createdAt
      }
    }`;
  
    console.log('This is the feedback obj', feedbackData);
    const updateStatusVariables = {
      idToUpdate: feedbackData.interviewId.replace("/video-interview/", ""),
      input: {
        feedback: feedbackData.feedback,
      },
    };
    
    const graphqlQueryObjForUpdationForStatus = JSON.stringify({
      query: updateStatusMutation,
      variables: updateStatusVariables,
    });
    console.log("This is the graphqlQueryObjForUpdationForStatus::", graphqlQueryObjForUpdationForStatus);
  
    try {
      const response = await axiosRequest(graphqlQueryObjForUpdationForStatus);
      console.log('Feedback updated successfully:', response.data);
      // Just send a simple response object instead of the full response
      return {
        statusCode: 200,
        message: 'Feedback updated successfully'
      };
      
    } catch (error) {
      // Handle the error without trying to serialize the full error object
      throw new HttpException({
        statusCode: 500,
        message: 'Failed to update feedback'
      }, 500);
    }
  }
  
  @Post('get-interview-details')
  async getInterViewDetails(@Req() req: any): Promise<GetInterviewDetailsResponse> {
    console.log("Got video interview hit")
    if (req.method === 'POST') {
      const { interviewId } = req.body;
      console.log("Received interviewId:", interviewId);
      let responseFromInterviewRequests
      const InterviewStatusesQuery = `
        query FindManyAIInterviewStatuses($filter: AIInterviewStatusFilterInput, $orderBy: [AIInterviewStatusOrderByInput], $lastCursor: String, $limit: Int) {
          aIInterviewStatuses(
            filter: $filter
            orderBy: $orderBy
            first: $limit
            after: $lastCursor
          ) {
            edges {
              node {
                id
                createdAt
                cameraOn
                interviewCompleted
                name
                micOn
                attachments{
                    edges{
                        node{
                            id
                            fullPath
                            name
                        }
                    }
                }
                interviewStarted
                position
                candidate {
                  jobs{
                    name
                    id
                    recruiterId
                    companies{
                        name
                    }
                  }
                  id
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
                  aIInterviewQuestions {
                    edges{
                        node{
                            name
                            id
                            createdAt
                            timeLimit
                            questionType
                            questionValue
                            attachments{
                            edges{
                                node{
                                    id
                                    fullPath
                                    name
                                }
                            }
                        }
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
              ilike: `%${interviewId}%`,
            },
          },
        },
      };
      const graphqlQueryObjForaIInterviewQuestions = JSON.stringify({
        query: InterviewStatusesQuery,
        variables: InterviewStatusesVariables,
      });
      try {
        const response = await axiosRequest(graphqlQueryObjForaIInterviewQuestions);
        console.log("REhis response:", response.data.data)
        responseFromInterviewRequests =  response.data;
      } catch (error) {
        console.log("There an error:", error)
        console.error('Error fetching interview data:', error);
        responseFromInterviewRequests = null
      }

      const videoInterviewId = responseFromInterviewRequests?.data?.aIInterviewStatuses?.edges[0]?.node?.aIInterview?.id;
      console.log("Received videoInterviewId:", videoInterviewId);
      const videoInterviewIntroductionAttachmentDataQuery = JSON.stringify({
        query: `query FindManyAttachments($filter: AttachmentFilterInput, $orderBy: [AttachmentOrderByInput], $lastCursor: String, $limit: Int) {
          attachments(
        filter: $filter
        orderBy: $orderBy
        first: $limit
        after: $lastCursor
          ) {
        edges {
          node {
            fullPath
            id
            name
          }
          cursor
        }
        pageInfo {
          hasNextPage
          startCursor
          endCursor
        }
        totalCount
          }
        }`,
        variables: { filter: { aIInterviewId: { eq: videoInterviewId } }, orderBy: { createdAt: 'DescNullsFirst' } }
      });


      const allQuestionIds = responseFromInterviewRequests?.data?.aIInterviewStatuses?.edges[0]?.node?.aIInterview?.aIInterviewQuestions?.edges
        .map((edge: { node: { id: string; createdAt: string } }) => edge.node)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(node => node.id);
      console.log("Received allQuestionIds:", allQuestionIds);
  
      if (!allQuestionIds || allQuestionIds.length === 0) {
        console.log("No question IDs found, cannot proceed");
        throw new Error("No question IDs found");
      }
  
      const questionsAttachmentDataQueries = allQuestionIds.map(id => JSON.stringify({
        query: `query FindManyAttachments($filter: AttachmentFilterInput, $orderBy: [AttachmentOrderByInput], $lastCursor: String, $limit: Int) {
          attachments(
            filter: $filter
            orderBy: $orderBy
            first: $limit
            after: $lastCursor
          ) {
            edges {
              node {
                fullPath
                id
                name
              }
              cursor
            }
            pageInfo {
              hasNextPage
              startCursor
              endCursor
            }
            totalCount
          }
        }`,
        variables: { filter: { aIInterviewQuestionId: { eq: id } }, orderBy: { createdAt: 'DescNullsFirst' } }
      }));
  
      console.log("Going to get video interview introduction attachment data");
      const [responseForVideoInterviewIntroductionAttachment, ...responseForVideoInterviewQuestionAttachments] = await Promise.all([
        axiosRequest(videoInterviewIntroductionAttachmentDataQuery),
        ...questionsAttachmentDataQueries.map(query => axiosRequest(query))
      ]);

      // console.log("This i shte responseForVideoInterviewQuestionAttachments ", responseForVideoInterviewQuestionAttachments[0].data.data.attachments.edges);
  
      const questionsAttachmentsResponse = responseForVideoInterviewQuestionAttachments.flatMap(response => 
        response.data?.data?.attachments?.edges?.map((edge: { node: { id: string; fullPath: string; name: string } }) => edge.node) || []
      );
  
      // console.log("Received responseForVideoInterviewIntroductionAttachment:", responseForVideoInterviewIntroductionAttachment.data);
      // console.log("This is the result for questionsAttachments:", questionsAttachmentsResponse);
  
      const result: GetInterviewDetailsResponse = {
        responseFromInterviewRequests,
        videoInterviewAttachmentResponse: responseForVideoInterviewIntroductionAttachment.data,
        questionsAttachments: questionsAttachmentsResponse
      };
  
      // console.log("This is the result:", result);
      return result;
    } else {
      console.log('Invalid request method');
      return {
        responseFromInterviewRequests: null,
        videoInterviewAttachmentResponse: null,
        questionsAttachments: []
      };    
    }
  }
}
