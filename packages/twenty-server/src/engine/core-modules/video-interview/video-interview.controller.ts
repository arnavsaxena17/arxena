import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Post,
  Req,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import multer from 'multer';
import * as path from 'path';
import {
  createResponseMutation,
  findManyAttachmentsQuery,
  findWorkspaceMemberProfiles,
  graphQueryToFindManyvideoInterviews,
  questionsQuery,
  updateOneVideoInterviewMutation,
} from 'twenty-shared';
import { AttachmentProcessingService } from '../arx-chat/utils/attachment-processes';
import { TranscriptionService } from './transcription.service';

import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { graphQltoUpdateOneCandidate } from 'twenty-shared';
import { WorkspaceQueryService } from '../workspace-modifications/workspace-modifications.service';

interface GetInterviewDetailsResponse {
  recruiterProfile: any;
  responseFromInterviewRequests: any;
  videoInterviewAttachmentResponse: any;
  questionsAttachments: { id: string; fullPath: string; name: string }[];
}


// curl -X POST http://ec2-23-20-11-116.compute-1.amazonaws.com/video-interview-controller/upload-chunk \
//   -F "chunk=@test.bin" \
//   -F "uploadId=test123" \
//   -F "chunkIndex=0"


export async function axiosRequest(data: string, apiToken: string) {
  const response = await axios.request({
    method: 'post',
    url: process.env.GRAPHQL_URL,
    headers: {
      Origin: process.env.APPLE_ORIGIN_URL,
      authorization: 'Bearer ' + apiToken,
      'content-type': 'application/json',
    },
    data: data,
  });
  if (response.data.errors) {
    console.log(
      'Error axiosRequest',
      response.data,
      'for grapqhl request of ::',
      data,
    );
  }
  return response;
}

