import { Injectable, Logger } from '@nestjs/common';
import { UnipileAttachmentStorageService } from 'src/engine/core-modules/unipile-attachments/services/unipile-attachment-storage.service';
import { graphQlToFetchWhatsappMessages, graphqlToUpdateWhatsappMessageId } from 'twenty-shared';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { InjectMessageQueue } from '../../message-queue/decorators/message-queue.decorator';
import { MessageQueue } from '../../message-queue/message-queue.constants';
import { MessageQueueService } from '../../message-queue/services/message-queue.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import {
  UNIPILE_WEBHOOK_PROCESSOR_NAME,
  type UnipileWebhookJobData,
  type UnipileWebhookJobKind,
} from '../types/unipile-webhook-job.types';
import type {
    CreateWebhookDto,
    UnipileAccountStatusWebhook,
    UnipileEmailWebhook,
    UnipileMessageWebhook,
    UnipileNewRelationWebhook,
    UnipileTrackingEmailWebhook,
    UnipileWebhookAttachment,
    UnipileWebhookPayload,
} from '../types/unipile-webhook.types';
import { UnipileAttachmentStorageUtil } from '../utils/unipile-attachment-storage.util';
import { UnipileAccountPoolService } from './unipile-account-pool.service';
import { IncomingWhatsappMessages } from './whatsapp-api/incoming-messages';
import { WorkspaceMemberProfileUnipileService } from './workspace-member-profile-unipile.service';

