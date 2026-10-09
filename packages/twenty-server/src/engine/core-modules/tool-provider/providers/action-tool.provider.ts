import { Injectable } from '@nestjs/common';

import { PermissionFlagType } from 'twenty-shared/constants';
import { isDefined } from 'twenty-shared/utils';
import { z } from 'zod';

import {
  ACTION_TOOL_LABELS,
  type ActionToolId,
} from 'src/engine/core-modules/tool-provider/constants/action-tool-label.constant';
import { I18nService } from 'src/engine/core-modules/i18n/i18n.service';
import { type GenerateDescriptorOptions } from 'src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type';
import { type ToolProvider } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider.interface';
import { type ToolProviderContext } from 'src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ActionToolLabel } from 'src/engine/core-modules/tool-provider/types/action-tool-label.type';
import { translateToolLabel } from 'src/engine/core-modules/tool-provider/utils/translate-tool-label.util';
import { humanizeToolName } from 'src/engine/core-modules/tool-provider/utils/tool-set-to-descriptors.util';

import { ToolCategory } from 'twenty-shared/ai';
import { toToolJsonSchema } from 'src/engine/core-modules/record-crud/utils/to-tool-json-schema.util';
import { type ToolDescriptor } from 'src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type ToolIndexEntry } from 'src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { CodeInterpreterService } from 'src/engine/core-modules/code-interpreter/code-interpreter.service';
import { CreateCalendarEventTool } from 'src/engine/core-modules/tool/tools/calendar-tool/create-calendar-event-tool';
import { CodeInterpreterTool } from 'src/engine/core-modules/tool/tools/code-interpreter-tool/code-interpreter-tool';
import { DraftEmailTool } from 'src/engine/core-modules/tool/tools/email-tool/draft-email-tool';
import { SendEmailTool } from 'src/engine/core-modules/tool/tools/email-tool/send-email-tool';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import {
  GetOutreachWorkingSetTool,
  PreviewOutreachAiColumnTool,
  GetOutreachAiColumnRunStatusTool,
  CancelOutreachAiColumnRunTool,
  GenerateOutreachTableViewTool,
  ApplyOutreachTableViewTool,
  RunOutreachAiColumnTool,
} from 'src/engine/core-modules/tool/tools/outreach-ai-column-tool/outreach-ai-column-tools';
import { PreviewSampleMessageColumnTool } from 'src/engine/core-modules/tool/tools/outreach-sample-message-tool/preview-sample-message-column-tool';
import { UpsertOutreachTargetCompaniesTool } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';
import { SaveOutreachTargetsToCrmTool } from 'src/engine/core-modules/tool/tools/outreach-save-to-crm-tool/save-outreach-targets-to-crm-tool';
import { StartOutreachTool } from 'src/engine/core-modules/tool/tools/outreach-start-tool/start-outreach-tool';
import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';
import { NavigateAppTool } from 'src/engine/core-modules/tool/tools/navigate-tool/navigate-app-tool';
import { HighlightOrgChartTool } from 'src/engine/core-modules/tool/tools/highlight-org-chart-tool/highlight-org-chart-tool';
import { ExtractJsonPathsTool } from 'src/engine/core-modules/tool/tools/output-navigation-tool/extract-json-paths-tool';
import { SearchOutputTool } from 'src/engine/core-modules/tool/tools/output-navigation-tool/search-output-tool';
import { SearchHelpCenterTool } from 'src/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool';
import { SendFilesTool } from 'src/engine/core-modules/tool/tools/send-files-tool/send-files-tool';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';
import { type Tool } from 'src/engine/core-modules/tool/types/tool.type';
import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';

@Injectable()
export class ActionToolProvider implements ToolProvider {
  readonly category = ToolCategory.ACTION;

  private readonly toolMap: Map<string, Tool>;

