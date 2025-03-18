import axios from 'axios';
import {
  allStatuses,
  AnswerMessageObj,
  CandidateNode,
  chatMessageType,
  graphqlQueryToCreateOneAnswer,
  graphqlQueryToCreateOneNewWhatsappMessage,
  graphqlQueryToRemoveMessages,
  graphqlToFetchAllCandidateData,
  graphQltoUpdateOneCandidate,
  graphqlToUpdateOneClientInterview,
  Jobs,
  PersonNode,
  whatappUpdateMessageObjType,
} from 'twenty-shared';
import { v4 } from 'uuid';

import { StageWiseClassification } from 'src/engine/core-modules/arx-chat/services/llm-agents/stage-classification';
import { getRecruiterProfileByJob } from 'src/engine/core-modules/arx-chat/services/recruiter-profile';
import { IncomingWhatsappMessages } from 'src/engine/core-modules/arx-chat/services/whatsapp-api/incoming-messages';
import { axiosRequest } from 'src/engine/core-modules/arx-chat/utils/arx-chat-agent-utils';
import { Semaphore } from 'src/engine/core-modules/arx-chat/utils/semaphore';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

import CandidateEngagementArx from './candidate-engagement';
import { FilterCandidates } from './filter-candidates';

export class UpdateChat {
  constructor(private readonly workspaceQueryService: WorkspaceQueryService) {}

  // Add this new method to the ScheduledJobService
  async updateMeetingStatusAfterCompletion(
    candidateProfileDataNodeObj: PersonNode,
    candidateJob: Jobs,
    apiToken: string,
  ): Promise<void> {
    try {
      console.log(
        'Going to update the meeitng after completion of the interview',
      );
      // Get candidate ID
      const candidateId =
        candidateProfileDataNodeObj?.candidates?.edges[0]?.node?.id;
      // Get updated version of candidate profile data
      const graphqlQueryObjToFetchCandidateData = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: { filter: { id: { eq: candidateId } } },
      });
      const updatedCandidateResponse = await axiosRequest(
        graphqlQueryObjToFetchCandidateData,
        apiToken,
      );
      const updatedCandidateProfileDataNodeObj =
        updatedCandidateResponse?.data?.data?.candidates?.edges[0]?.node;

      console.log(
        'updatedCandidateProfileDataNodeObj::',
        updatedCandidateProfileDataNodeObj,
      );
      const clientInterviewId =
        updatedCandidateProfileDataNodeObj?.clientInterview?.edges[0]?.node?.id;

