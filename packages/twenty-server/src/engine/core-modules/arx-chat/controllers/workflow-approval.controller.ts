import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { Response } from 'express';
import { randomUUID } from 'crypto';

import { ApprovalNotifierService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/approval-notifier.service';
import { WorkflowFormDecisionPointerService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.service';
import {
  createWorkflowFormDecisionPointer,
  verifyWorkflowFormDecisionPointer,
} from 'src/engine/core-modules/arx-chat/services/workflow-approval/workflow-form-decision-pointer.util';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkflowRunnerWorkspaceService } from 'src/modules/workflow/workflow-runner/workspace-services/workflow-runner.workspace-service';

@Controller('workflow-approval')
export class WorkflowApprovalController {
  private readonly logger = new Logger(WorkflowApprovalController.name);

  constructor(
    private readonly workflowFormDecisionPointerService: WorkflowFormDecisionPointerService,
    private readonly approvalNotifierService: ApprovalNotifierService,
    private readonly moduleRef: ModuleRef,
  ) {}

  private getWorkflowRunner(): WorkflowRunnerWorkspaceService {
    return this.moduleRef.get(WorkflowRunnerWorkspaceService, {
      strict: false,
    });
  }

  @Post('smoke/unipile')
  @UseGuards(JwtAuthGuard)
  async smokeUnipile(
    @Body()
    body: {
      phone: string;
      accountId?: string;
      contextText?: string;
      token?: string;
      fieldTypes?: string[];
    },
  ) {
    if (!body?.phone) {
      throw new HttpException('phone is required', HttpStatus.BAD_REQUEST);
    }

    // Smoke send only — pointer uses random ids unless caller supplies one
    const token =
      body.token ??
      createWorkflowFormDecisionPointer({
        workspaceId: randomUUID(),
        workflowRunId: randomUUID(),
        stepId: randomUUID(),
      });
    const fieldTypes = body.fieldTypes?.length
      ? body.fieldTypes
      : ['BOOLEAN'];

    const result = await this.approvalNotifierService.notifyUnipile({
      contextText: body.contextText ?? 'Workflow form smoke test',
      token,
      formFields: fieldTypes.map((type) => ({ type })),
      recipients: {
        WHATSAPP_UNIPILE: body.phone,
        unipileAccountId: body.accountId,
      },
    });

    return {
      token,
      fillUrl: this.approvalNotifierService.buildFillUrl(token),
      result,
    };
  }

  @Post('decide')
  async decide(
    @Body()
    body: {
      decisionToken: string;
      decision?: 'approve' | 'reject';
      fieldName?: string;
      value?: boolean | string | number;
      response?: Record<string, unknown>;
    },
  ) {
    return this.applyDecision({
      decisionToken: body.decisionToken,
      decision: body.decision,
      fieldName: body.fieldName,
      value: body.value,
      response: body.response,
    });
  }

  @Get(':token')
  async decideViaGet(
    @Param('token') token: string,
    @Query('decision') decision?: string,
    @Res() response?: Response,
  ) {
    if (decision !== 'approve' && decision !== 'reject') {
      throw new HttpException(
        'Query decision must be approve or reject',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.applyDecision({
      decisionToken: token,
      decision,
    });

    if (response) {
      response
        .status(HttpStatus.OK)
        .send(
          `<html><body><h1>Decision recorded: ${decision}</h1><p>You can close this window.</p></body></html>`,
        );

      return;
    }

    return { status: 'ok' };
  }

  @Get(':token/fill')
  async fillPage(@Param('token') token: string, @Res() response: Response) {
    const parts = verifyWorkflowFormDecisionPointer(token);

    if (!parts) {
      response.status(HttpStatus.NOT_FOUND).send('Approval not found');

      return;
    }

    let fields: Array<{
      name: string;
      label: string;
      type: string;
      placeholder?: string;
      value?: unknown;
    }> = [];
    let contextText = '';
    let stepStatus: string | undefined;

    try {
      const pending =
        await this.workflowFormDecisionPointerService.getPendingFormFields(
          parts,
        );

      fields = pending.fields;
      contextText = pending.contextText;
      stepStatus = pending.stepStatus;
    } catch {
      response.status(HttpStatus.NOT_FOUND).send('Workflow run / step not found');

      return;
    }

    if (
      !this.workflowFormDecisionPointerService.isStepStillPending(stepStatus)
    ) {
      response
        .status(HttpStatus.OK)
        .send(`<html><body><h1>Already submitted</h1></body></html>`);

      return;
    }

    const fieldInputs = fields
      .map((field) => {
        const inputType =
          field.type === 'NUMBER'
            ? 'number'
            : field.type === 'DATE'
              ? 'date'
              : field.type === 'BOOLEAN'
                ? 'checkbox'
                : 'text';
        const sampleValue =
          field.value === null || field.value === undefined
            ? ''
            : Array.isArray(field.value)
              ? field.value.join(', ')
              : String(field.value);
        const placeholder = field.placeholder
          ? ` placeholder="${escapeHtml(field.placeholder)}"`
          : '';

        if (inputType === 'checkbox') {
          const checked =
            field.value === true || field.value === 'true' ? ' checked' : '';

          return `<label><input type="checkbox" name="${escapeHtml(field.name)}"${checked} /> ${escapeHtml(field.label || field.name)}</label>`;
        }

        if (field.type === 'TEXT') {
          return `<label>${escapeHtml(field.label || field.name)}<br/><textarea name="${escapeHtml(field.name)}" rows="4"${placeholder}>${escapeHtml(sampleValue)}</textarea></label>`;
        }

        return `<label>${escapeHtml(field.label || field.name)}<br/><input name="${escapeHtml(field.name)}" type="${inputType}" value="${escapeHtml(sampleValue)}"${placeholder} /></label>`;
      })
      .join('<br/><br/>');

    response.status(HttpStatus.OK).send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><title>Workflow form</title>
<style>body{font-family:system-ui;max-width:480px;margin:2rem auto;padding:0 1rem}textarea,input{width:100%;padding:.5rem;margin-top:.25rem}button{margin-top:1rem;padding:.6rem 1rem}</style>
</head>
<body>
  <h1>Workflow form</h1>
  <p>${contextText ? escapeHtml(contextText) : ''}</p>
  <form method="POST" action="/workflow-approval/${encodeURIComponent(token)}/submit">
    ${fieldInputs || '<p>No fields in form step.</p>'}
    <button type="submit">Submit</button>
  </form>
</body>
</html>`);
  }

  @Post(':token/submit')
  async submitFill(
    @Param('token') token: string,
    @Body() body: Record<string, unknown>,
    @Res() response: Response,
  ) {
    const parts = verifyWorkflowFormDecisionPointer(token);

    if (!parts) {
      throw new HttpException('Approval not found', HttpStatus.NOT_FOUND);
    }

    const { fields } =
      await this.workflowFormDecisionPointerService.getPendingFormFields(parts);

    const formResponse: Record<string, unknown> = {};

    for (const field of fields) {
      const raw = body[field.name];

      if (field.type === 'BOOLEAN') {
        formResponse[field.name] =
          raw === true ||
          raw === 'true' ||
          raw === 'on' ||
          raw === '1' ||
          raw === 1;
      } else if (field.type === 'NUMBER' && raw !== undefined && raw !== '') {
        formResponse[field.name] = Number(raw);
      } else {
        formResponse[field.name] = raw;
      }
    }

    await this.applyDecision({
      decisionToken: token,
      response: formResponse,
      decision: 'approve',
    });

    response
      .status(HttpStatus.OK)
      .send(
        '<html><body><h1>Submitted</h1><p>You can close this window.</p></body></html>',
      );
  }

  private async applyDecision(input: {
    decisionToken: string;
    decision?: 'approve' | 'reject';
    fieldName?: string;
    value?: boolean | string | number;
    response?: Record<string, unknown>;
  }) {
    const parts = verifyWorkflowFormDecisionPointer(input.decisionToken);

    if (!parts) {
      throw new HttpException('Invalid decision token', HttpStatus.NOT_FOUND);
    }

    const { fields, stepStatus } =
      await this.workflowFormDecisionPointerService.getPendingFormFields(parts);

    if (
      !this.workflowFormDecisionPointerService.isStepStillPending(stepStatus)
    ) {
      return { status: 'ok', idempotent: true };
    }

    const claimed =
      await this.workflowFormDecisionPointerService.tryMarkPointerUsed(
        input.decisionToken,
      );

    if (!claimed) {
      return { status: 'ok', idempotent: true };
    }

    let formResponse: Record<string, unknown> = {
      ...(input.response ?? {}),
    };

    if (Object.keys(formResponse).length === 0) {
      const booleanField =
        input.fieldName ??
        fields.find((field) => field.type === 'BOOLEAN')?.name;

      if (!booleanField) {
        throw new HttpException(
          'No boolean field to map decision onto',
          HttpStatus.BAD_REQUEST,
        );
      }

      const approved =
        input.decision === 'approve' ||
        input.value === true ||
        input.value === 'true';

      formResponse = { [booleanField]: approved };
    }

    const capturedTest =
      await this.workflowFormDecisionPointerService.tryCompleteFormNotifyTestSession(
        {
          parts,
          response: formResponse,
        },
      );

    if (capturedTest) {
      return { status: 'ok', response: formResponse };
    }

    try {
      await this.getWorkflowRunner().submitFormStep({
        workspaceId: parts.workspaceId,
        workflowRunId: parts.workflowRunId,
        stepId: parts.stepId,
        response: formResponse,
      });
    } catch (error) {
      this.logger.error('submitFormStep after approval failed', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to resume workflow',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return { status: 'ok', response: formResponse };
  }
}

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};
