// src/engine/core-modules/arx-chat/services/whatsapp-message.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';

// eslint-disable-next-line prettier/prettier
import { FindManyWorkspaceMembers, WhatsappMessageData, graphqlToFetchAllCandidateData, graphqlToFindManyJobs, isDefined, } from 'twenty-shared';
import { In } from 'typeorm';

import { workspacesWithOlderSchema } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/candidate-engagement';
import { ExtSockWhatsappMessageProcessor } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/ext-sock-whatsapp-message-process';
import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { axiosRequest } from 'src/engine/core-modules/video-interview/video-interview.controller';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

@Injectable()
export class ExtSockWhatsappWhitelistProcessingService implements OnModuleInit {
  constructor(
    private readonly extSockWhatsappMessageProcessor: ExtSockWhatsappMessageProcessor,
    readonly redisService: RedisService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  async onModuleInit() {
    // Load whitelist on startup for all active users
    try {
      // Delay the whitelist loading to ensure the server is fully started
      setTimeout(() => {
        this.loadWhitelistsForAllUsers().catch((error) => {
          console.error('Failed to load whitelists after delay:', error);
        });
      }, 10000); // 10 second delay

      console.log(
        'Scheduled whitelist loading with delay to ensure server is ready',
      );
    } catch (error) {
      console.error('Error scheduling whitelist loading:', error);
    }
  }

  async loadWhitelistsForAllUsers() {
    try {
      // Get all workspaces with active data sources
      const workspaces = await this.getFilteredWorkspaces();

      console.log(
        `Found ${workspaces.length} active workspaces for whitelist loading`,
      );

      for (const workspaceId of workspaces) {
        try {
          const token = await this.getWorkspaceToken(workspaceId);

          if (!token) continue;

          // Get users for this workspace
          const users = await this.getUsersForWorkspace(workspaceId, token);

          for (const user of users) {
            try {
              const identifiers = await this.fetchCandidateIdentifiersForUser(
                user.id,
                token,
              );

              // Load whitelist as before
              await this.redisService.loadWhitelist(user.id, identifiers);

              // Create reverse mappings for all identifiers
              console.log(
                `Creating reverse mappings for ${identifiers.length} identifiers`,
              );
              console.log('these are the identifiers', identifiers);
              for (const identifier of identifiers) {
                await this.redisService.createIdentifierToUserMapping(
                  identifier,
                  user.id,
                );
              }

              console.log(
                `Loaded ${identifiers.length} identifiers for user ${user.id}`,
              );
            } catch (userError) {
              console.error(
                `Error loading whitelist for user ${user.id}:`,
                userError,
              );
            }
          }
        } catch (workspaceError) {
          console.error(
            `Error processing workspace ${workspaceId}:`,
            workspaceError,
          );
        }
      }
    } catch (error) {
      console.error('Failed to load whitelists on startup:', error);
    }
  }

  private async getFilteredWorkspaces(): Promise<string[]> {
    const workspaceIds = await this.workspaceQueryService.getWorkspaces();
    const dataSources =
      await this.workspaceQueryService.dataSourceRepository.find({
        where: { workspaceId: In(workspaceIds) },
      });

    return Array.from(new Set(dataSources.map((ds) => ds.workspaceId))).filter(
      (id) => !workspacesWithOlderSchema.includes(id),
    );
  }

  private async getWorkspaceToken(workspaceId: string): Promise<string | null> {
    const schema =
      this.workspaceQueryService.workspaceDataSourceService.getSchemaName(
        workspaceId,
      );
    const apiKeys = await this.workspaceQueryService.getApiKeys(
      workspaceId,
      schema,
    );

    if (!apiKeys.length) return null;
    const token =
      await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
        workspaceId,
        apiKeys[0].id,
      );

    return token?.token || null;
  }

  async getUsersForWorkspace(
    workspaceId: string,
    token: string,
  ): Promise<any[]> {
    try {
      const response = await axiosRequest(
        JSON.stringify({
          query: FindManyWorkspaceMembers,
          variables: {
            filter: {},
            limit: 100,
          },
        }),
        token,
      );

      return (
        response?.data?.data?.workspaceMembers?.edges?.map((edge) => ({
          id: edge.node.userId,
          firstName: edge.node.name?.firstName,
          lastName: edge.node.name?.lastName,
        })) || []
      );
    } catch (error) {
      console.error(
        `Failed to get workspace members for workspace ${workspaceId}:`,
        error,
      );

      return [];
    }
  }

