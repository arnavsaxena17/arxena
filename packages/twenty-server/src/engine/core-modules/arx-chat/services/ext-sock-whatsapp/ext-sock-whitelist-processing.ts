// src/engine/core-modules/arx-chat/services/whatsapp-message.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';

// eslint-disable-next-line prettier/prettier
import { FindManyWorkspaceMembers, WhatsappMessageData, graphqlToFetchAllCandidateData, graphqlToFindManyJobs, } from 'twenty-shared';
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

  private async loadWhitelistsForAllUsers() {
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
              const phoneNumbers = await this.fetchCandidatePhoneNumbersForUser(
                user.id,
                token,
              );

              // Load whitelist as before
              await this.redisService.loadWhitelist(user.id, phoneNumbers);

              // Create reverse mappings for all phone numbers
              console.log(
                `Creating reverse mappings for ${phoneNumbers.length} phone numbers`,
              );
              for (const phoneNumber of phoneNumbers) {
                await this.redisService.createPhoneToUserMapping(
                  phoneNumber,
                  user.id,
                );
              }

              console.log(
                `Loaded ${phoneNumbers.length} phone numbers for user ${user.id}`,
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

  private async getUsersForWorkspace(
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

  private async fetchCandidatePhoneNumbersForUser(
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
        response?.data?.data?.jobs?.edges?.map((edge) => edge.node) || [];

      if (!activeJobs.length) {
        console.log(`No active jobs found for user`);

        return [];
      }

      // Extract job IDs
      const jobIds = activeJobs.map((job) => job.id);

      // Get candidates for these jobs
      const candidatesResponse = await axiosRequest(
        JSON.stringify({
          query: graphqlToFetchAllCandidateData,
          variables: { filter: { jobsId: { in: jobIds } } },
        }),
        apiToken,
      );

      // Extract and normalize phone numbers
      const phoneNumbers = new Set<string>();

      candidatesResponse?.data?.data?.candidates?.edges?.forEach((edge) => {
        const phoneNumber = edge.node?.people?.phones?.primaryPhoneNumber;

        if (phoneNumber) {
          // Format phone number to match WhatsApp format
          const normalizedNumber = phoneNumber.replace(/\D/g, '');

          // Add country code if needed (assuming Indian numbers)
          const formattedNumber =
            normalizedNumber.length === 10
              ? `91${normalizedNumber}@c.us`
              : `${normalizedNumber}@c.us`;

          phoneNumbers.add(formattedNumber);
        }
      });

      console.log(
        `Found ${phoneNumbers.size} unique phone numbers for user ${userId}`,
      );

      return Array.from(phoneNumbers);
    } catch (error) {
      console.error(
        `Failed to fetch candidate phone numbers for user ${userId}:`,
        error,
      );

      return [];
    }
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

    if (isProcessed) {
      return false;
    }

    // Then check if the phone number is whitelisted
    const phoneNumber = message.from;
    const isWhitelisted = await this.redisService.isWhitelisted(
      userId,
      phoneNumber,
    );

    console.log('isWhitelisted', isWhitelisted, 'phoneNumber', phoneNumber);

    // Always process outgoing messages (fromMe: true)
    // if (message.fromMe) {
    //   return true;
    // }

    return isWhitelisted;
  }

  async processWhatsappMessage(
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

  // Method to refresh the whitelist for a specific user
  async refreshWhitelistForUser(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    try {
      const token = await this.getWorkspaceToken(workspaceId);

      if (!token) {
        console.log(
          `No API token found for workspace ${workspaceId}, cannot refresh whitelist`,
        );

        return;
      }

      const phoneNumbers = await this.fetchCandidatePhoneNumbersForUser(
        userId,
        token,
      );

      // Clear existing whitelist and add new numbers
      await this.redisService.loadWhitelist(userId, phoneNumbers);

      console.log(
        `Refreshed whitelist for user ${userId} with ${phoneNumbers.length} numbers`,
      );
    } catch (error) {
      console.error(`Failed to refresh whitelist for user ${userId}:`, error);
      throw error;
    }
  }
}
