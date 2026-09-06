import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { OutreachMockLifecycleService } from 'src/engine/core-modules/outreach-command/services/outreach-mock-lifecycle.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Controller('outreach-mock')
export class OutreachMockController {
  private readonly logger = new Logger(OutreachMockController.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly outreachMockLifecycleService: OutreachMockLifecycleService,
  ) {}

  @Post('candidates/:candidateId/accept')
  async acceptConnection(
    @Param('candidateId') candidateId: string,
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const { apiToken } = this.requireAuth(request);
    this.requireCandidateId(candidateId);

    return this.outreachMockLifecycleService.acceptConnection({
      candidateId,
      apiToken,
    });
  }

  @Post('candidates/:candidateId/reply')
  async injectReply(
    @Param('candidateId') candidateId: string,
    @Body()
    body: { text?: string; delayMinutes?: number },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const { apiToken, workspaceId } = await this.requireAuthWithWorkspace(
      request,
    );
    this.requireCandidateId(candidateId);

    if (!isNonEmptyString(body?.text?.trim())) {
      throw new HttpException('text is required', HttpStatus.BAD_REQUEST);
    }

    return this.outreachMockLifecycleService.injectReply({
      workspaceId,
      candidateId,
      apiToken,
      text: body.text.trim(),
      delayMinutes: body.delayMinutes,
    });
  }

  // WhatsApp-style HITL: yes / no / change message on the pending FORM.
  // approve → send draft (or editedBody); edit → send editedBody; reject → stop run (no send).
  @Post('candidates/:candidateId/hitl')
  async decideHitl(
    @Param('candidateId') candidateId: string,
    @Body()
    body: {
      decision?: string;
      editedBody?: string;
      startsAt?: string;
      endsAt?: string;
      projectId?: string;
    },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const { apiToken, workspaceId } = await this.requireAuthWithWorkspace(
      request,
    );
    this.requireCandidateId(candidateId);

    let decision: 'approve' | 'reject' | 'edit';

    try {
      decision = this.outreachMockLifecycleService.resolveHitlDecision(
        body?.decision,
      );
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : String(error),
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.outreachMockLifecycleService.decideHitlForm({
        workspaceId,
        candidateId,
        apiToken,
        decision,
        editedBody: body?.editedBody,
        startsAt: body?.startsAt,
        endsAt: body?.endsAt,
        projectId: body?.projectId,
      });
    } catch (error) {
      this.logger.warn(
        `HITL mock failed for ${candidateId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new HttpException(
        error instanceof Error ? error.message : 'HITL mock failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('candidates/:candidateId/reset')
  async resetFromConnectionRequest(
    @Param('candidateId') candidateId: string,
    @Query('to') to: string | undefined,
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const { apiToken, workspaceId } = await this.requireAuthWithWorkspace(
      request,
    );
    this.requireCandidateId(candidateId);

    let resetTarget: 'CONNECTION_SENT' | 'QUEUED';

    try {
      resetTarget = this.outreachMockLifecycleService.resolveResetTarget(to);
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : String(error),
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.outreachMockLifecycleService.resetFromConnectionRequest({
      workspaceId,
      candidateId,
      apiToken,
      to: resetTarget,
    });
  }

  // Queue N synthetic LinkedIn profiles onto a project for Stage B/C workflow testing.
  @Post('projects/:projectId/upload-profiles')
  async uploadMockProfiles(
    @Param('projectId') projectId: string,
    @Body() body: { count?: number },
    @Req() request: { headers?: { authorization?: string } },
  ) {
    const { workspaceId } = await this.requireAuthWithWorkspace(request);

    if (!isNonEmptyString(projectId)) {
      throw new HttpException('projectId is required', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.outreachMockLifecycleService.uploadMockProfiles({
        workspaceId,
        projectId,
        count: body?.count,
      });
    } catch (error) {
      this.logger.warn(
        `Mock upload-profiles failed for ${projectId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new HttpException(
        error instanceof Error ? error.message : 'Mock upload-profiles failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private requireAuth(request: {
    headers?: { authorization?: string };
  }): { apiToken: string } {
    const apiToken = request.headers?.authorization?.replace?.('Bearer ', '');

    if (!isNonEmptyString(apiToken)) {
      throw new HttpException('API token is required', HttpStatus.UNAUTHORIZED);
    }

    return { apiToken };
  }

  private async requireAuthWithWorkspace(request: {
    headers?: { authorization?: string };
  }): Promise<{ apiToken: string; workspaceId: string }> {
    const { apiToken } = this.requireAuth(request);
    const workspaceId =
      await this.workspaceQueryService.getWorkspaceIdFromToken(apiToken);

    if (!isNonEmptyString(workspaceId)) {
      this.logger.warn('Could not resolve workspaceId from API token');
      throw new HttpException(
        'Could not resolve workspace from API token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return { apiToken, workspaceId };
  }

  private requireCandidateId(candidateId: string): void {
    if (!isNonEmptyString(candidateId)) {
      throw new HttpException(
        'candidateId is required',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