@Injectable()
export class UnipileWebhookService {
  private readonly logger = new Logger(UnipileWebhookService.name);
  private readonly attachmentStorage: UnipileAttachmentStorageUtil;

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly unipileAccountPoolService: UnipileAccountPoolService,
    private readonly workspaceMemberProfileUnipileService: WorkspaceMemberProfileUnipileService,
    private readonly unipileAttachmentStorageService: UnipileAttachmentStorageService,
    @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue) private readonly messageQueueService?: MessageQueueService,
    @InjectMessageQueue(MessageQueue.unipileWebhookQueue)
    private readonly unipileWebhookQueueService?: MessageQueueService,
  ) {
    this.attachmentStorage = new UnipileAttachmentStorageUtil();
  }

  /**
   * Enqueue webhook for async processing with limited BullMQ concurrency.
   * HTTP handlers should return 200 after this succeeds so Unipile does not retry bursts.
   */
  async enqueueWebhook(
    kind: UnipileWebhookJobKind,
    payload: UnipileWebhookPayload | UnipileNewRelationWebhook,
  ): Promise<void> {
    if (!this.unipileWebhookQueueService) {
      this.logger.warn(
        'Unipile webhook queue unavailable, processing webhook synchronously',
      );
      if (kind === 'relations') {
        await this.processNewRelationWebhook(payload as UnipileNewRelationWebhook);
        return;
      }
      await this.processWebhook(payload);
      return;
    }

    const receivedAt = new Date().toISOString();
    const jobData: UnipileWebhookJobData = {
      kind,
      payload,
      receivedAt,
    };

    await this.unipileWebhookQueueService.add<UnipileWebhookJobData>(
      UNIPILE_WEBHOOK_PROCESSOR_NAME,
      jobData,
      {
        id: this.buildWebhookProjectId(kind, payload, receivedAt),
        retryLimit: 3,
      },
    );

    this.logger.log(
      `Queued Unipile webhook kind=${kind} event=${this.getPayloadEventLabel(payload, kind)} receivedAt=${receivedAt}`,
    );
  }

  private getPayloadEventLabel(
    payload: UnipileWebhookPayload | UnipileNewRelationWebhook,
    kind: UnipileWebhookJobKind,
  ): string {
    if ('event' in payload) {
      return payload.event;
    }

    if ('AccountStatus' in payload) {
      return 'account_status';
    }

    return kind;
  }

  private buildWebhookProjectId(
    kind: UnipileWebhookJobKind,
    payload: UnipileWebhookPayload | UnipileNewRelationWebhook,
    receivedAt: string,
  ): string {
    if ('message_id' in payload && payload.message_id) {
      const event =
        'event' in payload && payload.event ? payload.event : 'message';
      return `unipile-${kind}-${event}-${payload.message_id}`;
    }

    if ('AccountStatus' in payload) {
      const accountStatus = payload.AccountStatus;
      return `unipile-account-${accountStatus.account_id}-${accountStatus.message}-${receivedAt}`;
    }

    if ('event' in payload && payload.event === 'new_relation') {
      const relationPayload = payload as UnipileNewRelationWebhook;
      const providerId =
        relationPayload.user_provider_id ??
        relationPayload.user_public_identifier ??
        relationPayload.relation?.profile_url ??
        'unknown';
      return `unipile-${kind}-new_relation-${relationPayload.account_id}-${providerId}-${receivedAt}`;
    }

    const accountId =
      'account_id' in payload && payload.account_id
        ? payload.account_id
        : 'unknown';
    return `unipile-${kind}-${accountId}-${receivedAt}`;
  }

  /**
   * Process incoming webhook payload and route to appropriate handler
   */
  async processWebhook(payload: UnipileWebhookPayload): Promise<void> {
    // this.logger.log('Processing Unipile webhook:', JSON.stringify(payload, null, 2));

    try {
      // Route to appropriate handler based on payload structure
      if ('AccountStatus' in payload) {
        await this.handleAccountStatusWebhook(payload as UnipileAccountStatusWebhook);
      } else if ('event' in payload) {
        const eventPayload = payload as UnipileMessageWebhook | UnipileEmailWebhook | UnipileTrackingEmailWebhook | UnipileNewRelationWebhook;
        
        switch (eventPayload.event) {
          case 'message_received':
          case 'message_reaction':
          case 'message_read':
          case 'message_edited':
          case 'message_deleted':
          case 'message_delivered':
            await this.handleMessageWebhook(eventPayload as UnipileMessageWebhook);
            break;
          
          case 'email_received':
          case 'email_sent':
          case 'email_read':
            await this.handleEmailWebhook(eventPayload as UnipileEmailWebhook);
            break;
          
          case 'email_opened':
          case 'email_clicked':
            await this.handleTrackingEmailWebhook(eventPayload as UnipileTrackingEmailWebhook);
            break;
          
          case 'new_relation':
            await this.handleNewRelationWebhook(eventPayload as UnipileNewRelationWebhook);
            break;
          
          default:
            this.logger.warn(`Unknown webhook event type: ${(eventPayload as any).event}`);
        }
      } else {
        this.logger.warn('Unknown webhook payload structure:', payload);
      }
    } catch (error) {
      this.logger.error('Error processing webhook:', error);
      throw error;
    }
  }

  /**
   * Validate webhook authentication
   */
  validateWebhookAuth(authHeader: string): boolean {
    const expectedAuth = process.env.UNIPILE_WEBHOOK_SECRET;
    
    if (!expectedAuth) {
      this.logger.warn('UNIPILE_WEBHOOK_SECRET not configured, skipping authentication');
      return true;
    }

    if (!authHeader) {
      this.logger.warn('No authentication header provided');
      return false;
    }

    const isValid = authHeader === expectedAuth;
    if (!isValid) {
      this.logger.warn('Invalid webhook authentication');
    }

    return isValid;
  }

  /**
   * Create webhook configuration for Unipile API
   */
  createWebhookConfig(config: CreateWebhookDto): {
    request_url: string;
    source: string;
    headers: Array<{ key: string; value: string }>;
  } {
    // Use the configured webhook URL or generate one based on the server URL
    const webhookUrl = config.request_url || `${process.env.SERVER_URL}/linkedin-unipile/webhook`;
    
    // Default headers for webhook authentication and content type
    const defaultHeaders = [
      {
        key: 'Content-Type',
        value: 'application/json',
      },
    ];

    // Add authentication header if webhook secret is configured
    if (process.env.UNIPILE_WEBHOOK_SECRET) {
      defaultHeaders.push({
        key: 'Unipile-Auth',
        value: process.env.UNIPILE_WEBHOOK_SECRET,
      });
    }

    return {
      request_url: webhookUrl,
      source: config.source,
      headers: config.headers || defaultHeaders,
    };
  }

  /**
   * Handle account status webhook
   */
  private async handleAccountStatusWebhook(payload: UnipileAccountStatusWebhook): Promise<void> {
    const { account_id, account_type, message: status, name } = payload.AccountStatus;
    
    this.logger.log(`Account status update: ${account_id} (${account_type}) - ${status} for name ${name}`);

    // TODO: Update account status in database
    // This would typically involve:
    // 1. Finding the connected account by account_id
    // 2. Updating the status in the database
    // 3. Triggering notifications if needed (e.g., for CREDENTIALS status)
    
    switch (status) {
      case 'OK':
        this.logger.log(`Account ${account_id} is working properly`);
        await this.onAccountStatusOK(account_id, account_type);
        break;
      
      case 'CREDENTIALS':
        this.logger.warn(`Account ${account_id} requires credential update for name ${name}`);
        await this.onAccountCredentialsRequired(account_id, account_type);
        break;
      
      case 'ERROR':
      case 'STOPPED':
        this.logger.error(`Account ${account_id} has stopped working: ${status} for name ${name}`);
        await this.onAccountError(account_id, account_type, status);
        break;
      
      case 'CREATION_SUCCESS':
      case 'RECONNECTED':
        this.logger.log(`Account ${account_id} successfully connected: ${status} for name ${name}`);
        await this.onAccountConnected(account_id, account_type, status, name);
        break;
      
      case 'SYNC_SUCCESS':
        this.logger.log(`Account ${account_id} synchronization completed for name ${name}`);
        await this.onAccountSyncCompleted(account_id, account_type);
        break;
      
      case 'CONNECTING':
        this.logger.log(`Account ${account_id} is attempting to connect for name ${name}`);
        await this.onAccountConnecting(account_id, account_type);
        break;
      
      case 'DELETED':
        this.logger.log(`Account ${account_id} has been deleted for name ${name}`);
        await this.onAccountDeleted(account_id, account_type);
        break;
      
      default:
        this.logger.warn(`Unknown account status: ${status} for account ${account_id}`);
    }
  }

  /**
   * Handle new message webhook
   */
  private async handleMessageWebhook(payload: UnipileMessageWebhook): Promise<void> {
    const { account_id, account_type, event, chat_id, message_id, message, sender, timestamp } = payload;

    if (event === 'message_received' && message?.trim()) {
      await this.attachmentStorage.cacheMessageContentForDeletionTracking(
        payload,
      );
    }

    // WhatsApp group chats: Unipile lists every participant in `attendees`; more than four means a group — skip logging and CRM processing.
    if (
      event === 'message_received' &&
      account_type === 'WHATSAPP' &&
      payload.attendees.length > 4
    ) {
      return;
    }

    this.logger.log(`Message event: ${event} in chat ${chat_id} from ${sender.attendee_name}`);

    // TODO: Process message based on event type
    // This would typically involve:
    // 1. Storing the message in the database
    // 2. Triggering real-time updates to connected clients
    // 3. Processing the message content for automated responses
    // 4. Updating chat/conversation status

    switch (event) {
      case 'message_received':
        // Check if message is from connected account or external contact
        const isFromConnectedUser = payload.account_info?.user_id === sender.attendee_provider_id;
        this.logger.log(`New message ${isFromConnectedUser ? 'sent' : 'received'}: "${message?.substring(0, 100)}..."`);
        
        await this.onMessageReceived(payload, isFromConnectedUser);
        break;
      
      case 'message_reaction':
        this.logger.log(`Message reaction: ${payload.reaction} on message ${message_id}`);
        await this.onMessageReaction(payload);
        break;
      
      case 'message_read':
        this.logger.log(`Message read: ${message_id}`);
        await this.onMessageRead(payload);
        break;
      
      case 'message_edited':
        this.logger.log(`Message edited: ${message_id}`);
        await this.onMessageEdited(payload);
        break;
      
      case 'message_deleted':
        this.logger.log(`Message deleted: ${message_id}`);
        await this.onMessageDeleted(payload);
        break;
      
      case 'message_delivered':
        this.logger.log(`Message delivered: ${message_id}`);
        await this.onMessageDelivered(payload);
        break;
    }
  }

  /**
   * Handle email webhook
   */
  private async handleEmailWebhook(payload: UnipileEmailWebhook): Promise<void> {
    const { account_id, account_type, event, email_id, subject, from, to } = payload;
    
    this.logger.log(`Email event: ${event} - "${subject}" from ${from} to ${to.join(', ')}`);

    // TODO: Process email based on event type
    // This would typically involve:
    // 1. Storing the email in the database
    // 2. Triggering notifications
    // 3. Processing email content for automation

    switch (event) {
      case 'email_received':
        this.logger.log(`New email received: ${email_id}`);
        await this.onEmailReceived(payload);
        break;
      
      case 'email_sent':
        this.logger.log(`Email sent: ${email_id}`);
        await this.onEmailSent(payload);
        break;
      
      case 'email_read':
        this.logger.log(`Email read: ${email_id}`);
        await this.onEmailRead(payload);
        break;
    }
  }

  /**
   * Handle tracking email webhook
   */
  private async handleTrackingEmailWebhook(payload: UnipileTrackingEmailWebhook): Promise<void> {
    const { account_id, event, email_id, tracking_data } = payload;
    
    this.logger.log(`Email tracking event: ${event} for email ${email_id}`);

    // TODO: Update email tracking data
    // This would typically involve:
    // 1. Recording the tracking event in the database
    // 2. Updating email analytics
    // 3. Triggering follow-up actions

    switch (event) {
      case 'email_opened':
        this.logger.log(`Email opened: ${email_id} from IP ${tracking_data.ip_address}`);
        await this.onEmailOpened(payload);
        break;
      
      case 'email_clicked':
        this.logger.log(`Email clicked: ${email_id}`);
        await this.onEmailClicked(payload);
        break;
    }
  }

  /**
   * Handle new relation webhook (LinkedIn connections)
   */
  private async handleNewRelationWebhook(payload: UnipileNewRelationWebhook): Promise<void> {
    const { account_id, relation } = payload;

    if (relation) {
      this.logger.log(`New LinkedIn relation (nested): ${relation.name} (${relation.status})`);
      switch (relation.status) {
        case 'pending':
          await this.onConnectionPending(payload);
          break;
        case 'accepted':
          await this.onConnectionAccepted(payload);
          break;
        case 'ignored':
          await this.onConnectionIgnored(payload);
          break;
      }
    } else {
      // Flat format from USERS webhook - always treat as accepted
      this.logger.log(`New LinkedIn relation (flat): ${payload.user_full_name} accepted invitation`);
      await this.onConnectionAccepted(payload);
    }
  }

  /**
   * Process new_relation webhook from dedicated /relations endpoint.
   * Treats acceptance as "Yes, I'm keen" and adds to database via receiveIncomingMessageFromLinkedinUnipile.
   */
  async processNewRelationWebhook(payload: UnipileNewRelationWebhook): Promise<void> {
    if (payload.event !== 'new_relation') {
      this.logger.warn(`Expected new_relation event, got: ${payload.event}`);
      return;
    }
    await this.handleNewRelationWebhook(payload);
  }

  // Account status event handlers (to be implemented by consumers)
  private async onAccountStatusOK(accountId: string, accountType: string): Promise<void> {
    // TODO: Implement account status OK handler
  }

  private async onAccountCredentialsRequired(accountId: string, accountType: string): Promise<void> {
    // TODO: Implement credentials required handler (send notifications, etc.)
  }

  private async onAccountError(accountId: string, accountType: string, error: string): Promise<void> {
    // TODO: Implement account error handler
  }

  private async onAccountConnected(
    accountId: string,
    accountType: string,
    status: string,
    name?: string,
  ): Promise<void> {
    const parsed = this.parseWebhookName(name);
    if (parsed.workspaceMemberId && parsed.workspaceId) {
      const poolType = accountType === 'LINKEDIN' ? 'LINKEDIN' : 'WHATSAPP';
      await this.unipileAccountPoolService.upsertPoolRecord(
        parsed.workspaceMemberId,
        parsed.workspaceId,
        accountId,
        poolType,
      );
      const type = accountType === 'LINKEDIN' ? 'linkedin' : 'whatsapp';
      const authToken = await this.getWorkspaceApiToken(parsed.workspaceId);
      if (authToken) {
        const accountPayload = await this.fetchUnipileAccountById(accountId);
        if (accountPayload) {
          await this.workspaceMemberProfileUnipileService.applyUnipileAccountToWorkspaceMemberProfile(
            parsed.workspaceMemberId,
            authToken,
            type,
            accountId,
            accountPayload,
          );
        } else {
          await this.workspaceMemberProfileUnipileService.updateWorkspaceMemberUnipileAccountId(
            parsed.workspaceMemberId,
            authToken,
            type,
            accountId,
          );
        }
      }
    } else if (parsed.workspaceId) {
      await this.workspaceQueryService.updateWorkspaceKeys(parsed.workspaceId, {
        [accountType === 'LINKEDIN' ? 'linkedin_unipile_account_id' : 'whatsapp_unipile_account_id']:
          accountId,
      });
    }
  }

  private parseWebhookName(name?: string): {
    workspaceMemberId?: string;
    workspaceId?: string;
  } {
    if (!name?.trim()) return {};
    const parts = name.split('|');
    if (parts.length >= 2) {
      return { workspaceMemberId: parts[0].trim(), workspaceId: parts[1].trim() };
    }
    return { workspaceId: name.trim() };
  }

  private async getWorkspaceApiToken(workspaceId: string): Promise<string | null> {
    try {
      const apiKeys = await this.workspaceQueryService.getApiKeys(
        workspaceId,
        this.workspaceQueryService.getDataSourceSchema(workspaceId),
      );
      const key = apiKeys?.[0];
      return key?.key ?? null;
    } catch {
      return null;
    }
  }

  private async fetchUnipileAccountById(
    accountId: string,
  ): Promise<Record<string, unknown> | null> {
    const base = process.env.UNIPILE_API_URL;
    const token = process.env.UNIPILE_ACCESS_TOKEN;
    if (!base || !token) {
      return null;
    }
    const url = `${base}/api/v1/accounts/${accountId}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-API-KEY': token,
        },
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as Record<string, unknown>;
      return data;
    } catch {
      return null;
    }
  }

  private async onAccountSyncCompleted(accountId: string, accountType: string): Promise<void> {
    // TODO: Implement sync completed handler
  }

  private async onAccountConnecting(accountId: string, accountType: string): Promise<void> {
    // TODO: Implement connecting handler
  }

  private async onAccountDeleted(accountId: string, accountType: string): Promise<void> {
    // TODO: Implement account deleted handler
  }

  // Message event handlers
  private async onMessageReceived(payload: UnipileMessageWebhook, isFromConnectedUser: boolean): Promise<void> {
    const { account_type, attachments } = payload;
    
    try {
      // Handle attachments if present
      if (attachments) {
        await this.handleAttachments(payload);
      }

      const incomingMessagesService = new IncomingWhatsappMessages(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.messageQueueService,
      );

      if (account_type === 'WHATSAPP') {
        this.logger.log(`Processing WhatsApp Unipile message: ${payload.message} from ${payload.sender.attendee_name}`);
        await incomingMessagesService.receiveIncomingMessageFromWhatsappUnipile(payload);
        this.logger.log('WhatsApp Unipile message processed successfully');
      } else if (account_type === 'LINKEDIN') {
        this.logger.log(`Processing LinkedIn message: ${payload.message} from ${payload.sender.attendee_name}`);
        await incomingMessagesService.receiveIncomingMessageFromLinkedinUnipile(payload);
        this.logger.log('LinkedIn message processed successfully');
      } else {
        this.logger.warn(`Unknown account type for message: ${account_type}`);
      }
    } catch (error) {
      this.logger.error(`Error processing ${account_type} message:`, error);
      throw error;
    }
  }

  /**
   * Handle saving attachments from incoming messages
   */
  private async handleAttachments(payload: UnipileMessageWebhook): Promise<void> {
    try {
      const { attachments, sender, account_type, message_id, timestamp, account_id } = payload;
      
      if (!attachments) {
        return;
      }

      // Normalize attachments to array
      const attachmentsArray: UnipileWebhookAttachment[] = Array.isArray(attachments) 
        ? attachments 
        : [attachments];

      if (attachmentsArray.length === 0) {
        return;
      }

      this.logger.log(`Processing ${attachmentsArray.length} attachment(s) for message ${message_id}`);

      // Get Unipile API credentials for downloading attachments if needed
      const baseUrl = process.env.UNIPILE_API_URL || '';
      const accessToken = process.env.UNIPILE_ACCESS_TOKEN || '';

      const workspaceId =
        (account_id
          ? await this.unipileAccountPoolService.getWorkspaceIdByAccountId(
              account_id,
            )
          : null) ?? 'unknown';

      // Save each attachment
      for (const attachment of attachmentsArray) {
        try {
          const savedPath = await this.unipileAttachmentStorageService.saveAttachment(
            {
              workspaceId,
              attachment,
              sender,
              accountType: account_type,
              messageId: message_id,
              timestamp,
              accountId: account_id,
              baseUrl,
              accessToken,
            },
          );

          if (savedPath) {
            this.logger.log(`Saved attachment to: ${savedPath}`);
          } else {
            this.logger.warn(`Failed to save attachment: ${attachment.attachment_id || attachment.id}`);
          }
        } catch (error) {
          this.logger.error(`Error saving attachment ${attachment.attachment_id || attachment.id}:`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error handling attachments:', error);
    }
  }

  private async onMessageReaction(payload: UnipileMessageWebhook): Promise<void> {
    // TODO: Handle message reaction
  }

  private async onMessageRead(payload: UnipileMessageWebhook): Promise<void> {
    const { message_id, account_type } = payload;
    
    this.logger.log(`Processing message read status for message: ${message_id} (${account_type})`);

    try {
      // Get API token based on account type
      let apiToken: string | null = null;
      let workspaceId: string | null = null;

      if (account_type === 'LINKEDIN') {
        const apiTokenResult = await this.getApiTokenForLinkedinMessage(payload);
        if (apiTokenResult) {
          apiToken = apiTokenResult.token;
          workspaceId = apiTokenResult.workspaceId;
        }
      } else if (account_type === 'WHATSAPP') {
        const apiTokenResult = await this.getApiTokenForWhatsappMessage(payload);
        if (apiTokenResult) {
          apiToken = apiTokenResult.token;
          workspaceId = apiTokenResult.workspaceId;
        }
      }

      if (!apiToken || !workspaceId) {
        this.logger.warn(`No API token found for message read status update: ${message_id}`);
        return;
      }

      // Query for the message by whatsappMessageId
      const variables = {
        filter: { whatsappMessageId: { ilike: `%${message_id}%` } },
        orderBy: { position: 'AscNullsFirst' },
      };

      const response = await this.staticGraphQLService.executeGraphQL(
        graphQlToFetchWhatsappMessages,
        variables,
        apiToken,
      );

      if (response?.data?.data?.whatsappMessages?.edges.length === 0) {
        this.logger.warn(`No message found with the given message_id: ${message_id}`);
        return;
      }

      const messageNode = response?.data?.data?.whatsappMessages?.edges[0]?.node;

      // Check if message is already read
      if (messageNode?.whatsappDeliveryStatus === 'read') {
        this.logger.log(
          'Message has already been read, skipping the update',
        );
        return;
      }

      this.logger.log(
        `Updating delivery status to 'read' for message: ${messageNode?.id}`,
      );

      // Update the message status to 'read'
      const variablesToUpdateDeliveryStatus = {
        idToUpdate: messageNode?.id,
        input: { whatsappDeliveryStatus: 'read' },
      };

      const responseOfDeliveryStatus = await this.staticGraphQLService.executeGraphQL(
        graphqlToUpdateWhatsappMessageId,
        variablesToUpdateDeliveryStatus,
        apiToken,
      );

      this.logger.log(
        '---------------MESSAGE READ STATUS UPDATE DONE-----------------------',
      );
      this.logger.log(
        `Delivery status update response: ${JSON.stringify(responseOfDeliveryStatus?.data)}`,
      );
    } catch (error) {
      this.logger.error(`Error updating message read status for ${message_id}:`, error);
      throw error;
    }
  }

  /**
   * Get API token for LinkedIn message based on account_info
   */
  private async getApiTokenForLinkedinMessage(
    payload: UnipileMessageWebhook,
  ): Promise<{ token: string; workspaceId: string } | null> {
    const incomingMessagesService = new IncomingWhatsappMessages(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.messageQueueService,
    );

    return await incomingMessagesService.getApiKeyToUseFromLinkedinMessageReceived(payload);
  }

  /**
   * Get API token for WhatsApp message based on account_info
   */
  private async getApiTokenForWhatsappMessage(
    payload: UnipileMessageWebhook,
  ): Promise<{ token: string; workspaceId: string } | null> {
    const incomingMessagesService = new IncomingWhatsappMessages(
      this.workspaceQueryService,
      this.staticGraphQLService,
      this.messageQueueService,
    );

    return await incomingMessagesService.getApiKeyToUseFromWhatsappUnipileMessageReceived(payload);
  }

  private async onMessageEdited(payload: UnipileMessageWebhook): Promise<void> {
    // TODO: Handle message edit
  }

  private async onMessageDeleted(payload: UnipileMessageWebhook): Promise<void> {
    const {
      message_id,
      message,
      sender,
      timestamp,
      account_type,
      chat_id,
      account_id,
      attachments,
      provider_chat_id,
      subject,
      is_group,
      attendees,
    } = payload;
    
    this.logger.log(`Message deleted: ${message_id}, message: ${message}, sender: ${sender.attendee_name}, timestamp: ${timestamp}, account_type: ${account_type}, chat_id: ${chat_id}, account_id: ${account_id}, provider_chat_id: ${provider_chat_id}, is_group: ${is_group}, attachments: ${attachments}`);
    
    try {
      await this.attachmentStorage.saveDeletedMessage({
        message_id,
        message: message || null,
        sender,
        timestamp,
        account_type,
        chat_id,
        account_id,
        attachments,
        provider_chat_id,
        subject,
        is_group,
        attendees,
      });

      const attachmentInfo = attachments 
        ? (Array.isArray(attachments) ? `${attachments.length} attachment(s)` : '1 attachment')
        : 'no attachments';
      this.logger.log(`Saved deleted message entry for: ${message_id} (${attachmentInfo})`);
    } catch (error) {
      this.logger.error(`Error saving deleted message ${message_id}:`, error);
    }
  }

  private async onMessageDelivered(payload: UnipileMessageWebhook): Promise<void> {
    const { message_id, account_type } = payload;
    
    this.logger.log(`Processing message delivered status for message: ${message_id} (${account_type})`);

    try {
      // Get API token based on account type
      let apiToken: string | null = null;
      let workspaceId: string | null = null;

      if (account_type === 'LINKEDIN') {
        const apiTokenResult = await this.getApiTokenForLinkedinMessage(payload);
        if (apiTokenResult) {
          apiToken = apiTokenResult.token;
          workspaceId = apiTokenResult.workspaceId;
        }
      } else if (account_type === 'WHATSAPP') {
        const apiTokenResult = await this.getApiTokenForWhatsappMessage(payload);
        if (apiTokenResult) {
          apiToken = apiTokenResult.token;
          workspaceId = apiTokenResult.workspaceId;
        }
      }

      if (!apiToken || !workspaceId) {
        this.logger.warn(`No API token found for message delivered status update: ${message_id}`);
        return;
      }

      // Query for the message by whatsappMessageId
      const variables = {
        filter: { whatsappMessageId: { ilike: `%${message_id}%` } },
        orderBy: { position: 'AscNullsFirst' },
      };

      const response = await this.staticGraphQLService.executeGraphQL(
        graphQlToFetchWhatsappMessages,
        variables,
        apiToken,
      );


      if (response?.data?.data?.whatsappMessages?.edges.length === 0) {
        this.logger.warn(`No message found with the given message_id: ${message_id}`);
        return;
      }

      const messageNode = response?.data?.data?.whatsappMessages?.edges[0]?.node;

      // Check if message is already read or delivered
      // Don't update if already read (read is higher status than delivered)
      // Don't update if already delivered (avoid redundant updates)
      if (
        messageNode?.whatsappDeliveryStatus === 'read' ||
        messageNode?.whatsappDeliveryStatus === 'delivered'
      ) {
        this.logger.log(
          'Message has already been read/delivered, skipping the update',
        );
        return;
      }

      this.logger.log(
        `Updating delivery status to 'delivered' for message: ${messageNode?.id}`,
      );

      // Update the message status to 'delivered'
      const variablesToUpdateDeliveryStatus = {
        idToUpdate: messageNode?.id,
        input: { whatsappDeliveryStatus: 'delivered' },
      };

      const responseOfDeliveryStatus = await this.staticGraphQLService.executeGraphQL(
        graphqlToUpdateWhatsappMessageId,
        variablesToUpdateDeliveryStatus,
        apiToken,
      );

      this.logger.log(
        '---------------MESSAGE DELIVERED STATUS UPDATE DONE-----------------------',
      );
      this.logger.log(
        `Delivery status update response: ${JSON.stringify(responseOfDeliveryStatus?.data)}`,
      );
    } catch (error) {
      this.logger.error(`Error updating message delivered status for ${message_id}:`, error);
      throw error;
    }
  }

  // Email event handlers
  private async onEmailReceived(payload: UnipileEmailWebhook): Promise<void> {
    // TODO: Handle received email
  }

  private async onEmailSent(payload: UnipileEmailWebhook): Promise<void> {
    // TODO: Handle sent email
  }

  private async onEmailRead(payload: UnipileEmailWebhook): Promise<void> {
    // TODO: Handle email read
  }

  private async onEmailOpened(payload: UnipileTrackingEmailWebhook): Promise<void> {
    // TODO: Handle email opened tracking
  }

  private async onEmailClicked(payload: UnipileTrackingEmailWebhook): Promise<void> {
    // TODO: Handle email clicked tracking
  }

  // Connection event handlers
  private async onConnectionPending(payload: UnipileNewRelationWebhook): Promise<void> {
    // No action for pending - we only process accepted invitations
  }

  private async onConnectionAccepted(payload: UnipileNewRelationWebhook): Promise<void> {
    const { account_id, user_full_name, user_provider_id, user_profile_url, relation } = payload;

    const name = user_full_name ?? relation?.name;
    const providerId = user_provider_id ?? relation?.profile_url;
    const profileUrl = user_profile_url ?? relation?.profile_url;

    if (!name || !providerId || !profileUrl) {
      this.logger.warn('New relation payload missing required fields for accepted connection');
      return;
    }

    const workspaceId =
      await this.workspaceQueryService.findWorkspaceIdByLinkedinUnipileAccountId(account_id);
    if (!workspaceId) {
      this.logger.warn(`No workspace found for LinkedIn Unipile account ${account_id}, skipping new relation`);
      return;
    }

    const workspaceKeys = await this.workspaceQueryService.getWorkspaceKeys(workspaceId);
    const linkedinUrl = workspaceKeys?.linkedin_url;
    if (!linkedinUrl) {
      this.logger.warn(`Workspace ${workspaceId} has no linkedin_url, skipping new relation`);
      return;
    }

    const normalizeUrl = (url: string) =>
      url?.replace('www.linkedin.com', 'linkedin.com') ?? '';
    const recipientProfileUrl = normalizeUrl(linkedinUrl.startsWith('http') ? linkedinUrl : `https://linkedin.com/in/${linkedinUrl}`);

    const senderAttendee = {
      attendee_id: providerId,
      attendee_name: name,
      attendee_provider_id: providerId,
      attendee_profile_url: profileUrl,
      attendee_public_identifier: payload.user_public_identifier ?? profileUrl.split('/').pop() ?? '',
    };

    const syntheticMessagePayload: UnipileMessageWebhook = {
      account_id,
      account_type: 'LINKEDIN',
      event: 'message_received',
      chat_id: `relation-${account_id}-${providerId}`,
      message_id: `new_relation-${account_id}-${providerId}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      webhook_name: payload.webhook_name ?? '',
      message: "Yes, I'm keen",
      sender: senderAttendee,
      attendees: [
        senderAttendee,
        {
          attendee_id: 'workspace-linkedin',
          attendee_name: 'Connected User',
          attendee_provider_id: 'workspace-linkedin',
          attendee_profile_url: recipientProfileUrl,
          attendee_public_identifier: recipientProfileUrl.split('/').pop() ?? '',
        },
      ],
    };

    try {
      const incomingMessagesService = new IncomingWhatsappMessages(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.messageQueueService,
      );
      await incomingMessagesService.receiveIncomingMessageFromLinkedinUnipile(syntheticMessagePayload);
      this.logger.log(`Processed new relation as "Yes, I'm keen" for ${name}`);
    } catch (error) {
      this.logger.error(`Error processing new relation for ${name}:`, error);
      throw error;
    }
  }

  private async onConnectionIgnored(payload: UnipileNewRelationWebhook): Promise<void> {
    // No action for ignored connections
  }
}