  constructor(
    private readonly httpTool: HttpTool,
    private readonly sendEmailTool: SendEmailTool,
    private readonly draftEmailTool: DraftEmailTool,
    private readonly createCalendarEventTool: CreateCalendarEventTool,
    private readonly searchHelpCenterTool: SearchHelpCenterTool,
    private readonly codeInterpreterTool: CodeInterpreterTool,
    private readonly sendFilesTool: SendFilesTool,
    private readonly navigateAppTool: NavigateAppTool,
    private readonly highlightOrgChartTool: HighlightOrgChartTool,
    private readonly upsertOutreachTargetCompaniesTool: UpsertOutreachTargetCompaniesTool,
    private readonly upsertOutreachTargetPeopleTool: UpsertOutreachTargetPeopleTool,
    private readonly saveOutreachTargetsToCrmTool: SaveOutreachTargetsToCrmTool,
    private readonly startOutreachTool: StartOutreachTool,
    private readonly getOutreachWorkingSetTool: GetOutreachWorkingSetTool,
    private readonly previewOutreachAiColumnTool: PreviewOutreachAiColumnTool,
    private readonly runOutreachAiColumnTool: RunOutreachAiColumnTool,
    private readonly getOutreachAiColumnRunStatusTool: GetOutreachAiColumnRunStatusTool,
    private readonly cancelOutreachAiColumnRunTool: CancelOutreachAiColumnRunTool,
    private readonly previewSampleMessageColumnTool: PreviewSampleMessageColumnTool,
    private readonly generateOutreachTableViewTool: GenerateOutreachTableViewTool,
    private readonly applyOutreachTableViewTool: ApplyOutreachTableViewTool,
    private readonly extractJsonPathsTool: ExtractJsonPathsTool,
    private readonly searchOutputTool: SearchOutputTool,
    private readonly codeInterpreterService: CodeInterpreterService,
    private readonly permissionsService: PermissionsService,
    private readonly i18nService: I18nService,
  ) {
    this.toolMap = new Map<string, Tool>([
      ['http_request', this.httpTool],
      ['send_email', this.sendEmailTool],
      ['draft_email', this.draftEmailTool],
      ['create_calendar_event', this.createCalendarEventTool],
      ['search_help_center', this.searchHelpCenterTool],
      ['code_interpreter', this.codeInterpreterTool],
      ['send_files', this.sendFilesTool],
      ['navigate_app', this.navigateAppTool],
      ['highlight_org_chart', this.highlightOrgChartTool],
      [
        'upsert_outreach_target_companies',
        this.upsertOutreachTargetCompaniesTool,
      ],
      ['upsert_outreach_target_people', this.upsertOutreachTargetPeopleTool],
      [
        'save_outreach_targets_to_crm',
        this.saveOutreachTargetsToCrmTool,
      ],
      ['start_outreach', this.startOutreachTool],
      ['get_outreach_working_set', this.getOutreachWorkingSetTool],
      ['preview_ai_column', this.previewOutreachAiColumnTool],
      ['run_ai_column', this.runOutreachAiColumnTool],
      ['get_ai_column_run_status', this.getOutreachAiColumnRunStatusTool],
      ['cancel_ai_column_run', this.cancelOutreachAiColumnRunTool],
      ['preview_sample_message_column', this.previewSampleMessageColumnTool],
      ['generate_table_view', this.generateOutreachTableViewTool],
      ['apply_table_view', this.applyOutreachTableViewTool],
      ['extract_json_paths', this.extractJsonPathsTool],
      ['search_output', this.searchOutputTool],
    ]);
  }

  async isAvailable(_context: ToolProviderContext): Promise<boolean> {
    return true;
  }