@Controller('video-interview-controller')
export class VideoInterviewController {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly transcriptionService: TranscriptionService,
  ) {
    console.log('GraphQL URL configured as:', process.env.GRAPHQL_URL);
    console.log('JWT Secret present:', !!process.env.TWENTY_JWT_SECRET);
  }

  private chunkUploads = new Map<
    string,
    {
      filename: string;
      totalChunks: number;
      receivedChunks: number[];
      chunkFiles: string[];
      fileType: string;
    }
  >();

  @Post('raw-upload-test')
  async rawUploadTest(@Req() req) {
    try {
      const uploadId = 'test-' + Date.now();
      const dir = path.join('./uploads', 'chunks', uploadId);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const filePath = path.join(dir, 'raw-test.bin');
      const writeStream = fs.createWriteStream(filePath);

      return new Promise((resolve, reject) => {
        req.pipe(writeStream);

        writeStream.on('finish', () => {
          resolve({
            success: true,
            size: fs.statSync(filePath).size,
            path: filePath,
          });
        });

        writeStream.on('error', (err) => {
          reject(new Error(`Failed to write file: ${err.message}`));
        });
      });
    } catch (error) {
      console.error('Error in raw upload test:', error);
      throw new InternalServerErrorException(`Test failed: ${error.message}`);
    }
  }

  @Post('init-chunked-upload')
  async initChunkedUpload(
    @Body()
    data: {
      uploadId: string;
      filename: string;
      totalChunks: number;
      fileType: string;
    },
  ) {
    console.log(
      `Initializing chunked upload: ${data.uploadId}, ${data.totalChunks} chunks`,
    );

    const uploadDir = path.join('./uploads', 'chunks', data.uploadId);

    // Create directories if they don't exist
    if (!fs.existsSync('./uploads')) {
      fs.mkdirSync('./uploads', { recursive: true });
    }
    if (!fs.existsSync(path.join('./uploads', 'chunks'))) {
      fs.mkdirSync(path.join('./uploads', 'chunks'), { recursive: true });
    }
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    this.chunkUploads.set(data.uploadId, {
      filename: data.filename,
      totalChunks: data.totalChunks,
      receivedChunks: [],
      chunkFiles: [],
      fileType: data.fileType,
    });

    return { status: 'initialized' };
  }

  // Handle each chunk upload but not working
  // @Post('upload-chunk')
  // @UseInterceptors(
  //   FileFieldsInterceptor([{ name: 'chunk', maxCount: 1 }], {
  //     storage: multer.diskStorage({
  //       destination: (req, file, callback) => {
  //         try {
  //           console.log('Received chunk upload request');
  //           const uploadId = req.body.uploadId;
  //           const dir = path.join('./uploads', 'chunks', uploadId);

  //           // Ensure directories exist
  //           if (!fs.existsSync('./uploads')) {
  //             fs.mkdirSync('./uploads', { recursive: true });
  //           }
  //           if (!fs.existsSync(path.join('./uploads', 'chunks'))) {
  //             fs.mkdirSync(path.join('./uploads', 'chunks'), {
  //               recursive: true,
  //             });
  //           }
  //           if (!fs.existsSync(dir)) {
  //             fs.mkdirSync(dir, { recursive: true });
  //           }

  //           callback(null, dir);
  //         } catch (error) {
  //           console.error('Error in chunk destination callback:', error);
  //           callback(error, '');
  //         }
  //       },
  //       filename: (req, file, callback) => {
  //         console.log('Received chunk filename callback');
  //         try {
  //           const chunkIndex = req.body.chunkIndex;
  //           callback(null, `chunk-${chunkIndex}`);
  //         } catch (error) {
  //           console.error('Error in chunk filename callback:', error);
  //           callback(error, '');
  //         }
  //       },
  //     }),
  //     limits: { fileSize: 100 * 1024 * 1024 },
  //     fileFilter: (req, file, callback) => {
  //       console.log('Received chunk fileFilter callback');
  //       try {
  //         console.log(
  //           `Received chunk file: ${file.fieldname}, mimetype: ${file.mimetype}`,
  //         );

  //         if (!file.mimetype) {
  //           return callback(new BadRequestException('Missing mimetype'), false);
  //         }

  //         // For chunks, accept any binary data
  //         callback(null, true);
  //       } catch (error) {
  //         console.error('Error in chunk fileFilter:', error);
  //         callback(error, false);
  //       }
  //     },
  //   }),
  // )
  // async uploadChunk(
  //   @Req() req,
  //   @UploadedFiles() files: { chunk?: Express.Multer.File[] },
  // ) {
  //   try {
  //     console.log('Upload chunk endpoint reached');

  //     if (!files.chunk || !files.chunk[0]) {
  //       throw new BadRequestException('No chunk file received');
  //     }

  //     const chunkFile = files.chunk[0];
  //     const uploadId = req.body.uploadId;
  //     const chunkIndex = parseInt(req.body.chunkIndex);

  //     console.log(`Processing chunk ${chunkIndex} for upload ${uploadId}`);

  //     const uploadData = this.chunkUploads.get(uploadId);
  //     if (!uploadData) {
  //       throw new BadRequestException('Upload not initialized');
  //     }

  //     // Update received chunks
  //     uploadData.receivedChunks.push(chunkIndex);
  //     uploadData.chunkFiles.push(chunkFile.path);

  //     console.log(
  //       `Updated upload data: ${uploadData.receivedChunks.length}/${uploadData.totalChunks} chunks received`,
  //     );

  //     return {
  //       status: 'chunk-received',
  //       progress: uploadData.receivedChunks.length / uploadData.totalChunks,
  //     };
  //   } catch (error) {
  //     console.error('Error in uploadChunk:', error);
  //     if (error instanceof BadRequestException) {
  //       throw error;
  //     }
  //     throw new InternalServerErrorException(
  //       `Failed to process chunk: ${error.message}`,
  //     );
  //   }
  // }



// simplest way to handle file upload but not working
//   @Post('upload-chunk')
// async uploadChunk(@Req() req, @Res() res) {
//   try {
//     console.log('Upload chunk endpoint reached');
    
//     // Create a simple multer instance just for this request
//     const storage = multer.diskStorage({
//       destination: (req, file, cb) => {
//         const uploadId = req.body.uploadId;
//         const dir = path.join('./uploads', 'chunks', uploadId);
//         cb(null, dir);
//       },
//       filename: (req, file, cb) => {
//         const chunkIndex = req.body.chunkIndex;
//         cb(null, `chunk-${chunkIndex}`);
//       }
//     });
    
