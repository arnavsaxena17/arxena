import { Controller, Get, Post, Req, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { UploadProgressPubSubService } from '../services/upload-progress-pubsub.service';

@Controller('upload-progress')
export class UploadProgressController {
  constructor(
    private readonly uploadProgressPubSubService: UploadProgressPubSubService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  @Get('stream')
  @Sse('upload-progress-stream')
  async streamUploadProgress(@Req() request: any): Promise<Observable<any>> {
    console.log('🔗 [UploadProgressController] SSE stream endpoint called');
    
    // Get token from query parameter since EventSource doesn't support headers
    const apiToken = request.query.token;
    const originHeader = request.headers['x-origin-domain'];
    const originFromOriginHeader = request.headers.origin;
    const originFromQuery = request.query.origin;
    const origin = originHeader || originFromOriginHeader || originFromQuery;
    
    console.log('🔗 [UploadProgressController] API Token from query:', apiToken ? 'Present' : 'Missing');
    console.log('🔗 [UploadProgressController] Origin resolved:', {
      resolved: origin,
      source: originHeader
        ? 'headers[x-origin-domain]'
        : originFromOriginHeader
          ? 'headers[origin]'
          : originFromQuery
            ? 'query[origin]'
            : 'none',
      raw: {
        'x-origin-domain': originHeader,
        origin: originFromOriginHeader,
        'query.origin': originFromQuery,
      },
    });
    
    if (!apiToken) {
      console.error('❌ [UploadProgressController] No API token provided');
      throw new Error('Token is required as query parameter');
    }

    try {
      console.log('🔗 [UploadProgressController] Getting current user for SSE...');
      console.log('🔗 [UploadProgressController] Calling getCurrentUser with origin:', origin);
      
      // Get current user to get recruiter ID
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      console.log('🔗 [UploadProgressController] Recruiter ID for SSE:', recruiterId);
      console.log('🔗 [UploadProgressController] Current user workspace member:', currentUser?.workspaceMember?.userEmail);
      console.log('🔗 [UploadProgressController] Current user ID:', currentUser?.id);

      if (!recruiterId) {
        console.error('❌ [UploadProgressController] Could not get recruiter ID');
        throw new Error('Could not get recruiter ID for progress streaming');
      }

      return new Observable((observer) => {
        console.log(`🔗 [UploadProgressController] Setting up SSE subscription for recruiter: ${recruiterId}`);
        
        // Subscribe to Redis pub-sub for this recruiter
        this.uploadProgressPubSubService.subscribeToProgress(
          recruiterId,
          (progressData) => {
            console.log(`📨 [UploadProgressController] Received progress data for recruiter ${recruiterId}:`, progressData);
            try {
              // For SSE, we need to send the data in the proper SSE format
              const sseData = `data: ${JSON.stringify(progressData)}\n\n`;
              observer.next(sseData);
              console.log(`✅ [UploadProgressController] Successfully sent progress data to observer`);
            } catch (error) {
              console.error('❌ [UploadProgressController] Error sending data to observer:', error);
            }
          }
        ).catch((error) => {
          console.error('❌ [UploadProgressController] Error subscribing to progress updates:', error);
          observer.error(error);
        });

        // Keep the connection alive by sending periodic heartbeats
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeatData = {
              step: 'heartbeat',
              message: 'Connection alive',
              timestamp: new Date().toISOString()
            };
            const sseHeartbeat = `data: ${JSON.stringify(heartbeatData)}\n\n`;
            observer.next(sseHeartbeat);
          } catch (error) {
            console.error('❌ [UploadProgressController] Error sending heartbeat:', error);
            clearInterval(heartbeatInterval);
          }
        }, 30000); // Send heartbeat every 30 seconds

        // Cleanup on unsubscribe
        return () => {
          console.log(`🧹 [UploadProgressController] Cleaning up SSE subscription for recruiter: ${recruiterId}`);
          clearInterval(heartbeatInterval);
          this.uploadProgressPubSubService.unsubscribeFromProgress(recruiterId).catch((error) => {
            console.error('❌ [UploadProgressController] Error unsubscribing from progress updates:', error);
          });
        };
      });
    } catch (error) {
      console.error('❌ [UploadProgressController] Failed to setup progress streaming:', error);
      throw new Error(`Failed to setup progress streaming: ${error.message}`);
    }
  }

  @Post('test-publish')
  async testPublish(@Req() request: any): Promise<object> {
    const apiToken = request.query.token || request.headers.authorization?.split(' ')[1]?.replace(/[\r\n]+/g, '');
    const origin = request.headers.origin || request.query.origin;

    try {
      // Get current user to get recruiter ID
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      if (!recruiterId) {
        return {
          status: 'Failed',
          message: 'Could not get recruiter ID'
        };
      }

      // Publish a test message
      await this.uploadProgressPubSubService.publishUploadStarted(
        recruiterId,
        10,
        2
      );

      return {
        status: 'Success',
        message: 'Test progress message published successfully'
      };
    } catch (error) {
      return {
        status: 'Failed',
        error: error.message
      };
    }
  }

  @Get('test-connection')
  async testConnection(@Req() request: any): Promise<object> {
    const apiToken = request.query.token;
    const origin = request.headers.origin || request.query.origin;

    try {
      if (!apiToken) {
        return {
          status: 'Failed',
          message: 'Token is required as query parameter'
        };
      }

      // Get current user to get recruiter ID
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      if (!recruiterId) {
        return {
          status: 'Failed',
          message: 'Could not get recruiter ID'
        };
      }

      return {
        status: 'Success',
        message: 'SSE connection test successful',
        recruiterId: recruiterId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'Failed',
        error: error.message
      };
    }
  }

  @Post('debug-token')
  async debugToken(@Req() request: any): Promise<object> {
    const apiToken = request.query.token || request.headers.authorization?.split(' ')[1]?.replace(/[\r\n]+/g, '');
    const origin = request.headers.origin || request.query.origin;

    try {
      if (!apiToken) {
        return {
          status: 'Failed',
          message: 'Token is required'
        };
      }

      console.log('🔍 [DebugToken] API Token preview:', apiToken.substring(0, 50) + '...');
      console.log('🔍 [DebugToken] Origin:', origin);

      // Get current user to get recruiter ID
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      console.log('🔍 [DebugToken] Current user:', currentUser);
      console.log('🔍 [DebugToken] Workspace member:', currentUser?.workspaceMember);
      console.log('🔍 [DebugToken] Recruiter ID:', recruiterId);

      return {
        status: 'Success',
        message: 'Token debug successful',
        recruiterId: recruiterId,
        currentUserId: currentUser?.id,
        workspaceMemberId: currentUser?.workspaceMember?.id,
        workspaceId: currentUser?.currentWorkspace?.id,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('🔍 [DebugToken] Error:', error);
      return {
        status: 'Failed',
        error: error.message
      };
    }
  }
}
