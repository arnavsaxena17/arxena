import { Injectable } from '@nestjs/common';
import { render } from '@react-email/render';
import { InsufficientCreditsEmail } from 'twenty-emails';
import { allStatuses, buildCandidateFlagsPatchUpdate, CandidateNode, CandidatesEdge, graphqlQueryToCreateOneNewChatMessage, graphqlToFetchAllCandidateData, graphQltoUpdateOneCandidate, PageInfo, whatappUpdateMessageObjType, workspaceMemberDisplayName, workspaceMemberEmail } from 'twenty-shared';
import { v4 as uuidv4 } from 'uuid';
import { StageWiseClassification } from 'src/engine/core-modules/arx-chat/services/llm-agents/stage-classification';
import { Semaphore } from 'src/engine/core-modules/arx-chat/utils/semaphore';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { materializeCandidateTouchWithGraphQL } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';
import { WorkspaceMemberArxService } from 'src/engine/core-modules/arx-chat/services/workspace-member-arx.service';
import { CandidateEngagementArx } from './candidate-engagement';
import { FilterCandidates } from './filter-candidates';

// Chat-message and engagement-status writes shared by UpdateChat and
// EngagedCandidateQueueService. It lives in its own service because both need
// the same chain: UpdateChat calls it while sending, the queue service calls it
// while processing. Injecting one into the other would make them a cycle.
@Injectable()
export class CandidateEngagementDataUpdateService {
  constructor(
    protected readonly workspaceQueryService: WorkspaceQueryService,
    protected readonly staticGraphQLService: StaticGraphQLService,
  ) {}

  async updateCandidatesWithChatCount(
    candidateIds: string[],
    apiToken: string,
  ) {
    try {
      console.log('Updating candidates with chat count');
      console.log('Candidate ids for updating chat count::', candidateIds);
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: { filter: { id: { in: candidateIds } } },
      });
      const response = await this.staticGraphQLService.executeGraphQL(
        graphqlToFetchAllCandidateData,
        { filter: { id: { in: candidateIds } } },
        apiToken,
      );
      const candidates = response?.data?.data?.candidates as
        | {
            edges: CandidatesEdge[];
            pageInfo: PageInfo;
          }
        | undefined;
      const currentCandidates = candidates?.edges || [];

      console.log('Number of current Candidates:', currentCandidates.length);
      for (const candidate of currentCandidates) {
        const currentCount = candidate.node.chatCount || 0;

        console.log('Current chat count::', currentCount);
        const messagesList = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).fetchAllChatMessages(candidate.node.id, apiToken);
        const newCount = messagesList.length;

