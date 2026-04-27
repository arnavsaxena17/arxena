import { Controller, Get, Req, Res } from '@nestjs/common';

import { Request, Response } from 'express';

import { RecruiterProfileService } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { LinkedinXrayProgressPubSubService } from 'src/modules/linkedin-xray/services/linkedin-xray-progress-pubsub.service';
import { LinkedinXrayProgressData } from 'src/modules/linkedin-xray/types/linkedin-xray-search-job.types';

@Controller('linkedin-xray-progress')
export class LinkedinXrayProgressController {
  constructor(
    private readonly linkedinXrayProgressPubSubService: LinkedinXrayProgressPubSubService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  @Get('stream')
  async stream(
    @Req() request: Request & { query: Record<string, string | undefined> },
    @Res() response: Response,
  ): Promise<void> {
    const apiToken = request.query.token;
    const originHeader = request.headers['x-origin-domain'];
    const originFromOriginHeader = request.headers.origin;
    const originFromQuery = request.query.origin;
    const origin = originHeader || originFromOriginHeader || originFromQuery;

    console.log('[LinkedinXrayProgressController] Origin resolved:', {
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
      throw new Error('Token is required as query parameter');
    }

    console.log(
      '[LinkedinXrayProgressController] Calling getCurrentUser with origin:',
      origin,
    );
    const currentUser = await new RecruiterProfileService(
      this.staticGraphQLService,
    ).getCurrentUser(apiToken, String(origin || ''));
    const recruiterId = currentUser?.workspaceMember?.id;

    if (!recruiterId) {
      throw new Error('Could not get recruiter ID for LinkedIn x-ray progress');
    }

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event: string, data: Record<string, unknown>) => {
      response.write(`event: ${event}\n`);
      response.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    await this.linkedinXrayProgressPubSubService.subscribeToProgress(
      recruiterId,
      (progressData) => {
        this.emitMappedEvents(sendEvent, progressData);
      },
    );

    const heartbeatInterval = setInterval(() => {
      sendEvent('status', {
        message: 'Connection alive',
        heartbeat: true,
        timestamp: new Date().toISOString(),
      });
    }, 30000);

    const cleanup = () => {
      clearInterval(heartbeatInterval);
      this.linkedinXrayProgressPubSubService
        .unsubscribeFromProgress(recruiterId)
        .catch(() => undefined);
      response.end();
    };

    request.on('close', cleanup);
    request.on('aborted', cleanup);
  }

  private emitMappedEvents(
    sendEvent: (event: string, data: Record<string, unknown>) => void,
    progressData: LinkedinXrayProgressData,
  ) {
    if (progressData.step === 'started' || progressData.step === 'status') {
      sendEvent('status', {
        message: progressData.message,
        searchJobId: progressData.search_job_id,
        searchEngine: progressData.search_engine,
        rawQuery: progressData.raw_query,
        snapshotId: progressData.snapshot_id,
        pollingAttempt: progressData.polling_attempt,
        paginationMode: progressData.pagination_mode,
      });
      return;
    }

    if (progressData.step === 'page_fetched') {
      sendEvent('status', {
        message: `Fetched page ${progressData.page}${progressData.engine ? ` via ${progressData.engine}` : ''} (${progressData.total_candidates || 0} candidates collected so far)`,
        page: progressData.page,
        engine: progressData.engine,
        candidatesCollectedSoFar: progressData.total_candidates,
        searchJobId: progressData.search_job_id,
      });

      sendEvent('pageResults', {
        page: progressData.page,
        engine: progressData.engine,
        candidatesReceived: progressData.candidates?.length || 0,
        totalCandidates: progressData.total_candidates,
        totalPages: progressData.total_batches ?? progressData.total_pages_available,
        fetchedPages: progressData.fetched_pages,
        pagesByEngine: progressData.pages_by_engine,
        strategyLabel: progressData.engine
          ? `${progressData.engine} linkedin x-ray`
          : 'linkedin x-ray',
        searchJobId: progressData.search_job_id,
      });

      if ((progressData.candidates?.length || 0) > 0) {
        sendEvent('candidateBatch', {
          page: progressData.page,
          engine: progressData.engine,
          candidates: progressData.candidates,
          totalCandidatesSoFar: progressData.total_candidates,
          fetchedPages: progressData.fetched_pages,
          pagesByEngine: progressData.pages_by_engine,
          searchJobId: progressData.search_job_id,
        });
      }

      return;
    }

    if (progressData.step === 'completed') {
      sendEvent('complete', {
        message: progressData.message,
        candidates: progressData.candidates,
        totalCandidates: progressData.total_candidates,
        pagesByEngine: progressData.pages_by_engine,
        searchJobId: progressData.search_job_id,
      });
      return;
    }

    if (progressData.step === 'error') {
      sendEvent('error', {
        error: progressData.message,
        searchJobId: progressData.search_job_id,
        rawQuery: progressData.raw_query,
      });
    }
  }
}