//     const upload = multer({ storage }).single('chunk');
    
//     // Handle the upload directly
//     upload(req, res, (err) => {
//       if (err) {
//         console.error('Error in multer upload:', err);
//         return res.status(500).json({ error: err.message });
//       }
      
//       try {
//         const { uploadId, chunkIndex } = req.body;
//         console.log(`Successfully received chunk ${chunkIndex} for upload ${uploadId}`);
        
//         // Update upload tracking
//         const uploadData = this.chunkUploads.get(uploadId);
//         if (!uploadData) {
//           return res.status(400).json({ error: 'Upload not initialized' });
//         }
        
//         uploadData.receivedChunks.push(parseInt(chunkIndex));
//         uploadData.chunkFiles.push(req.file.path);
        
//         return res.status(200).json({
//           status: 'chunk-received',
//           progress: uploadData.receivedChunks.length / uploadData.totalChunks
//         });
//       } catch (error) {
//         console.error('Error processing chunk after upload:', error);
//         return res.status(500).json({ error: error.message });
//       }
//     });
//   } catch (error) {
//     console.error('Unhandled error in upload chunk:', error);
//     return res.status(500).json({ error: error.message });
//   }
// }


@Post('upload-chunk')
@UseInterceptors(
  FileFieldsInterceptor(
    [{ name: 'chunk', maxCount: 1 }],
    {
      storage: multer.diskStorage({
        destination: './uploads', // Use flat directory like working example
        filename: (req, file, callback) => {
          try {
            console.log('Received chunk for storage');
            // Generate a unique filename that encodes the chunk info
            const uploadId = req.body.uploadId;
            const chunkIndex = req.body.chunkIndex;
            const filename = `chunk-${uploadId}-${chunkIndex}`;
            
            // Ensure directory exists
            if (!fs.existsSync('./uploads')) {
              fs.mkdirSync('./uploads', { recursive: true });
            }
            
            callback(null, filename);
          } catch (error) {
            console.error('Error in filename callback:', error);
            callback(error, "");
          }
        }
      }),
      limits: { fileSize: 100 * 1024 * 1024 }, // Same as working example
      fileFilter: (req, file, callback) => {
        console.log(`Received chunk file: ${file.fieldname}`);
        callback(null, true); // Accept all files, like your working impl
      }
    })
)
async uploadChunk(@Req() req, @UploadedFiles() files: { chunk?: Express.Multer.File[] }) {
  try {
    if (!files.chunk || !files.chunk[0]) {
      throw new BadRequestException('No chunk file received');
    }
    
    const chunkFile = files.chunk[0];
    const uploadId = req.body.uploadId;
    const chunkIndex = parseInt(req.body.chunkIndex);
    
    console.log(`Received chunk ${chunkIndex} for upload ${uploadId}: ${chunkFile.path}`);
    
    // Update in-memory tracking
    const uploadData = this.chunkUploads.get(uploadId);
    if (!uploadData) {
      throw new BadRequestException('Upload not initialized');
    }
    
    uploadData.receivedChunks.push(chunkIndex);
    uploadData.chunkFiles.push(chunkFile.path);
    
    return {
      status: 'chunk-received',
      progress: uploadData.receivedChunks.length / uploadData.totalChunks
    };
  } catch (error) {
    console.error('Error in uploadChunk:', error);
    throw new InternalServerErrorException(`Failed to process chunk: ${error.message}`);
  }
}





  @Post('complete-chunked-upload')
  async completeChunkedUpload(
    @Body() data: { uploadId: string; filename: string; fileType: string },
  ) {
    const uploadData = this.chunkUploads.get(data.uploadId);

    if (!uploadData) {
      throw new BadRequestException('Upload not initialized');
    }

    if (uploadData.receivedChunks.length !== uploadData.totalChunks) {
      throw new BadRequestException('Not all chunks received');
    }

    // Sort chunks by index to ensure correct order
    const sortedChunks = [...uploadData.receivedChunks]
      .sort((a, b) => a - b)
      .map(
        (index) =>
          uploadData.chunkFiles[uploadData.receivedChunks.indexOf(index)],
      );

    // Combine all chunks
    const finalFilePath = path.join('./uploads', data.filename);
    const writeStream = fs.createWriteStream(finalFilePath);

    for (const chunkPath of sortedChunks) {
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
    }

    writeStream.end();

    // Wait for file to be fully written
    await new Promise<void>((resolve) => {
      writeStream.on('finish', () => {
        resolve();
      });
    });

    console.log(
      `Completed chunked upload: ${data.uploadId}, final file: ${finalFilePath}`,
    );

    // Clean up chunk files
    for (const chunkPath of sortedChunks) {
      fs.unlinkSync(chunkPath);
    }

    // Remove upload directory
    fs.rmdirSync(path.join('./uploads', 'chunks', data.uploadId));

    // Clean up tracking
    this.chunkUploads.delete(data.uploadId);

    return { status: 'completed', filePath: finalFilePath };
  }

  @Post('submit-response')
  async submitResponse(@Req() req, @Body() data: any) {
    console.log('Received request with paths instead of files');

    try {
      console.log('Step 1: Starting submission process');

      const interviewData = JSON.parse(req?.body?.interviewData);
      const workspaceToken = await this.getWorkspaceTokenForInterview(
        interviewData.id,
      );
      if (!workspaceToken) {
        throw new UnauthorizedException('Could not find valid workspace token');
      }
      const apiToken = workspaceToken;

      const currentQuestionIndex = JSON.parse(req?.body?.currentQuestionIndex);
      console.log('Received interviewData:', interviewData);
      console.log('Received currentQuestionIndex:', currentQuestionIndex);
      const questionId =
        interviewData.videoInterview.videoInterviewQuestions.edges[
          currentQuestionIndex
        ].node.id;

      // Get file paths from request instead of direct file uploads
      const videoFilePath = req.body.videoPath;
      const audioFilePath = req.body.audioPath || null;

      if (!videoFilePath) {
        throw new BadRequestException('Video file path is required');
      }

      console.log('Video file path:', videoFilePath);
      if (audioFilePath) console.log('Audio file path:', audioFilePath);

      // Process the video file - now using the path from chunked upload
      const videoAttachmentObj =
        await new AttachmentProcessingService().uploadAttachmentToTwenty(
          videoFilePath,
          apiToken,
        );
      console.log('Video attachment upload response:', videoAttachmentObj);

      // Process audio if available, or extract it from video
      let audioAttachmentObj;
      let transcript = '';
      let audioPath = audioFilePath;

      if (!audioPath) {
        // Extract audio from video if not provided separately
        console.log('No audio file provided, extracting from video');
        audioPath = await this.extractAudioFromVideo(videoFilePath);
        console.log('Extracted audio path:', audioPath);
      }

      // Upload audio and get transcript
      audioAttachmentObj =
        await new AttachmentProcessingService().uploadAttachmentToTwenty(
          audioPath,
          apiToken,
        );
      console.log('Audio attachment upload response:', audioAttachmentObj);
      transcript = await this.transcriptionService.transcribeAudio(audioPath);
      console.log('Transcription completed:', transcript);

      // Prepare data for attachment table for video
      const videoDataToUploadInAttachmentTable = {
        input: {
          authorId: interviewData.candidate.jobs.recruiterId,
          name: path.basename(videoFilePath),
          fullPath: videoAttachmentObj?.data?.uploadFile,
          type: 'Video',
          candidateId: interviewData.candidate.id,
        },
      };
      console.log(
        'Video data to upload in Attachment Table:',
        videoDataToUploadInAttachmentTable,
      );
      const videoAttachment =
        await new AttachmentProcessingService().createOneAttachmentFromFilePath(
          videoDataToUploadInAttachmentTable,
          apiToken,
        );
      console.log('Video attachment:', videoAttachment);

      // Prepare data for attachment table for audio
      const audioDataToUploadInAttachmentTable = {
        input: {
          authorId: interviewData.candidate.jobs.recruiterId,
          name: path.basename(audioPath),
          fullPath: audioAttachmentObj?.data?.uploadFile,
          type: 'Audio',
          candidateId: interviewData.candidate.id,
        },
      };
      console.log(
        'Audio data to upload in Attachment Table:',
        audioDataToUploadInAttachmentTable,
      );
      const audioAttachment =
        await new AttachmentProcessingService().createOneAttachmentFromFilePath(
          audioDataToUploadInAttachmentTable,
          apiToken,
        );
      console.log('Audio attachment:', audioAttachment);

      // Create response mutation
      console.log('Preparing GraphQL mutation for response creation');
      const responseData = JSON.parse(req?.body?.responseData || '{}');

      const createResponseVariables = {
        input: {
          name: `Response for ${interviewData?.name}`,
          videoInterviewId: interviewData.id.replace('/video-interview/', ''),
          videoInterviewQuestionId: questionId,
          transcript: transcript,
          completedResponse: true,
          candidateId: interviewData.candidate.id,
          jobId: interviewData.candidate.jobs.id,
          personId: interviewData.candidate.people.id,
          timeLimitAdherence: responseData?.timeLimitAdherence || true,
        },
      };
      const graphqlQueryObjForCreationOfResponse = JSON.stringify({
        query: createResponseMutation,
        variables: createResponseVariables,
      });

      console.log(
        'Sending GraphQL mutation for response creation:',
        graphqlQueryObjForCreationOfResponse,
      );
      const responseResult = (
        await axiosRequest(graphqlQueryObjForCreationOfResponse, apiToken)
      ).data;
      console.log(
        'Response creation result:',
        JSON.stringify(responseResult, null, 2),
      );

      if (!responseResult?.data?.createVideoInterviewResponse?.id) {
        throw new Error('Failed to create video interview response');
      }

      const responseId = responseResult.data.createVideoInterviewResponse.id;

      // Link video attachment to response
      const videoDataToUploadInAttachmentResponseTable = {
        input: {
          authorId: interviewData.candidate.jobs.recruiterId,
          name: path.basename(videoFilePath),
          fullPath: videoAttachmentObj?.data?.uploadFile,
          type: 'Video',
          videoInterviewResponseId: responseId,
        },
      };
      console.log(
        'Video data to upload in Attachment Response Table:',
        videoDataToUploadInAttachmentResponseTable,
      );
      const videoAttachmentResponseUpload =
        await new AttachmentProcessingService().createOneAttachmentFromFilePath(
          videoDataToUploadInAttachmentResponseTable,
          apiToken,
        );
      console.log(
        'Video attachment response upload:',
        videoAttachmentResponseUpload,
      );

      // Link audio attachment to response
      const audioDataToUploadInAttachmentResponseTable = {
        input: {
          authorId: interviewData.candidate.jobs.recruiterId,
          name: path.basename(audioPath),
          fullPath: audioAttachmentObj?.data?.uploadFile,
          type: 'Audio',
          videoInterviewResponseId: responseId,
        },
      };
      console.log(
        'Audio data to upload in Attachment Response Table:',
        audioDataToUploadInAttachmentResponseTable,
      );
      const audioAttachmentResponseUpload =
        await new AttachmentProcessingService().createOneAttachmentFromFilePath(
          audioDataToUploadInAttachmentResponseTable,
          apiToken,
        );
      console.log(
        'Audio attachment response upload:',
        audioAttachmentResponseUpload,
      );

      // Update Candidate Status
      console.log('Preparing GraphQL mutation for candidate status update');
      const updateCandidateVariables = {
        idToUpdate: interviewData.candidate.id,
        input: {
          startVideoInterviewChatCompleted: true,
        },
      };
      const graphqlQueryObjForUpdationForCandidateStatus = JSON.stringify({
        query: graphQltoUpdateOneCandidate,
        variables: updateCandidateVariables,
      });
      console.log(
        'Candidate status update query:',
        graphqlQueryObjForUpdationForCandidateStatus,
      );

      try {
        const statusCandidateUpdateResult = (
          await axiosRequest(
            graphqlQueryObjForUpdationForCandidateStatus,
            apiToken,
          )
        ).data;
        console.log(
          'Candidate status update result:',
          statusCandidateUpdateResult,
        );
      } catch (e) {
        console.log('Error in candidate status update:', e);
        // Continue despite this error
      }

      // Update Interview Status
      const isLastQuestion = responseData?.isLastQuestion || false;
      const updateStatusVariables = {
        idToUpdate: interviewData.id.replace('/video-interview/', ''),
        input: {
          interviewStarted: true,
          interviewCompleted: isLastQuestion,
        },
      };
      const graphqlQueryObjForUpdationForStatus = JSON.stringify({
        query: updateOneVideoInterviewMutation,
        variables: updateStatusVariables,
      });
      console.log(
        'Interview status update query:',
        graphqlQueryObjForUpdationForStatus,
      );

      let statusResult;
      try {
        statusResult = (
          await axiosRequest(graphqlQueryObjForUpdationForStatus, apiToken)
        ).data;
        console.log('Interview status update result:', statusResult);
      } catch (e) {
        console.log('Error in UpdateOneVideoInterview status update:', e);
        // Continue despite this error
      }

      // Clean up temporary files
      try {
        if (fs.existsSync(videoFilePath)) {
          fs.unlinkSync(videoFilePath);
        }
        if (audioFilePath && fs.existsSync(audioFilePath)) {
          fs.unlinkSync(audioFilePath);
        }
        // If we generated the audio file, clean it up too
        if (!audioFilePath && audioPath && fs.existsSync(audioPath)) {
          fs.unlinkSync(audioPath);
        }
      } catch (cleanupError) {
        console.log(
          'Warning: Error cleaning up temporary files:',
          cleanupError,
        );
        // Non-fatal error, continue
      }

      // Prepare final response
      const response = {
        response: responseResult?.data?.createVideoInterviewResponse,
        status: statusResult?.data?.updateVideoInterview,
        videoFile: path.basename(videoFilePath),
        audioFile: path.basename(audioPath),
      };
      console.log('Final response:', JSON.stringify(response, null, 2));

      return response;
    } catch (error) {
      console.error('Error in submitResponse:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        error.message || 'An unknown error occurred',
      );
    }
  }

  // Helper method to extract audio from video
  private async extractAudioFromVideo(videoPath: string): Promise<string> {
    const audioPath = videoPath.replace(path.extname(videoPath), '.wav');

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .noVideo()
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => {
          resolve(audioPath);
        })
        .on('error', (err) => {
          reject(new Error(`Error extracting audio: ${err.message}`));
        })
        .run();
    });
  }

  private async getWorkspaceTokenForInterview(interviewId: string) {
    const results =
      await this.workspaceQueryService.executeQueryAcrossWorkspaces(
        async (workspaceId, dataSourceSchema, transactionManager) => {
          // Query to find the interview status
          const videoInterview =
            await this.workspaceQueryService.executeRawQuery(
              `SELECT * FROM ${dataSourceSchema}."_videoInterview" 
           WHERE "_videoInterview"."id"::text ILIKE $1`,
              [`%${interviewId.replace('/video-interview/', '')}%`],
              workspaceId,
              transactionManager,
            );

          console.log('Workspace token for video interview:', videoInterview);
          if (videoInterview.length > 0) {
            console.log(
              'Workspace token for video interview where videointerview length is more than 0:',
              videoInterview,
            );
            // Get API keys for the workspace
            console.log('workspaceId::', workspaceId);
            const apiKeys = await this.workspaceQueryService.getApiKeys(
              workspaceId,
              dataSourceSchema,
              transactionManager,
            );
            console.log('API Keys foud::', apiKeys);

            if (apiKeys.length > 0) {
              const apiKeyToken =
                await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
                  workspaceId,
                  apiKeys[0].id,
                );

              console.log('API Key Token::', apiKeyToken);
              if (apiKeyToken) {
                return apiKeyToken.token;
              }
            }
          }
          return null;
        },
      );
    const result = results.find((result) => result !== null);
    console.log('Result found::', result);
    // Return first non-null result
    return result;
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
          fs.unlinkSync(inputPath); // Remove the original file
          resolve(outputPath);
        })
        .on('error', (err) => {
          reject(new Error(`Error converting video: ${err.message}`));
        });
    });
  }

  // leaqve unauthenticated due to public candidate access to this endpoint
  @Post('get-questions')
  async getQuestions(
    @Req() req,
    @Body() interviewData: { videoInterviewTemplateId: string },
  ) {
    const apiToken = req.headers.authorization.split(' ')[1]; // Assuming Bearer token

    const questionsVariables = {
      filter: {
        videoInterviewTemplateId: {
          eq: interviewData.videoInterviewTemplateId,
        },
      },
      limit: 30,
      orderBy: { position: 'AscNullsFirst' },
    };

    const graphqlQueryObjForVideoInterviewQuestions = JSON.stringify({
      query: questionsQuery,
      variables: questionsVariables,
    });

    const result = (
      await axiosRequest(graphqlQueryObjForVideoInterviewQuestions, apiToken)
    ).data as {
      videoInterviewQuestions: {
        edges: {
          node: {
            id: string;
            name: string;
            questionValue: string;
            timeLimit: number;
            position: number;
            videoInterviewTemplateId: string;
          };
        }[];
      };
    };
    return result.videoInterviewQuestions.edges.map((edge) => edge.node);
  }

  @Post('update-feedback')
  async updateFeedback(@Req() req, @Body() feedbackData) {
    const apiToken = req.headers.authorization.split(' ')[1]; // Assuming Bearer token

    console.log('This is the feedback obj', feedbackData);
    const updateStatusVariables = {
      idToUpdate: feedbackData.interviewId.replace('/video-interview/', ''),
      input: {
        feedback: feedbackData.feedback,
      },
    };

    const graphqlQueryObjForUpdationForStatus = JSON.stringify({
      query: updateOneVideoInterviewMutation,
      variables: updateStatusVariables,
    });

    try {
      const response = await axiosRequest(
        graphqlQueryObjForUpdationForStatus,
        apiToken,
      );
      console.log('Feedback updated successfully:', response.data);
      // Just send a simple response object instead of the full response
      return {
        statusCode: 200,
        message: 'Feedback updated successfully',
      };
    } catch (error) {
      // Handle the error without trying to serialize the full error object
      throw new HttpException(
        {
          statusCode: 500,
          message: 'Failed to update feedback',
        },
        500,
      );
    }
  }

  // leaqve unauthenticated due to public candidate access to this endpoint
  @Post('get-interview-details')
  async getInterViewDetails(
    @Req() req: any,
  ): Promise<GetInterviewDetailsResponse> {
    console.log('Got a request in get interview details');

    console.log(
      'This is the request body in get interview details:',
      req?.body,
    );
    // const apiToken = req.headers.authorization.split(' ')[1]; // Assuming Bearer token
    const { interviewId } = req.body;
    console.log('Get interview details hit', interviewId);
    const workspaceToken =
      await this.getWorkspaceTokenForInterview(interviewId);
    if (!workspaceToken) {
      console.log('NO WORKSPACE TOKEN FOUND');
      // throw new UnauthorizedException('Could not find valid workspace token');
    }
    const apiToken = workspaceToken || '';

    console.log('Api Token:', apiToken);
    console.log('Got video interview hit');
    if (req.method === 'POST') {
      console.log('Received interviewId:', interviewId);

      const InterviewStatusesVariables = {
        filter: {
          interviewLink: {
            primaryLinkUrl: {
              ilike: `%${interviewId}%`,
            },
          },
        },
      };

      const graphqlQueryObjForvideoInterviewQuestions = JSON.stringify({
        query: graphQueryToFindManyvideoInterviews,
        variables: InterviewStatusesVariables,
      });

      let responseFromInterviewRequests;
      let videoInterviewId;
      let recruiterProfile;
      let responseForVideoInterviewIntroductionAttachment;
      let responseForVideoInterviewQuestionAttachments: any[] = [];
      let questionsAttachmentsResponse: any[] = [];

      try {
        const response = await axiosRequest(
          graphqlQueryObjForvideoInterviewQuestions,
          apiToken,
        );
        console.log('REhis response:', response?.data);
        console.log('REhis response:', response?.data?.data);
        responseFromInterviewRequests = response?.data;
        videoInterviewId =
          responseFromInterviewRequests?.data?.videoInterviews?.edges[0]?.node
            ?.videoInterviewTemplate?.id;

        console.log(
          'responseFromInterviewRequests?.data?.videoInterviews?.edges[0]?.node',
          responseFromInterviewRequests?.data?.videoInterviews?.edges[0]?.node,
        );
        const recruiterId =
          responseFromInterviewRequests?.data?.videoInterviews?.edges[0]?.node
            ?.candidate?.jobs?.recruiterId;

        const findWorkspaceMemberProfilesQuery = JSON.stringify({
          query: findWorkspaceMemberProfiles,
          variables: { filter: { workspaceMemberId: { eq: recruiterId } } },
        });
        const workspaceMemberProfilesResponse = await axiosRequest(
          findWorkspaceMemberProfilesQuery,
          apiToken,
        );
        console.log(
          'This si the workspace member profile:',
          workspaceMemberProfilesResponse.data.data.workspaceMemberProfiles,
        );
        recruiterProfile =
          workspaceMemberProfilesResponse?.data?.data?.workspaceMemberProfiles
            ?.edges[0]?.node;
        console.log('recruiterProrile:', recruiterProfile);

        console.log('Received videoInterviewId:', videoInterviewId);
      } catch (error) {
        console.log('There was an error:', error);
        recruiterProfile = null;
        console.error('Error fetching interview data:', error);
        responseFromInterviewRequests = null;
      }

      if (videoInterviewId) {
        const videoInterviewIntroductionAttachmentDataQuery = JSON.stringify({
          query: findManyAttachmentsQuery,
          variables: {
            filter: { videoInterviewTemplateId: { eq: videoInterviewId } },
            orderBy: { createdAt: 'DescNullsFirst' },
          },
        });

        const allQuestionIds =
          responseFromInterviewRequests?.data?.videoInterviews?.edges[0]?.node?.videoInterviewTemplate?.videoInterviewQuestions?.edges
            .map(
              (edge: { node: { id: string; createdAt: string } }) => edge.node,
            )
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            )
            .map((node) => node.id);
        console.log('Received allQuestionIds:', allQuestionIds);

        if (!allQuestionIds || allQuestionIds.length === 0) {
          console.log('No question IDs found, cannot proceed');
          throw new Error('No question IDs found');
        }

        const questionsAttachmentDataQueries = allQuestionIds.map((id) =>
          JSON.stringify({
            query: findManyAttachmentsQuery,
            variables: {
              filter: { videoInterviewQuestionId: { eq: id } },
              orderBy: { createdAt: 'DescNullsFirst' },
            },
          }),
        );

        try {
          console.log(
            'Going to get video interview introduction attachment data',
          );
          responseForVideoInterviewIntroductionAttachment = await axiosRequest(
            videoInterviewIntroductionAttachmentDataQuery,
            apiToken,
          );
        } catch (error) {
          console.log(
            'Error fetching video interview introduction attachment data:',
            error,
          );
          responseForVideoInterviewIntroductionAttachment = null;
        }

        try {
          responseForVideoInterviewQuestionAttachments = await Promise.all(
            questionsAttachmentDataQueries.map((query) =>
              axiosRequest(query, apiToken),
            ),
          );
        } catch (error) {
          console.log(
            'Error fetching video interview question attachments:',
            error,
          );
          responseForVideoInterviewQuestionAttachments = [];
        }

        questionsAttachmentsResponse =
          responseForVideoInterviewQuestionAttachments.flatMap(
            (response) =>
              response.data?.data?.attachments?.edges?.map(
                (edge: {
                  node: { id: string; fullPath: string; name: string };
                }) => edge.node,
              ) || [],
          );
      }

      const result: GetInterviewDetailsResponse = {
        recruiterProfile,
        responseFromInterviewRequests,
        videoInterviewAttachmentResponse:
          responseForVideoInterviewIntroductionAttachment?.data || null,
        questionsAttachments: questionsAttachmentsResponse,
      };

      return result;
    } else {
      console.log('Invalid request method');
      return {
        recruiterProfile: null,
        responseFromInterviewRequests: null,
        videoInterviewAttachmentResponse: null,
        questionsAttachments: [],
      };
    }
  }
}