        console.log('New chat count::', newCount);
        if (newCount !== currentCount) {
          const graphqlVariables = {
            idToUpdate: candidate.node.id,
            input: { chatCount: newCount },
          };
          const updateGraphqlQueryObj = JSON.stringify({
            query: graphQltoUpdateOneCandidate,
            variables: graphqlVariables,
          });
          const updateResponse = await this.staticGraphQLService.executeGraphQL(
            graphQltoUpdateOneCandidate,
            graphqlVariables,
            apiToken,
          );

          if (updateResponse.data.errors) {
            console.log(
              'Error updating chat count:',
              updateResponse.data.errors,
            );
          } else {
            console.log(
              `Updated chat count for candidate ${candidate.node.id} from ${currentCount} to ${newCount}`,
            );
          }
        } else {
          console.log(
            `Chat count for candidate ${candidate.node.id} is already up to date`,
          );
        }
      }
    } catch (error) {
      console.error('Error in updateCandidates WithChatCount:', error);
    }
  }

  private async sendInsufficientCreditsEmail(
    apiToken: string,
    recruiterId: string,
  ) {
    try {
      const workspaceName =
        await this.workspaceQueryService.getWorkspaceNameFromToken(apiToken);
      const currentUser = await new WorkspaceMemberArxService(
        this.staticGraphQLService,
      ).getById(recruiterId, apiToken);

      // Send socket notification to the recruiter
      if (recruiterId) {
        this.workspaceQueryService.webSocketService.sendToUser(
          recruiterId,
          'openai_credits_status',
          {
            hasInsufficientCredits: true,
          },
        );
      }

      const emailTemplate = InsufficientCreditsEmail({
        userName: workspaceMemberDisplayName(currentUser) || '',
        workspaceDisplayName: workspaceName || 'Arxena',
        locale: 'en',
      });

      const html = render(emailTemplate);
      const text = render(emailTemplate, {
        plainText: true,
      });

      await this.workspaceQueryService.emailService.send({
        from: `Arxena <${process.env.EMAIL_FROM_ADDRESS || 'no-reply@arxena.com'}>`,
        to: workspaceMemberEmail(currentUser) ?? undefined,
        subject: 'OpenAI Credits Depleted - Action Required ⚠️',
        html,
        text,
      });

      console.log(
        'Sent insufficient credits email to:',
        workspaceMemberEmail(currentUser),
      );
    } catch (error) {
      console.error('Error sending insufficient credits email:', error);
    }
  }

  async processCandidatesChatsGetStatuses(
    apiToken: string,
    projectIds: string[],
    candidateIds: string[] | null = null,
    updateType: string = 'processCandidatesChatsGetStatuses',
  ) {
    console.log('This is the update type::', updateType);
    console.log('Processing candidates chats to get statuses with chat true');
    console.log('Received a lngth of candidate Ids::', candidateIds?.length);
    console.log('candidate Ids::', candidateIds);
    let allCandidates = await new CandidateEngagementArx(
      this.workspaceQueryService,
      this.staticGraphQLService,
    ).fetchAllCandidatesWithAllChatControls(
      'allStartedAndStoppedChats',
      apiToken,
    );

    console.log(
      'Received a lngth of allCandidates in process Candidates Chats GetStatuses::',
      allCandidates?.length,
    );
    if (candidateIds && Array.isArray(candidateIds)) {
      allCandidates = allCandidates.filter(
        (candidate) =>
          candidateIds.includes(candidate.id) &&
          candidate.candConversationStatus !==
            'CONVERSATION_CLOSED_TO_BE_CONTACTED',
      );
    } else {
      console.log('Candidate Ids are not present in the request');
    }

    console.log(
      'Fetched',
      allCandidates?.length,
      ' candidates with chatControl allStartedAndStoppedChats in getStatus',
    );
    console.log('Fetched filtered candidates of', allCandidates);
    const semaphore = new Semaphore(10); // Allow 10 concurrent requests
    const processWithSemaphore = async (candidate: any) => {
      await semaphore.acquire();
      try {
        const candidateId = candidate?.id;

        console.log(
          'This is the candidate ID::',
          candidateId,
          'and candidate name for processing and getting udpated status::',
          candidate?.name,
        );
        const projectId = candidateIds
          ? projectIds[candidateIds.indexOf(candidateId)]
          : '';

        const recruiterId = candidate?.project?.recruiterId;

        if (projectId == '') {
          console.log(
            'Project ID is not present for the candidate::',
            candidateId,
          );
        }
        const chatMessages = await new FilterCandidates(
          this.workspaceQueryService,
          this.staticGraphQLService,
        ).fetchAllChatMessages(candidateId, apiToken);
        // Get the chat status and formatted chat in parallel
        try {
          const [candidateStatus] = await Promise.all([
            new StageWiseClassification(
              this.workspaceQueryService,
              this.staticGraphQLService,
            ).getChatStageFromChatHistory(
              chatMessages,
              candidateId,
              projectId,
              apiToken,
            ) as Promise<allStatuses>,
          ]);

          // console.log(
          //   'This is the candidate status::',
          //   candidate,
          //   'for the candidate::',
          //   candidateId,
          //   'and the status is::',
          //   candidateStatus,
          // );

          return {
            candidateId,
            candidateStatus,
            googleSheetId: candidate?.project?.googleSheetId,
            chatMessages,
          };
        } catch (error) {
          console.log('Error in processing candidate:', error);
          if (
            error?.error?.type === 'insufficient_quota' ||
            error?.code === 'insufficient_quota'
          ) {
            console.log('OpenAI credits depleted, sending notification email');
            await this.sendInsufficientCreditsEmail(apiToken, recruiterId);
          }
          throw error;
        }
      } catch (error) {
        console.log('Error in processing candidate:', error);
        return null;
      } finally {
        semaphore.release();
      }
    };
    const results = await Promise.all(
      allCandidates.map((candidate) => processWithSemaphore(candidate)),
    );
    const validResults = results.filter((result) => result !== null);
    // Batch update the candidate statuses
    const updatePromises = validResults.map(async (result) => {
      if (!result) return;
      const updateCandidateObjectVariables = {
        idToUpdate: result.candidateId,
        input: { candConversationStatus: result.candidateStatus },
      };
      const graphqlQueryObj = JSON.stringify({
        query: graphQltoUpdateOneCandidate,
        variables: updateCandidateObjectVariables,
      });

      // if (['CONVERSATION_CLOSED_TO_BE_CONTACTED', 'CANDIDATE_IS_KEEN_TO_CHAT'].includes(result.candidateStatus)){
      if (
        ['CONVERSATION_CLOSED_TO_BE_CONTACTED'].includes(result.candidateStatus)
      ) {
        const updateCandidateVariables = {
          idToUpdate: result.candidateId,
          input: buildCandidateFlagsPatchUpdate(
            allCandidates.find(
              (candidateItem) => candidateItem.id === result.candidateId,
            ),
            { startChatCompleted: true },
          ),
        };
        const graphqlQueryObjForUpdationForCandidateStatus = JSON.stringify({
          query: graphQltoUpdateOneCandidate,
          variables: updateCandidateVariables,
        });

        try {
          await this.staticGraphQLService.executeGraphQL(
            graphQltoUpdateOneCandidate,
            updateCandidateVariables,
            apiToken,
          );
        } catch (e) {
          console.log('Error in candidate status update::', e);
        }
      }
      try {
        const response = await this.staticGraphQLService.executeGraphQL(
          graphQltoUpdateOneCandidate,
          updateCandidateObjectVariables,
          apiToken,
        );

        console.log(
          'Candidate chat status updated successfully "with the status of ::',
          result.candidateStatus,
        );
      } catch (error) {
        console.log('Error in updating candidate chat count:', error);
      }
    });

    await Promise.all(updatePromises);

    return validResults;
  }

  async createAndUpdateChatMessage(
    candidate: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
    options?: { createdAt?: string },
  ) {
    console.log(
      'This is the message being updated in the database ',
      whatappUpdateMessageObj?.messages[0]?.content || '',
    );
    const createNewChatMessageUpdateVariables = {
      input: {
        position: 'first',
        id: whatappUpdateMessageObj?.id || uuidv4(),
        candidateId: candidate?.id,
        personId: candidate?.peopleId,
        message:
          whatappUpdateMessageObj?.messages[0]?.content ||
          whatappUpdateMessageObj?.messages[0]?.text ||
          '',
        phoneFrom: whatappUpdateMessageObj?.phoneNumberFrom,
        phoneTo: whatappUpdateMessageObj?.phoneNumberTo,
        projectId: candidate?.project?.id,
        recruiterId: candidate?.project?.recruiterId,
        name: whatappUpdateMessageObj?.messageType,
        lastEngagementChatControl:
          whatappUpdateMessageObj?.lastEngagementChatControl,
        messageObj: whatappUpdateMessageObj?.messageObj,
        whatsappDeliveryStatus: whatappUpdateMessageObj.whatsappDeliveryStatus,
        externalMessageId: whatappUpdateMessageObj?.externalMessageId,
        typeOfMessage: whatappUpdateMessageObj?.typeOfMessage,
        audioFilePath: whatappUpdateMessageObj?.databaseFilePath,
        ...(options?.createdAt ? { createdAt: options.createdAt } : {}),
      },
    };

    try {
      console.log(
        'GRAPHQL WITH WHATSAPP MESSAGE:',
        createNewChatMessageUpdateVariables?.input?.message,
      );
      const response = (await this.staticGraphQLService.executeGraphQL(
        graphqlQueryToCreateOneNewChatMessage,
        createNewChatMessageUpdateVariables,
        apiToken,
      )) as {
        data?: {
          errors?: Array<{ message?: string }>;
          data?: unknown;
        };
      };

      const graphQLErrors = response?.data?.errors;
      if (graphQLErrors && graphQLErrors.length > 0) {
        console.error(
          'createChatMessage failed:',
          graphQLErrors.map((error) => error.message).join('; '),
        );

        return undefined;
      }

      const recruiterId = candidate?.project?.recruiterId;
      console.log('This is the recruiterId::', recruiterId);
      if (recruiterId) {
        console.log(
          'Sending WebSocket event to the specific recruiter::',
          recruiterId,
        );
        this.workspaceQueryService.webSocketService.sendToUser(
          recruiterId,
          'chat_message_updated',
          {
            candidateId: candidate?.id,
            projectId: candidate?.project?.id,
            messageId: createNewChatMessageUpdateVariables.input.id,
          },
        );
        console.log(
          'WebSocket event sent to the specific recruiter::',
          recruiterId,
        );
      } else {
        console.log(
          'No recruiterId found for the message, skipping WebSocket notification',
        );
      }

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateEngagementStatus(
    candidate: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
    options?: {
      messagingChannelOverride?: string | null;
      skipOutreachMaterialize?: boolean;
    },
  ) {
    const candidateEngagementStatus =
      whatappUpdateMessageObj.messageType !== 'botMessage';

    console.log(
      'Updating candidate engagement status to:',
      candidateEngagementStatus,
      'for candidate id::',
      candidate?.id,
    );
    const updateCandidateObjectVariables = {
      idToUpdate: candidate?.id,
      input: buildCandidateFlagsPatchUpdate(candidate, {
        engagementStatus: candidateEngagementStatus,
        lastEngagementChatControl:
          whatappUpdateMessageObj.lastEngagementChatControl,
      }),
    };
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphQltoUpdateOneCandidate,
        updateCandidateObjectVariables,
        apiToken,
      );

      if (!options?.skipOutreachMaterialize) {
        const touch =
          whatappUpdateMessageObj.messageType === 'botMessage'
            ? 'outbound'
            : 'inbound';

        await materializeCandidateTouchWithGraphQL({
          staticGraphQLService: this.staticGraphQLService,
          candidateId: candidate?.id,
          touch,
          apiToken,
          existingFirstOutboundAt: (candidate as { firstOutboundAt?: string })
            ?.firstOutboundAt,
          companyId:
            (
              candidate as {
                project?: { companyId?: string; company?: { id?: string } };
              }
            )?.project?.companyId ??
            (candidate as { project?: { company?: { id?: string } } })?.project
              ?.company?.id,
          messagingChannel:
            options?.messagingChannelOverride ??
            (candidate as { messagingChannel?: string })?.messagingChannel,
        });
      }

      return response.data;
    } catch (error) {
      console.log('Error in updating candidate status::', error);
    }
  }

  async updateCandidateEngagementDataInTable(
    candidate: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
    isAfterMessageSent = false,
  ) {
    if (candidate?.name === '') return;
    console.log('Candidate information retrieved successfully');
    const chatMessage = await this.createAndUpdateChatMessage(
      candidate,
      whatappUpdateMessageObj,
      apiToken,
    );

    if (!chatMessage || isAfterMessageSent) {
      console.log(
        'WhatsApp message not found or message already sent, hence not updating the candidate engagement status to true',
      );
      return;
    }
    const updateCandidateStatusObj = await this.updateCandidateEngagementStatus(
      candidate,
      whatappUpdateMessageObj,
      apiToken,
    );

    if (!updateCandidateStatusObj) return;

    await this.updateCandidateEngagementStatusAndChatCounts(
      candidate,
      whatappUpdateMessageObj,
      apiToken,
    );
    return {
      status: 'success',
      message: 'Candidate engagement status updated successfully',
    };
  }

  async updateCandidateEngagementStatusAndChatCounts(
    candidate: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
  ) {
    // console.log('whatappUpdateMessageObj::', whatappUpdateMessageObj);
    // console.log('Updating candidate engagement status and chat counts');
    // console.log('Candidate profile object::', candidate);
    // console.log('Whatapp update message object::', whatappUpdateMessageObj);

    await this.updateCandidatesWithChatCount([candidate?.id], apiToken);

    const results = await this.processCandidatesChatsGetStatuses(
      apiToken,
      [candidate?.project?.id],
      [candidate?.id],
      'updateCandidateEngagementStatusAndChatCounts',
    );
    // console.log('Results from updating candidate engagement status and chat counts::', results);
    return results;
  }

  async setCandidateEngagementStatusToFalse(
    candidateId: string,
    apiToken: string,
  ) {
    console.log(
      'Setting candidate engagement status to false::',
      candidateId,
      ' at time :: ',
      new Date().toISOString(),
    );
    const candidate = await this.staticGraphQLService.executeGraphQL(
      graphqlToFetchAllCandidateData,
      { filter: { id: { eq: candidateId } } },
      apiToken,
    );
    const candidateNode = (
      candidate?.data?.data?.candidates as
        | { edges: CandidatesEdge[] }
        | undefined
    )?.edges[0]?.node;

    const updateCandidateObjectVariables = {
      idToUpdate: candidateId,
      input: buildCandidateFlagsPatchUpdate(candidateNode, {
        engagementStatus: false,
      }),
    };

    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        graphQltoUpdateOneCandidate,
        updateCandidateObjectVariables,
        apiToken,
      );

      console.log(
        'Candidate engagement status updated successfully to false ::',
        response.data.data.updateCandidate,
        ' at time :: ',
        new Date().toISOString(),
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }
}
