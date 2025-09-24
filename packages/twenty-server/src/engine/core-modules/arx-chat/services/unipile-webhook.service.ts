import { Injectable, Logger } from '@nestjs/common';
import { StaticGraphQLService } from '../../graphql/static-graphql.service';
import { InjectMessageQueue } from '../../message-queue/decorators/message-queue.decorator';
import { MessageQueue } from '../../message-queue/message-queue.constants';
import { MessageQueueService } from '../../message-queue/services/message-queue.service';
import { WorkspaceQueryService } from '../../workspace-modifications/workspace-modifications.service';
import type {
  CreateWebhookDto,
  UnipileAccountStatusWebhook,
  UnipileEmailWebhook,
  UnipileMessageWebhook,
  UnipileNewRelationWebhook,
  UnipileTrackingEmailWebhook,
  UnipileWebhookPayload
} from '../types/unipile-webhook.types';
import { IncomingWhatsappMessages } from './whatsapp-api/incoming-messages';

@Injectable()
export class UnipileWebhookService {
  private readonly logger = new Logger(UnipileWebhookService.name);

  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly staticGraphQLService: StaticGraphQLService,
    @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue) private readonly messageQueueService?: MessageQueueService,
  ) {}

  /**
   * Process incoming webhook payload and route to appropriate handler
   */
  async processWebhook(payload: UnipileWebhookPayload): Promise<void> {
    this.logger.log('Processing Unipile webhook:', JSON.stringify(payload, null, 2));

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
    const { account_id, account_type, message: status } = payload.AccountStatus;
    
    this.logger.log(`Account status update: ${account_id} (${account_type}) - ${status}`);

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
        this.logger.warn(`Account ${account_id} requires credential update`);
        await this.onAccountCredentialsRequired(account_id, account_type);
        break;
      
      case 'ERROR':
      case 'STOPPED':
        this.logger.error(`Account ${account_id} has stopped working: ${status}`);
        await this.onAccountError(account_id, account_type, status);
        break;
      
      case 'CREATION_SUCCESS':
      case 'RECONNECTED':
        this.logger.log(`Account ${account_id} successfully connected: ${status}`);
        await this.onAccountConnected(account_id, account_type, status);
        break;
      
      case 'SYNC_SUCCESS':
        this.logger.log(`Account ${account_id} synchronization completed`);
        await this.onAccountSyncCompleted(account_id, account_type);
        break;
      
      case 'CONNECTING':
        this.logger.log(`Account ${account_id} is attempting to connect`);
        await this.onAccountConnecting(account_id, account_type);
        break;
      
      case 'DELETED':
        this.logger.log(`Account ${account_id} has been deleted`);
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
        const isFromConnectedUser = payload.account_info.user_id === sender.attendee_provider_id;
        this.logger.log(`New message ${isFromConnectedUser ? 'sent' : 'received'}: "${message.substring(0, 100)}..."`);
        
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
    
    this.logger.log(`New LinkedIn relation: ${relation.name} (${relation.status})`);

    // TODO: Process new connection
    // This would typically involve:
    // 1. Storing the new connection in the database
    // 2. Triggering connection acceptance workflow
    // 3. Adding contact to CRM

    switch (relation.status) {
      case 'pending':
        this.logger.log(`Connection request pending: ${relation.name}`);
        await this.onConnectionPending(payload);
        break;
      
      case 'accepted':
        this.logger.log(`Connection accepted: ${relation.name}`);
        await this.onConnectionAccepted(payload);
        break;
      
      case 'ignored':
        this.logger.log(`Connection ignored: ${relation.name}`);
        await this.onConnectionIgnored(payload);
        break;
    }
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

  private async onAccountConnected(accountId: string, accountType: string, status: string): Promise<void> {
    // TODO: Implement account connected handler
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
    this.logger.log(`Processing LinkedIn message: ${payload.message} from ${payload.sender.attendee_name}`);
    
    try {
      // Process LinkedIn message using the incoming messages service
      const incomingMessagesService = new IncomingWhatsappMessages(
        this.workspaceQueryService,
        this.staticGraphQLService,
        this.messageQueueService,
      );
      await incomingMessagesService.receiveIncomingMessageFromLinkedinUnipile(payload);
      this.logger.log('LinkedIn message processed successfully');
    } catch (error) {
      this.logger.error('Error processing LinkedIn message:', error);
      throw error;
    }
  }

  private async onMessageReaction(payload: UnipileMessageWebhook): Promise<void> {
    // TODO: Handle message reaction
  }

  private async onMessageRead(payload: UnipileMessageWebhook): Promise<void> {
    // TODO: Handle message read status
  }

  private async onMessageEdited(payload: UnipileMessageWebhook): Promise<void> {
    // TODO: Handle message edit
  }

  private async onMessageDeleted(payload: UnipileMessageWebhook): Promise<void> {
    // TODO: Handle message deletion
  }

  private async onMessageDelivered(payload: UnipileMessageWebhook): Promise<void> {
    // TODO: Handle message delivery confirmation
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
    // TODO: Handle pending connection
  }

  private async onConnectionAccepted(payload: UnipileNewRelationWebhook): Promise<void> {
    // TODO: Handle accepted connection
  }

  private async onConnectionIgnored(payload: UnipileNewRelationWebhook): Promise<void> {
    // TODO: Handle ignored connection
  }
}