  async fetchCandidateIdentifiersForUser(
    userId: string,
    apiToken: string,
  ): Promise<string[]> {
    try {
      if (!apiToken) return [];

      // Fetch all jobs
      const response = await axiosRequest(
        JSON.stringify({
          query: graphqlToFindManyJobs,
          variables: {
            filter: {
              isActive: { eq: true },
            },
          },
        }),
        apiToken,
      );

      const activeJobs =
        response?.data?.data?.jobs?.edges?.map(
          (edge: { node: any }) => edge.node,
        ) || [];

      if (!activeJobs.length) {
        console.log(`No active jobs found for user`);

        return [];
      }

      const jobIds = activeJobs.map((job) => job.id);

      const identifiers = await this.fetchIdentifiers(userId, apiToken, jobIds);

      console.log(
        `Found ${identifiers.length} unique identifiers for user ${userId}`,
      );

      console.log('this is the identifiers', identifiers);

      return identifiers;
    } catch (error) {
      console.error(
        `Failed to fetch candidate identifiers for user ${userId}:`,
        error,
      );

      return [];
    }
  }

  async fetchIdentifiers(
    userId: string,
    apiToken: string,
    jobIds: string[],
  ): Promise<string[]> {

    // New pagination logic
    const identifiers = new Set<string>();
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const candidatesResponse = await axiosRequest(
        JSON.stringify({
          query: graphqlToFetchAllCandidateData,
          variables: {
            filter: { jobsId: { in: jobIds } },
            limit: 400, // Adjust page size as needed
            lastCursor: cursor,
          },
        }),
        apiToken,
      );

      const pageInfo = candidatesResponse?.data?.data?.candidates?.pageInfo;
      const edges = candidatesResponse?.data?.data?.candidates?.edges || [];

      // Process current page
      edges.forEach((edge) => {
        const phoneNumber = edge.node?.people?.phones?.primaryPhoneNumber;
        const linkedinUrl = edge.node?.people?.linkedinLink?.primaryLinkUrl;

        if (phoneNumber) {
          const normalizedNumber = phoneNumber.replace(/\D/g, '');
          const formattedNumber =
            normalizedNumber.length === 10
              ? `91${normalizedNumber}@c.us`
              : `${normalizedNumber}@c.us`;

          identifiers.add(formattedNumber);
        }

        if (linkedinUrl) {
          identifiers.add(linkedinUrl);
        }
      });

      // Update pagination state
      hasNextPage = pageInfo?.hasNextPage || false;
      cursor = pageInfo?.endCursor || null;

      console.log(`Processed page with ${edges.length} candidates`);
    }

    return Array.from(identifiers);
  }

  // Methods for processing WhatsApp messages
  async shouldProcessMessage(
    userId: string,
    message: WhatsappMessageData,
  ): Promise<boolean> {
    // First check if we've already processed this message
    const isProcessed = await this.redisService.isMessageProcessed(
      userId,
      message.id,
    );

    console.log("Is processed message", isProcessed);
    if (isProcessed) {
      return false;
    }

    // Determine the identifier based on message type
    const identifier = isDefined(message?.linkedin_url)
      ? message.linkedin_url
      : message.from;

    // Check if the identifier is whitelisted
    const isWhitelisted = await this.redisService.isWhitelisted(
      userId,
      identifier,
    );

    const messageType = isDefined(message?.linkedin_url)
      ? 'LinkedIn'
      : 'WhatsApp';

    console.log(
      `is${messageType}Whitelisted`,
      isWhitelisted,
      `${messageType}Identifier`,
      identifier,
    );

    // Always process outgoing messages (fromMe: true) if needed
    // if (message.fromMe) {
    //   return true;
    // }

    return isWhitelisted;
  }

  async processSockMessage(
    userId: string,
    message: WhatsappMessageData,
  ): Promise<void> {
    try {
      // Check if we should process this message
      if (!(await this.shouldProcessMessage(userId, message))) {
        console.log(
          `Skipping message ${message.id} (already processed or not whitelisted)`,
        );

        return;
      }
      console.log("Goign to process the message with user id and message", userId, message);
      // Process the message
      await this.extSockWhatsappMessageProcessor.processMessageWithUserId(
        message,
        userId,
      );

      // Mark message as processed
      await this.redisService.markMessageAsProcessed(userId, message.id);

      console.log(`Successfully processed message ${message.id}`);
    } catch (error) {
      console.error(`Failed to process message ${message.id}:`, error);
      throw error;
    }
  }
}