      console.log('clientInterviewId::', clientInterviewId);
      const updateClientInterviewVariables = {
        idToUpdate: clientInterviewId,
        input: { clientInterviewCompleted: true },
      };
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToUpdateOneClientInterview,
        variables: updateClientInterviewVariables,
      });

      await axiosRequest(graphqlQueryObj, apiToken);
      console.log(
        `Successfully closed meeting status for candidate ${candidateId}`,
      );
      // Optionally, you could also update the candidate's status or add follow-up tasks here

      // Update the candidate's status to "Interview Completed"
      const updateCandidateVariables = {
        idToUpdate: candidateId,
        input: { startMeetingSchedulingChatCompleted: true },
      };
      const updateGraphqlQueryObj = JSON.stringify({
        query: graphQltoUpdateOneCandidate,
        variables: updateCandidateVariables,
      });

      await axiosRequest(updateGraphqlQueryObj, apiToken);
      console.log(
        `Successfully updated candidate status to "Interview Completed" for candidate ${candidateId}`,
      );
    } catch (error) {
      console.error('Error updating meeting status after completion:', error);
    }
  }

  async checkScheduledClientMeetingsCount(jobId, apiToken: string) {
    const scheduledClientMeetings = await new FilterCandidates(
      this.workspaceQueryService,
    ).fetchScheduledClientMeetings(jobId, apiToken);
    const today = new Date();
    const dayAfterTomorrow = new Date(today);

    dayAfterTomorrow.setDate(today.getDate() + 2);
    const countScheduledMeetings = scheduledClientMeetings.filter((meeting) => {
      const meetingDate = new Date(meeting.interviewTime.date);

      return meetingDate.toDateString() === dayAfterTomorrow.toDateString();
    }).length;

    console.log(
      `Number of scheduled meetings for the day after tomorrow: ${countScheduledMeetings}`,
    );
    // Send candidate details to email
    const candidateDetails = scheduledClientMeetings.map((meeting) => ({
      candidateId: meeting.candidateId,
      candidateName: meeting.candidateName,
      interviewTime: meeting.interviewTime,
    }));
    const candidateIds = scheduledClientMeetings.map(
      (meeting) => meeting.candidateId,
    );

    await this.createShortlist(candidateIds, apiToken);

    return scheduledClientMeetings;
  }

  async createShortlist(candidateIds: string[], apiToken: string) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/create-shortlist'
        : 'http://127.0.0.1:5050/create-shortlist';

    console.log('This is the url:', url);
    console.log(
      'going to create create-shortlist by candidate Ids',
      candidateIds,
    );
    const response = await axios.post(
      url,
      { candidateIds: candidateIds },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    console.log('Response from create-shortlist', response.data);

    return response.data;
  }

  async createShortlistDocument(candidateIds: string[], apiToken: string) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/create-shortlist-document'
        : 'http://127.0.0.1:5050/create-shortlist-document';

    console.log('This is the url:', url);
    console.log(
      'going to create create-shortlist by candidate Ids',
      candidateIds,
    );
    const response = await axios.post(
      url,
      { candidateIds: candidateIds },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    console.log('Response from create-shortlist', response.data);

    return response.data;
  }

  async createGmailDraftShortlist(candidateIds: string[], apiToken: string) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/create-create_gmail_draft_shortlist'
        : 'http://127.0.0.1:5050/create_gmail_draft_shortlist';

    console.log('This is the url:', url);
    console.log(
      'going to create create-shortlist by candidate Ids',
      candidateIds,
    );
    const response = await axios.post(
      url,
      { candidateIds: candidateIds },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    console.log('Response from create-shortlist', response.data);

    return response.data;
  }

  async createChatBasedShortlistDelivery(
    candidateIds: string[],
    apiToken: string,
  ) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/chat_based_shortlist_delivery'
        : 'http://127.0.0.1:5050/chat_based_shortlist_delivery';

    console.log('This is the url:', url);
    console.log(
      'going to create gmail-draft-shortlist by shortlists by candidate Ids',
      candidateIds,
    );
    const response = await axios.post(
      url,
      { candidateIds: candidateIds },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    return response.data;
  }

  async createInterviewVideos(jobId: string, apiToken: string) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/create-interview-videos'
        : 'http://127.0.0.1:5050/create-interview-videos';

    console.log('This is the url:', url);
    console.log('going to create jobId based interview videos', jobId);
    const response = await axios.post(
      url,
      { jobId: jobId },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    return response.data;
  }

  async testArxenaConnection(apiToken: string) {
    const url =
      process.env.ENV_NODE === 'production'
        ? 'https://arxena.com/test_arxena_connection'
        : 'http://127.0.0.1:5050/test_arxena_connection';

    console.log('This is the url:', url);
    const response = await axios.post(
      url,
      { candidateIds: 'candidateIds' },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: 'Bearer ' + apiToken,
        },
      },
    );

    return response.data;
  }

  async createInterimChat(
    interimChat: string,
    phoneNumber: string,
    apiToken: string,
  ) {
    console.log('This is the interim chat message::', interimChat);
    console.log('This is the phone number::', phoneNumber);
    const personObj: PersonNode = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByPhoneNumber(phoneNumber, apiToken);
    const candidateId = personObj.candidates?.edges[0]?.node?.id;
    const candidateJob: Jobs = personObj.candidates?.edges[0]?.node?.jobs;
    const recruiterProfile = await getRecruiterProfileByJob(
      candidateJob,
      apiToken,
    );
    const chatReply = interimChat;
    const whatsappIncomingMessage: chatMessageType = {
      phoneNumberFrom: phoneNumber,
      phoneNumberTo: recruiterProfile.phoneNumber,
      messages: [{ role: 'user', content: chatReply }],
      messageType: 'string',
    };
    const candidateProfileData = await new FilterCandidates(
      this.workspaceQueryService,
    ).getCandidateInformation(whatsappIncomingMessage, apiToken);

    console.log(
      'This is the candiate who has sent us the message., we have to update the database that this message has been recemivged::',
      chatReply,
    );
    const replyObject = {
      chatReply: chatReply,
      whatsappDeliveryStatus: 'receivedFromCandidate',
      phoneNumberFrom: phoneNumber,
      whatsappMessageId: 'NA',
    };
    const responseAfterMessageUpdate = await new IncomingWhatsappMessages(
      this.workspaceQueryService,
    ).createAndUpdateIncomingCandidateChatMessage(
      replyObject,
      candidateProfileData,
      candidateJob,
      apiToken,
    );

    console.log(
      'This is the response after message update::',
      responseAfterMessageUpdate,
      'Created the interim chat message',
    );
  }

  async updateCandidatesWithChatCount(
    candidateIds: string[],
    apiToken: string,
  ) {
    try {
      const graphqlQueryObj = JSON.stringify({
        query: graphqlToFetchAllCandidateData,
        variables: { filter: { id: { in: candidateIds } } },
      });
      const response = await axiosRequest(graphqlQueryObj, apiToken);
      const currentCandidates = response?.data?.data?.candidates?.edges || [];

      console.log('Number of current Candidates:', currentCandidates.length);
      for (const candidate of currentCandidates) {
        const currentCount = candidate.node.chatCount || 0;

        console.log('Current chat count::', currentCount);
        const messagesList = await await new FilterCandidates(
          this.workspaceQueryService,
        ).fetchAllWhatsappMessages(candidate.node.id, apiToken);
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
          const updateResponse = await axiosRequest(
            updateGraphqlQueryObj,
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

  async processCandidatesChatsGetStatuses(
    apiToken: string,
    jobIds: string[],
    candidateIds: string[] | null = null,
  ) {
    console.log('Processing candidates chats to get statuses with chat true');
    console.log('Received a lngth of candidate Ids::', candidateIds?.length);
    console.log('candidate Ids::', candidateIds);
    let allCandidates = await new CandidateEngagementArx(
      this.workspaceQueryService,
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
          // (candidate.candConversationStatus !== "CONVERSATION_CLOSED_TO_BE_CONTACTED" && candidate.candConversationStatus !== "CANDIDATE_IS_KEEN_TO_CHAT")
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
        const jobId = candidateIds
          ? jobIds[candidateIds.indexOf(candidateId)]
          : '';

        console.log('This is the job ID::', jobId);

        if (jobId == '') {
          console.log('Job ID is not present for the candidate::', candidateId);
        }
        const whatsappMessages = await new FilterCandidates(
          this.workspaceQueryService,
        ).fetchAllWhatsappMessages(candidateId, apiToken);
        // Get the chat status and formatted chat in parallel
        const [candidateStatus] = await Promise.all([
          new StageWiseClassification(
            this.workspaceQueryService,
          ).getChatStageFromChatHistory(
            whatsappMessages,
            candidateId,
            jobId,
            apiToken,
          ) as Promise<allStatuses>,
        ]);

        console.log(
          'This is the candidate status::',
          candidate,
          'for the candidate::',
          candidateId,
          'and the status is::',
          candidateStatus,
        );

        return {
          candidateId,
          candidateStatus,
          googleSheetId: candidate?.jobs?.googleSheetId,
          whatsappMessages,
        };
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
          input: { startChatCompleted: true },
        };
        const graphqlQueryObjForUpdationForCandidateStatus = JSON.stringify({
          query: graphQltoUpdateOneCandidate,
          variables: updateCandidateVariables,
        });

        console.log(
          'graphqlQueryObjForUpdationForCandidateStatus::',
          graphqlQueryObjForUpdationForCandidateStatus,
        );
        try {
          await axiosRequest(
            graphqlQueryObjForUpdationForCandidateStatus,
            apiToken,
          );
        } catch (e) {
          console.log('Error in candidate status update::', e);
        }
      }
      try {
        const response = await axiosRequest(graphqlQueryObj, apiToken);

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

  async createAndUpdateWhatsappMessage(
    candidateProfileObj: CandidateNode,
    userMessage: whatappUpdateMessageObjType,
    apiToken: string,
  ) {
    console.log(
      'This is the message being updated in the database ',
      userMessage?.messages[0]?.content || '',
    );
    console.log('This is the user candidateProfileObj::', candidateProfileObj);
    const createNewWhatsappMessageUpdateVariables = {
      input: {
        position: 'first',
        id: v4(),
        candidateId: candidateProfileObj?.id,
        personId: candidateProfileObj?.person?.id,
        message:
          userMessage?.messages[0]?.content ||
          userMessage?.messages[0]?.text ||
          '',
        phoneFrom: userMessage?.phoneNumberFrom,
        phoneTo: userMessage?.phoneNumberTo,
        jobsId: candidateProfileObj.jobs?.id,
        recruiterId: candidateProfileObj?.jobs?.recruiterId,
        name: userMessage?.messageType,
        lastEngagementChatControl: userMessage?.lastEngagementChatControl,
        messageObj: userMessage?.messageObj,
        whatsappDeliveryStatus: userMessage.whatsappDeliveryStatus,
        whatsappMessageId: userMessage?.whatsappMessageId,
        typeOfMessage: userMessage?.type,
        audioFilePath: userMessage?.databaseFilePath,
      },
    };

    console.log(
      'This si the create update whatsapp message::',
      createNewWhatsappMessageUpdateVariables,
    );
    const graphqlQueryObj = JSON.stringify({
      query: graphqlQueryToCreateOneNewWhatsappMessage,
      variables: createNewWhatsappMessageUpdateVariables,
    });

    try {
      console.log(
        'GRAPHQL WITH WHATSAPP MESSAGE:',
        createNewWhatsappMessageUpdateVariables?.input?.message,
      );
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      console.log(
        'This is the response data from the axios request in udpate message::',
        response.data,
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateEngagementStatus(
    candidateProfileObj: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
  ) {
    const candidateEngagementStatus =
      whatappUpdateMessageObj.messageType !== 'botMessage';

    console.log(
      'Updating candidate engagement status to:',
      candidateEngagementStatus,
      'for candidate id::',
      candidateProfileObj.id,
      ' at time :: ',
      new Date().toISOString(),
    );
    const updateCandidateObjectVariables = {
      idToUpdate: candidateProfileObj?.id,
      input: {
        engagementStatus: candidateEngagementStatus,
        lastEngagementChatControl:
          whatappUpdateMessageObj.lastEngagementChatControl,
      },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoUpdateOneCandidate,
      variables: updateCandidateObjectVariables,
    });

    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      console.log(
        'Candidate engagement status updated successfully to ::',
        candidateEngagementStatus,
        ' at time :: ',
        new Date().toISOString(),
      );

      return response.data;
    } catch (error) {
      console.log('Error in updating candidate status::', error);
    }
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
    const updateCandidateObjectVariables = {
      idToUpdate: candidateId,
      input: { engagementStatus: false },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoUpdateOneCandidate,
      variables: updateCandidateObjectVariables,
    });

    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      console.log(
        'Candidate engagement status updated successfully to false ::',
        false,
        ' at time :: ',
        new Date().toISOString(),
      );

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateAnswer(
    candidateProfileObj: CandidateNode,
    AnswerMessageObj: AnswerMessageObj,
    apiToken: string,
  ) {
    const updateCandidateObjectVariables = { input: { ...AnswerMessageObj } };
    const graphqlQueryObj = JSON.stringify({
      query: graphqlQueryToCreateOneAnswer,
      variables: updateCandidateObjectVariables,
    });

    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async scheduleCandidateInterview(
    candidateProfileObj: CandidateNode,
    candidateJob: Jobs,
    scheduleInterviewObj: whatappUpdateMessageObjType,
    apiToken: string,
  ) {
    const updateCandidateObjectVariables = {
      idToUpdate: candidateProfileObj?.id,
      input: { scheduleInterviewObj: scheduleInterviewObj },
    };
    const graphqlQueryObj = JSON.stringify({
      query: {},
      variables: updateCandidateObjectVariables,
    });

    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      return response.data;
    } catch (error) {
      console.log(error);
    }
  }

  async updateCandidateEngagementDataInTable(
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
    isAfterMessageSent = false,
  ) {
    console.log('Updating candidate engagement status in table');
    const candidateProfileObj =
      whatappUpdateMessageObj.messageType !== 'botMessage'
        ? await new FilterCandidates(
            this.workspaceQueryService,
          ).getCandidateInformation(whatappUpdateMessageObj, apiToken)
        : whatappUpdateMessageObj.candidateProfile;

    if (candidateProfileObj.name === '') return;
    console.log('Candidate information retrieved successfully');
    const whatsappMessage = await new UpdateChat(
      this.workspaceQueryService,
    ).createAndUpdateWhatsappMessage(
      candidateProfileObj,
      whatappUpdateMessageObj,
      apiToken,
    );

    if (!whatsappMessage || isAfterMessageSent) {
      console.log(
        'WhatsApp message not found or message already sent, hence not updating the candidate engagement status to true',
      );

      return;
    }
    const updateCandidateStatusObj = await new UpdateChat(
      this.workspaceQueryService,
    ).updateCandidateEngagementStatus(
      candidateProfileObj,
      whatappUpdateMessageObj,
      apiToken,
    );

    if (!updateCandidateStatusObj) return;

    return {
      status: 'success',
      message: 'Candidate engagement status updated successfully',
    };
  }

  async removeChatsByPhoneNumber(phoneNumberFrom: string, apiToken: string) {
    const personObj: PersonNode = await new FilterCandidates(
      this.workspaceQueryService,
    ).getPersonDetailsByPhoneNumber(phoneNumberFrom, apiToken);
    const personCandidateNode = personObj?.candidates?.edges[0]?.node;
    const messagesList = personCandidateNode?.whatsappMessages?.edges;
    const messageIDs = messagesList?.map((message) => message?.node?.id);

    this.removeChatsByMessageIDs(messageIDs, apiToken);
  }

  async removeChatsByMessageIDs(messageIDs: string[], apiToken: string) {
    const graphQLVariables = { filter: { id: { in: messageIDs } } };
    const graphqlQueryObj = JSON.stringify({
      query: graphqlQueryToRemoveMessages,
      variables: graphQLVariables,
    });
    const response = await axiosRequest(graphqlQueryObj, apiToken);

    console.log('REsponse status:', response.status);

    return response;
  }

  async updateCandidateProfileStatus(
    candidateProfileObj: CandidateNode,
    whatappUpdateMessageObj: whatappUpdateMessageObjType,
    apiToken: string,
  ) {
    const candidateStatus = whatappUpdateMessageObj.messageType;

    console.log('Updating the candidate status::', candidateStatus);
    console.log('Updating the candidate api token::', apiToken);
    const candidateId = candidateProfileObj?.id;

    console.log(
      'This is the candidateID for which we are trying to update the status:',
      candidateId,
    );
    const updateCandidateObjectVariables = {
      idToUpdate: candidateId,
      input: { status: candidateStatus },
    };
    const graphqlQueryObj = JSON.stringify({
      query: graphQltoUpdateOneCandidate,
      variables: updateCandidateObjectVariables,
    });

    console.log('GraphQL query to update candidate status:', graphqlQueryObj);
    try {
      const response = await axiosRequest(graphqlQueryObj, apiToken);

      console.log('REsponse from updating candidate status:', response.status);

      return 'Updated the candidate profile with the status.';
    } catch {
      console.log('Error in updating candidate profile status');
    }
  }
}
