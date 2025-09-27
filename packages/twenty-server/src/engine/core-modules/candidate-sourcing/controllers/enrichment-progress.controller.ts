import { Controller, Get, Post, Req, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { EnrichmentProgressPubSubService } from '../services/enrichment-progress-pubsub.service';

@Controller('enrichment-progress')
export class EnrichmentProgressController {
  constructor(
    private readonly enrichmentProgressPubSubService: EnrichmentProgressPubSubService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  @Get('stream')
  @Sse('enrichment-progress-stream')
  async streamEnrichmentProgress(@Req() request: any): Promise<Observable<any>> {
    console.log('🔗 [EnrichmentProgressController] SSE stream endpoint called');
    console.log('🔗 [EnrichmentProgressController] Request headers:', request.headers);
    console.log('🔗 [EnrichmentProgressController] Request query:', request.query);
    
    // Get token from query parameter since EventSource doesn't support headers
    const apiToken = request.query.token;
    const origin = request.headers.origin || request.query.origin;
    
    console.log('🔗 [EnrichmentProgressController] API Token from query:', apiToken ? 'Present' : 'Missing');
    console.log('🔗 [EnrichmentProgressController] Origin:', origin);
    
    if (!apiToken) {
      console.error('❌ [EnrichmentProgressController] No API token provided');
      throw new Error('Token is required as query parameter');
    }

    try {
      console.log('🔗 [EnrichmentProgressController] Getting current user for SSE...');
      // Get current user to get recruiter ID
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      console.log('🔗 [EnrichmentProgressController] Recruiter ID for SSE:', recruiterId);

      if (!recruiterId) {
        console.error('❌ [EnrichmentProgressController] Could not get recruiter ID');
        throw new Error('Could not get recruiter ID for progress streaming');
      }

      return new Observable((observer) => {
        console.log(`🔗 [EnrichmentProgressController] Setting up SSE subscription for recruiter: ${recruiterId}`);
        
        // Subscribe to Redis pub-sub for this recruiter
        this.enrichmentProgressPubSubService.subscribeToProgress(
          recruiterId,
          (progressData) => {
            console.log(`📨 [EnrichmentProgressController] Received progress data for recruiter ${recruiterId}:`, progressData);
            try {
              // For SSE, we need to send the data in the proper SSE format
              const sseData = `data: ${JSON.stringify(progressData)}\n\n`;
              observer.next(sseData);
              console.log(`✅ [EnrichmentProgressController] Successfully sent progress data to observer`);
            } catch (error) {
              console.error('❌ [EnrichmentProgressController] Error sending data to observer:', error);
            }
          }
        ).catch((error) => {
          console.error('❌ [EnrichmentProgressController] Error subscribing to progress updates:', error);
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
            console.error('❌ [EnrichmentProgressController] Error sending heartbeat:', error);
            clearInterval(heartbeatInterval);
          }
        }, 30000); // Send heartbeat every 30 seconds

        // Cleanup on unsubscribe
        return () => {
          console.log(`🧹 [EnrichmentProgressController] Cleaning up SSE subscription for recruiter: ${recruiterId}`);
          clearInterval(heartbeatInterval);
          this.enrichmentProgressPubSubService.unsubscribeFromProgress(recruiterId).catch((error) => {
            console.error('❌ [EnrichmentProgressController] Error unsubscribing from progress updates:', error);
          });
        };
      });
    } catch (error) {
      console.error('❌ [EnrichmentProgressController] Failed to setup progress streaming:', error);
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
      await this.enrichmentProgressPubSubService.publishEnrichmentStarted(
        recruiterId,
        2,
        10
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
}
