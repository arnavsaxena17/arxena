import { Controller, Get, Post, Req, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { AiFilteringProgressPubSubService } from '../services/ai-filtering-progress-pubsub.service';

@Controller('ai-filtering-progress')
export class AiFilteringProgressController {
  constructor(
    private readonly aiFilteringProgressPubSubService: AiFilteringProgressPubSubService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  @Get('stream')
  @Sse('ai-filtering-progress-stream')
  async streamAiFilteringProgress(@Req() request: any): Promise<Observable<any>> {
    const apiToken = request.query.token;
    const origin = request.headers.origin || request.query.origin;

    if (!apiToken) {
      throw new Error('Token is required as query parameter');
    }

    try {
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      if (!recruiterId) {
        throw new Error('Could not get recruiter ID for progress streaming');
      }

      return new Observable((observer) => {
        this.aiFilteringProgressPubSubService.subscribeToProgress(
          recruiterId,
          (progressData) => {
            try {
              const sseData = `data: ${JSON.stringify(progressData)}\n\n`;
              observer.next(sseData);
            } catch (error) {
              observer.error(error);
            }
          }
        ).catch((error) => {
          observer.error(error);
        });

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
            clearInterval(heartbeatInterval);
          }
        }, 30000);

        return () => {
          clearInterval(heartbeatInterval);
          this.aiFilteringProgressPubSubService.unsubscribeFromProgress(recruiterId).catch(() => {});
        };
      });
    } catch (error) {
      throw new Error(`Failed to setup progress streaming: ${error.message}`);
    }
  }

  @Post('test-publish')
  async testPublish(@Req() request: any): Promise<object> {
    const apiToken = request.query.token || request.headers.authorization?.split(' ')[1]?.replace(/[\r\n]+/g, '');
    const origin = request.headers.origin || request.query.origin;

    try {
      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      if (!recruiterId) {
        return { status: 'Failed', message: 'Could not get recruiter ID' };
      }

      await this.aiFilteringProgressPubSubService.publishAiFilteringStarted(recruiterId, 2, 10);

      return { status: 'Success', message: 'Test progress message published successfully' };
    } catch (error) {
      return { status: 'Failed', error: error.message };
    }
  }

  @Get('test-connection')
  async testConnection(@Req() request: any): Promise<object> {
    const apiToken = request.query.token;
    const origin = request.headers.origin || request.query.origin;

    try {
      if (!apiToken) {
        return { status: 'Failed', message: 'Token is required as query parameter' };
      }

      const currentUser = await new RecruiterProfileService(this.staticGraphQLService).getCurrentUser(apiToken, origin);
      const recruiterId = currentUser?.workspaceMember?.id;

      if (!recruiterId) {
        return { status: 'Failed', message: 'Could not get recruiter ID' };
      }

      return {
        status: 'Success',
        message: 'SSE connection test successful',
        recruiterId: recruiterId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { status: 'Failed', error: error.message };
    }
  }
}