  async generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]> {
    const includeSchemas = options?.includeSchemas ?? true;
    const descriptors: (ToolIndexEntry | ToolDescriptor)[] = [];

    const hasHttpPermission = await this.permissionsService.hasToolPermission(
      context.rolePermissionConfig,
      context.workspaceId,
      PermissionFlagType.HTTP_REQUEST_TOOL,
    );

    if (hasHttpPermission) {
      descriptors.push(
        this.buildDescriptor(
          'http_request',
          this.httpTool,
          includeSchemas,
          context.locale,
        ),
      );
    }

    const hasEmailPermission = await this.permissionsService.hasToolPermission(
      context.rolePermissionConfig,
      context.workspaceId,
      PermissionFlagType.SEND_EMAIL_TOOL,
    );

    if (hasEmailPermission) {
      descriptors.push(
        this.buildDescriptor(
          'send_email',
          this.sendEmailTool,
          includeSchemas,
          context.locale,
        ),
      );
      descriptors.push(
        this.buildDescriptor(
          'draft_email',
          this.draftEmailTool,
          includeSchemas,
          context.locale,
        ),
      );
    }

    const hasCreateCalendarEventPermission =
      await this.permissionsService.hasToolPermission(
        context.rolePermissionConfig,
        context.workspaceId,
        PermissionFlagType.CREATE_CALENDAR_EVENT_TOOL,
      );

    if (hasCreateCalendarEventPermission) {
      descriptors.push(
        this.buildDescriptor(
          'create_calendar_event',
          this.createCalendarEventTool,
          includeSchemas,
          context.locale,
        ),
      );
    }

    descriptors.push(
      this.buildDescriptor(
        'search_help_center',
        this.searchHelpCenterTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'navigate_app',
        this.navigateAppTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'highlight_org_chart',
        this.highlightOrgChartTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'upsert_outreach_target_companies',
        this.upsertOutreachTargetCompaniesTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'upsert_outreach_target_people',
        this.upsertOutreachTargetPeopleTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'save_outreach_targets_to_crm',
        this.saveOutreachTargetsToCrmTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'start_outreach',
        this.startOutreachTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'get_outreach_working_set',
        this.getOutreachWorkingSetTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'preview_sample_message_column',
        this.previewSampleMessageColumnTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'preview_ai_column',
        this.previewOutreachAiColumnTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'run_ai_column',
        this.runOutreachAiColumnTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'get_ai_column_run_status',
        this.getOutreachAiColumnRunStatusTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'cancel_ai_column_run',
        this.cancelOutreachAiColumnRunTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'generate_table_view',
        this.generateOutreachTableViewTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'apply_table_view',
        this.applyOutreachTableViewTool,
        includeSchemas,
        context.locale,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'extract_json_paths',
        this.extractJsonPathsTool,
        includeSchemas,
      ),
    );

    descriptors.push(
      this.buildDescriptor(
        'search_output',
        this.searchOutputTool,
        includeSchemas,
      ),
    );

    const hasCodeInterpreterPermission =
      this.codeInterpreterService.isEnabled() &&
      (await this.permissionsService.hasToolPermission(
        context.rolePermissionConfig,
        context.workspaceId,
        PermissionFlagType.CODE_INTERPRETER_TOOL,
      ));

    if (hasCodeInterpreterPermission) {
      descriptors.push(
        this.buildDescriptor(
          'code_interpreter',
          this.codeInterpreterTool,
          includeSchemas,
          context.locale,
        ),
      );
    }

    const hasSendFilesPermission =
      await this.permissionsService.hasToolPermission(
        context.rolePermissionConfig,
        context.workspaceId,
        PermissionFlagType.SEND_FILES_TOOL,
      );

    if (hasSendFilesPermission) {
      descriptors.push(
        this.buildDescriptor(
          'send_files',
          this.sendFilesTool,
          includeSchemas,
          context.locale,
        ),
      );
    }

    return descriptors;
  }

  async executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput> {
    const tool = this.toolMap.get(toolName);

    if (!tool) {
      throw new Error(
        `Unknown action tool "${toolName}" (category: ${this.category})`,
      );
    }

    return tool.execute(args, {
      workspaceId: context.workspaceId,
      userId: context.userId,
      userWorkspaceId: context.userWorkspaceId,
      threadId: context.threadId,
      onCodeExecutionUpdate: context.onCodeExecutionUpdate,
      toolConfigs: context.toolConfigs,
    });
  }

  private buildDescriptor(
    toolId: string,
    tool: Tool,
    includeSchemas: boolean,
    locale?: ToolProviderContext['locale'],
  ): ToolIndexEntry | ToolDescriptor {
    const labels: ActionToolLabel | undefined =
      ACTION_TOOL_LABELS[toolId as ActionToolId];

    return {
      name: toolId,
      label: isDefined(labels)
        ? translateToolLabel(labels.label, this.i18nService, locale)
        : humanizeToolName(toolId),
      description: tool.description,
      category: ToolCategory.ACTION,
      icon: 'IconPlayerPlay',
      ...(includeSchemas && {
        inputSchema: toToolJsonSchema(tool.inputSchema as z.ZodType),
      }),
      executionRef: { kind: 'static', toolId },
    };
  }
}
