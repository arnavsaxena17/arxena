import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationModule } from 'src/engine/core-modules/application/application.module';
import { UnipilePoolModule } from 'src/engine/core-modules/arx-chat/unipile-pool.module';
import { FeatureFlagModule } from 'src/engine/core-modules/feature-flag/feature-flag.module';
import { FileEntity } from 'src/engine/core-modules/file/entities/file.entity';
import { FileModule } from 'src/engine/core-modules/file/file.module';
import { OutreachCommandModule } from 'src/engine/core-modules/outreach-command/outreach-command.module';
import { JwtModule } from 'src/engine/core-modules/jwt/jwt.module';
import { BrightDataModule } from 'src/engine/core-modules/bright-data/bright-data.module';
import { BrightDataLudicrousModule } from 'src/engine/core-modules/bright-data-ludicrous/bright-data-ludicrous.module';
import { LocalBusinessDataModule } from 'src/engine/core-modules/local-business-data/local-business-data.module';
import { OrgChartModule } from 'src/engine/core-modules/org-chart/org-chart.module';
import { SecureHttpClientModule } from 'src/engine/core-modules/secure-http-client/secure-http-client.module';
import { CreateCalendarEventTool } from 'src/engine/core-modules/tool/tools/calendar-tool/create-calendar-event-tool';
import { CodeInterpreterTool } from 'src/engine/core-modules/tool/tools/code-interpreter-tool/code-interpreter-tool';
import { DraftEmailTool } from 'src/engine/core-modules/tool/tools/email-tool/draft-email-tool';
import { EmailComposerService } from 'src/engine/core-modules/tool/tools/email-tool/email-composer.service';
import { SendEmailTool } from 'src/engine/core-modules/tool/tools/email-tool/send-email-tool';
import {
  GetOutreachWorkingSetTool,
  PreviewOutreachAiColumnTool,
  GetOutreachAiColumnRunStatusTool,
  CancelOutreachAiColumnRunTool,
  GenerateOutreachTableViewTool,
  ApplyOutreachTableViewTool,
  RunOutreachAiColumnTool,
} from 'src/engine/core-modules/tool/tools/outreach-ai-column-tool/outreach-ai-column-tools';
import { UpsertOutreachTargetCompaniesTool } from 'src/engine/core-modules/tool/tools/outreach-target-companies-tool/upsert-outreach-target-companies-tool';
import { SaveOutreachTargetsToCrmTool } from 'src/engine/core-modules/tool/tools/outreach-save-to-crm-tool/save-outreach-targets-to-crm-tool';
import { StartOutreachTool } from 'src/engine/core-modules/tool/tools/outreach-start-tool/start-outreach-tool';
import { UpsertOutreachTargetPeopleTool } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/upsert-outreach-target-people-tool';
import { PreviewSampleMessageColumnTool } from 'src/engine/core-modules/tool/tools/outreach-sample-message-tool/preview-sample-message-column-tool';
import { OUTREACH_SAMPLE_MESSAGE_DRAFTER } from 'src/engine/core-modules/outreach-command/types/outreach-sample-message.types';
import { OutreachSampleMessageService } from 'src/engine/core-modules/tool/tools/outreach-sample-message-tool/outreach-sample-message.service';
import { AgentEntity } from 'src/engine/metadata-modules/ai/ai-agent/entities/agent.entity';
import { HttpTool } from 'src/engine/core-modules/tool/tools/http-tool/http-tool';
import { GetLocalBusinessDetailsTool } from 'src/engine/core-modules/tool/tools/local-business-data-tool/get-local-business-details-tool';
import { SearchBrightDataBusinessTool } from 'src/engine/core-modules/tool/tools/bright-data-business-search-tool/search-bright-data-business-tool';
import { SearchLocalBusinessesTool } from 'src/engine/core-modules/tool/tools/local-business-data-tool/search-local-businesses-tool';
import { ResolveCompanyFromRawNameTool } from 'src/engine/core-modules/tool/tools/company-name-resolver-tool/resolve-company-from-raw-name-tool';
import { NavigateAppTool } from 'src/engine/core-modules/tool/tools/navigate-tool/navigate-app-tool';
import { HighlightOrgChartTool } from 'src/engine/core-modules/tool/tools/highlight-org-chart-tool/highlight-org-chart-tool';
import { ExtractJsonPathsTool } from 'src/engine/core-modules/tool/tools/output-navigation-tool/extract-json-paths-tool';
import { SearchOutputTool } from 'src/engine/core-modules/tool/tools/output-navigation-tool/search-output-tool';
import { SearchHelpCenterTool } from 'src/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool';
import { SendFilesTool } from 'src/engine/core-modules/tool/tools/send-files-tool/send-files-tool';
import { CommentOnLinkedinPostTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/comment-on-linkedin-post-tool';
import { FetchLinkedinActivityTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/fetch-linkedin-activity-tool';
import { FollowLinkedinProfileTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/follow-linkedin-profile-tool';
import { LikeLinkedinPostTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/like-linkedin-post-tool';
import { SendLinkedinConnectionRequestTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-connection-request-tool';
import { SendLinkedinInmailTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-inmail-tool';
import { SendLinkedinMessageTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-message-tool';
import { SendLinkedinVoiceNoteTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-linkedin-voice-note-tool';
import { SendWhatsappMessageTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/send-whatsapp-message-tool';
import { ViewLinkedinProfileTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/view-linkedin-profile-tool';
import { AcceptLinkedinReceivedInvitationTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/accept-linkedin-received-invitation-tool';
import { ToolOutputSpillService } from 'src/engine/core-modules/tool/services/tool-output-spill.service';
import { WorkspaceManyOrAllFlatEntityMapsCacheModule } from 'src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.module';
import { ConnectedAccountEntity } from 'src/engine/metadata-modules/connected-account/entities/connected-account.entity';
import { NavigationMenuItemModule } from 'src/engine/metadata-modules/navigation-menu-item/navigation-menu-item.module';
import { ObjectMetadataModule } from 'src/engine/metadata-modules/object-metadata/object-metadata.module';
import { ViewModule } from 'src/engine/metadata-modules/view/view.module';
import { CalendarEventCreationManagerModule } from 'src/modules/calendar/calendar-event-creation-manager/calendar-event-creation-manager.module';
import { MessagingImportManagerModule } from 'src/modules/messaging/message-import-manager/messaging-import-manager.module';
import { MessagingSendManagerModule } from 'src/modules/messaging/message-outbound-manager/messaging-send-manager.module';
import { provideWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/provide-workspace-scoped-repository';
@Module({
  imports: [
    MessagingImportManagerModule,
    MessagingSendManagerModule,
    CalendarEventCreationManagerModule,
    TypeOrmModule.forFeature([FileEntity, ConnectedAccountEntity, AgentEntity]),
    ApplicationModule,
    FeatureFlagModule,
    FileModule,
    JwtModule,
    SecureHttpClientModule,
    ObjectMetadataModule,
    ViewModule,
    NavigationMenuItemModule,
    WorkspaceManyOrAllFlatEntityMapsCacheModule,
    UnipilePoolModule,
    forwardRef(() => BrightDataModule),
    forwardRef(() => BrightDataLudicrousModule),
    LocalBusinessDataModule,
    OrgChartModule,
    // WorkflowRunner → executor actions → ToolModule → OutreachCommand (cycle)
    forwardRef(() => OutreachCommandModule),
  ],
  providers: [
    HttpTool,
    SendEmailTool,
    DraftEmailTool,
    CreateCalendarEventTool,
    SendLinkedinConnectionRequestTool,
    SendLinkedinInmailTool,
    SendLinkedinMessageTool,
    FetchLinkedinActivityTool,
    CommentOnLinkedinPostTool,
    SendLinkedinVoiceNoteTool,
    ViewLinkedinProfileTool,
    FollowLinkedinProfileTool,
    LikeLinkedinPostTool,
    AcceptLinkedinReceivedInvitationTool,
    SendWhatsappMessageTool,
    SearchLocalBusinessesTool,
    SearchBrightDataBusinessTool,
    GetLocalBusinessDetailsTool,
    ResolveCompanyFromRawNameTool,
    EmailComposerService,
    SearchHelpCenterTool,
    CodeInterpreterTool,
    SendFilesTool,
    NavigateAppTool,
    HighlightOrgChartTool,
    UpsertOutreachTargetCompaniesTool,
    UpsertOutreachTargetPeopleTool,
    SaveOutreachTargetsToCrmTool,
    StartOutreachTool,
    GetOutreachWorkingSetTool,
    PreviewOutreachAiColumnTool,
    RunOutreachAiColumnTool,
    GetOutreachAiColumnRunStatusTool,
    CancelOutreachAiColumnRunTool,
    GenerateOutreachTableViewTool,
    ApplyOutreachTableViewTool,
    PreviewSampleMessageColumnTool,
    ExtractJsonPathsTool,
    SearchOutputTool,
    ToolOutputSpillService,
    OutreachSampleMessageService,
    {
      provide: OUTREACH_SAMPLE_MESSAGE_DRAFTER,
      useExisting: OutreachSampleMessageService,
    },
    provideWorkspaceScopedRepository(FileEntity),
    provideWorkspaceScopedRepository(AgentEntity),
  ],
  exports: [
    HttpTool,
    SendEmailTool,
    DraftEmailTool,
    CreateCalendarEventTool,
    SendLinkedinConnectionRequestTool,
    SendLinkedinInmailTool,
    SendLinkedinMessageTool,
    FetchLinkedinActivityTool,
    CommentOnLinkedinPostTool,
    SendLinkedinVoiceNoteTool,
    ViewLinkedinProfileTool,
    FollowLinkedinProfileTool,
    LikeLinkedinPostTool,
    AcceptLinkedinReceivedInvitationTool,
    SendWhatsappMessageTool,
    SearchLocalBusinessesTool,
    SearchBrightDataBusinessTool,
    GetLocalBusinessDetailsTool,
    ResolveCompanyFromRawNameTool,
    EmailComposerService,
    SearchHelpCenterTool,
    CodeInterpreterTool,
    SendFilesTool,
    NavigateAppTool,
    HighlightOrgChartTool,
    UpsertOutreachTargetCompaniesTool,
    UpsertOutreachTargetPeopleTool,
    SaveOutreachTargetsToCrmTool,
    StartOutreachTool,
    GetOutreachWorkingSetTool,
    PreviewOutreachAiColumnTool,
    RunOutreachAiColumnTool,
    GetOutreachAiColumnRunStatusTool,
    CancelOutreachAiColumnRunTool,
    GenerateOutreachTableViewTool,
    ApplyOutreachTableViewTool,
    PreviewSampleMessageColumnTool,
    ExtractJsonPathsTool,
    SearchOutputTool,
    ToolOutputSpillService,
  ],
})
export class ToolModule {}
