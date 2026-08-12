import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { FacebookWhatsappWorkflowFormFlowService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/facebook-whatsapp-workflow-form-flow.service';
import { FacebookWhatsappWorkflowFormTemplateService } from 'src/engine/core-modules/arx-chat/services/workflow-approval/facebook-whatsapp-workflow-form-template.service';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';

@Controller('workflow-form-whatsapp')
@UseGuards(JwtAuthGuard)
export class WorkflowFormWhatsappController {
  private readonly logger = new Logger(WorkflowFormWhatsappController.name);

  constructor(
    private readonly facebookWhatsappWorkflowFormTemplateService: FacebookWhatsappWorkflowFormTemplateService,
    private readonly facebookWhatsappWorkflowFormFlowService: FacebookWhatsappWorkflowFormFlowService,
  ) {}

  @Get('message-templates')
  async listMessageTemplates() {
    try {
      const templates =
        await this.facebookWhatsappWorkflowFormTemplateService.listMessageTemplates();

      return { templates };
    } catch (error) {
      this.logger.error('Failed to list message templates', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to list templates',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Get('message-templates/:name')
  async getMessageTemplateByName(@Param('name') name: string) {
    try {
      const template =
        await this.facebookWhatsappWorkflowFormTemplateService.getMessageTemplateByName(
          name,
        );

      if (!template) {
        throw new HttpException(
          `Template not found: ${name}`,
          HttpStatus.NOT_FOUND,
        );
      }

      return { template };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to get message template ${name}`, error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to get template',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('message-templates')
  async createMessageTemplate(@Body() body: Record<string, unknown>) {
    try {
      const result =
        await this.facebookWhatsappWorkflowFormTemplateService.createMessageTemplate(
          body,
        );

      return { status: 'created', data: result };
    } catch (error) {
      this.logger.error('Failed to create message template', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to create template',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('workflow-form-templates/ensure')
  async ensureRegistryTemplates() {
    try {
      const results =
        await this.facebookWhatsappWorkflowFormTemplateService.ensureRegistryTemplates();

      return { status: 'ok', results };
    } catch (error) {
      this.logger.error('Failed to ensure registry templates', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to ensure templates',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('workflow-form-templates/sync-bodies')
  async syncRegistryTemplateBodies() {
    try {
      const results =
        await this.facebookWhatsappWorkflowFormTemplateService.syncRegistryTemplateBodies();

      return { status: 'ok', results };
    } catch (error) {
      this.logger.error('Failed to sync template bodies', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to sync templates',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Get('flows')
  async listFlows() {
    try {
      const flows =
        await this.facebookWhatsappWorkflowFormFlowService.listFlows();

      return { flows };
    } catch (error) {
      this.logger.error('Failed to list Flows', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to list Flows',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('flows/ensure')
  async ensureFlows(@Body() body?: { forceUpdate?: boolean }) {
    try {
      const results =
        await this.facebookWhatsappWorkflowFormFlowService.ensureRegistryFlows(
          { forceUpdate: body?.forceUpdate === true },
        );

      return { status: 'ok', results };
    } catch (error) {
      this.logger.error('Failed to ensure Flows', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to ensure Flows',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('workflow-form-flow-templates/ensure')
  async ensureFlowTemplates() {
    try {
      const results =
        await this.facebookWhatsappWorkflowFormTemplateService.ensureRegistryFlowTemplates();

      return { status: 'ok', results };
    } catch (error) {
      this.logger.error('Failed to ensure FLOW templates', error);
      throw new HttpException(
        error instanceof Error
          ? error.message
          : 'Failed to ensure FLOW templates',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('message-templates/send')
  async sendMessageTemplate(
    @Body()
    body: {
      to: string;
      registryName: string;
      contextText: string;
      detailsText?: string;
      token: string;
      formFields?: Array<{
        name: string;
        type: string;
        label?: string;
        settings?: Record<string, unknown>;
      }>;
    },
  ) {
    if (!body?.to || !body?.registryName || !body?.contextText || !body?.token) {
      throw new HttpException(
        'Body requires to, registryName, contextText, and token',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result =
        await this.facebookWhatsappWorkflowFormTemplateService.sendWorkflowFormTemplate(
          {
            to: body.to,
            registryName: body.registryName,
            contextText: body.contextText,
            detailsText: body.detailsText,
            token: body.token,
            formFields: body.formFields,
          },
        );

      return result;
    } catch (error) {
      this.logger.error('Failed to send workflow form template', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to send template',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
