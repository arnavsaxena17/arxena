import { useCallback } from 'react';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import {
  apiKeysLoadingState,
  apiKeysState,
} from '@/arx-jd-upload/states/apiKeysState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { gql } from '@apollo/client';
import { useLazyQuery } from '@apollo/client/react';
import { MessagingChannel, normalizeMessagingChannel } from 'twenty-shared/arx';
import {
  findWorkspaceMembersForArx,
  graphqlToFindManyProjectsWithCandidateValues,
} from 'twenty-shared/graphql';
import {
  extractWorkspaceMemberFromApolloData,
  extractWorkspaceMemberFromRelationField,
  isDefined,
  workspaceMemberFilterById,
  type WorkspaceMemberArxGraphqlNode,
  type WorkspaceMembersApolloData,
} from 'twenty-shared/utils';

type UseCheckDataIntegrityOfProjectProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export type CheckDataIntegrityOfProjectOptions = {
  /** When set (including []), WhatsApp API key requirements use these channels only (e.g. selected candidates). When omitted, all job candidates from the query are used. */
  messagingChannelsForKeys?: string[];
};

type ProjectIntegrityNode = {
  recruiterId?: string | null;
  recruiter?: WorkspaceMemberArxGraphqlNode | null;
  company?: {
    descriptionOneliner?: string | null;
  } | null;
  companyId?: string | null;
  chatFlowOrder?: string[] | null;
  candidates?: {
    edges?: Array<{
      node?: { messagingChannel?: string | null } | null;
    } | null> | null;
  } | null;
  attachments?: { edges?: unknown[] | null } | null;
  jobLocation?: string | null;
  isActive?: boolean | null;
  videoInterviewTemplate?: {
    edges?: Array<{
      node?: {
        videoInterviewModelId?: string | null;
        instructions?: string | null;
        introduction?: string | null;
        videoInterviewQuestions?: {
          edges?: Array<{
            node?: {
              questionValue?: unknown;
              attachments?: { edges?: unknown[] | null } | null;
            } | null;
          } | null> | null;
        } | null;
        attachments?: { edges?: unknown[] | null } | null;
      } | null;
    } | null> | null;
  } | null;
};

export const useCheckDataIntegrityOfProject = ({
  onSuccess,
  onError,
}: UseCheckDataIntegrityOfProjectProps = {}) => {
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const apiKeys = useAtomStateValue(apiKeysState);
  const apiKeysLoading = useAtomStateValue(apiKeysLoadingState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const apolloCoreClient = useApolloCoreClient();
  const [executeProjectQuery] = useLazyQuery(
    gql`
      ${graphqlToFindManyProjectsWithCandidateValues}
    `,
    { client: apolloCoreClient, fetchPolicy: 'network-only' },
  );
  const [executeWorkspaceMemberQuery] = useLazyQuery(
    gql`
      ${findWorkspaceMembersForArx}
    `,
    { client: apolloCoreClient, fetchPolicy: 'network-only' },
  );

  const checkDataIntegrityOfProject = useCallback(
    async (
      recordIds: string[],
      options?: CheckDataIntegrityOfProjectOptions,
    ): Promise<boolean> => {
      try {
        if (apiKeysLoading) {
          enqueueErrorSnackBar({
            message:
              'Workspace API keys are still loading. Try validating again in a moment.',
            options: { duration: 5000 },
          });
          return false;
        }

        const { data } = await executeProjectQuery({
          variables: {
            filter: { id: { in: recordIds } },
            limit: 30,
            orderBy: [{ position: 'AscNullsFirst' }],
          },
        });
        if (!isDefined(data)) {
          enqueueErrorSnackBar({
            message: 'Error in validating job data',
            options: { duration: 5000 },
          });
          if (isDefined(onError)) {
            onError(new Error('No job data returned'));
          }
          return false;
        }

        const jobNode = (
          data as {
            projects?: { edges?: Array<{ node?: ProjectIntegrityNode }> };
          }
        )?.projects?.edges?.[0]?.node;

        const recruiterId =
          jobNode?.recruiterId ?? jobNode?.recruiter?.id ?? null;

        let recruiterWorkspaceMember =
          extractWorkspaceMemberFromRelationField(jobNode?.recruiter) ??
          jobNode?.recruiter ??
          null;

        if (!recruiterWorkspaceMember && isDefined(recruiterId)) {
          const { data: memberData } = await executeWorkspaceMemberQuery({
            variables: workspaceMemberFilterById(recruiterId),
          });
          recruiterWorkspaceMember = extractWorkspaceMemberFromApolloData(
            memberData as WorkspaceMembersApolloData,
          );
        }

        const recruiterWhatsappUnipileAccountId =
          recruiterWorkspaceMember?.whatsappUnipileAccountId?.trim() ?? '';
        const chatFlowOrder = jobNode?.chatFlowOrder;
        const hasVideoInterview = chatFlowOrder?.includes(
          'startVideoInterviewChat',
        );
        const candidateEdges = jobNode?.candidates?.edges ?? [];
        const channelsForWhatsappKeyRules = isDefined(
          options?.messagingChannelsForKeys,
        )
          ? options.messagingChannelsForKeys
          : null;
        const needsWhatsappOfficialKeys =
          channelsForWhatsappKeyRules !== null
            ? channelsForWhatsappKeyRules.some(
                (channel) =>
                  normalizeMessagingChannel(channel) ===
                  MessagingChannel.WHATSAPP_OFFICIAL,
              )
            : candidateEdges.some(
                (edge) =>
                  normalizeMessagingChannel(edge?.node?.messagingChannel) ===
                  MessagingChannel.WHATSAPP_OFFICIAL,
              );
        const needsWhatsappUnipileKey =
          channelsForWhatsappKeyRules !== null
            ? channelsForWhatsappKeyRules.some(
                (channel) =>
                  normalizeMessagingChannel(channel) ===
                  MessagingChannel.WHATSAPP_UNIPILE,
              )
            : candidateEdges.some(
                (edge) =>
                  normalizeMessagingChannel(edge?.node?.messagingChannel) ===
                  MessagingChannel.WHATSAPP_UNIPILE,
              );

        const consolidatedErrorMessage = [
          !apiKeys?.openaikey && 'OpenAI API key is missing',
          !apiKeys?.facebook_whatsapp_phone_number_id &&
            needsWhatsappOfficialKeys &&
            'WhatsApp phone number ID is missing',
          needsWhatsappOfficialKeys &&
            !apiKeys?.facebook_whatsapp_asset_id &&
            'WhatsApp facebook_whatsapp_asset_id ID is missing',
          needsWhatsappOfficialKeys &&
            !apiKeys?.facebook_whatsapp_api_token &&
            'WhatsApp API token is missing',
          needsWhatsappUnipileKey &&
            !recruiterWhatsappUnipileAccountId &&
            'WhatsApp Unipile account ID is missing on the job recruiter workspace member',

          !jobNode && 'Job data is missing or malformed',

          !jobNode?.attachments?.edges &&
            'Attachments data structure is missing',
          jobNode?.attachments?.edges?.length === 0 && 'No JD attachment found',
          !jobNode?.jobLocation && 'Job location is missing',
          (!jobNode?.chatFlowOrder ||
            !Array.isArray(jobNode?.chatFlowOrder) ||
            jobNode?.chatFlowOrder?.length === 0) &&
            'Chat flow order is missing',
          !jobNode?.companyId && 'Company ID is missing',
          jobNode?.isActive === false && 'Job is not active',

          !jobNode?.company?.descriptionOneliner &&
            'Company description is missing',

          !jobNode?.recruiterId && 'Recruiter ID is missing',

          hasVideoInterview &&
            !jobNode?.videoInterviewTemplate?.edges &&
            'Video interview template data structure is missing',
          hasVideoInterview &&
            jobNode?.videoInterviewTemplate?.edges?.length === 0 &&
            'No video interview template attached',
          hasVideoInterview &&
            !jobNode?.videoInterviewTemplate?.edges?.[0]?.node &&
            'Video interview template node is missing',
          hasVideoInterview &&
            !jobNode?.videoInterviewTemplate?.edges?.[0]?.node
              ?.videoInterviewModelId &&
            'Video interview model ID is missing',
          hasVideoInterview &&
            !jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.instructions &&
            'Video interview instructions are missing',

          hasVideoInterview &&
            !jobNode?.videoInterviewTemplate?.edges?.[0]?.node
              ?.videoInterviewQuestions?.edges &&
            'Video interview questions data structure is missing',
          hasVideoInterview &&
            jobNode?.videoInterviewTemplate?.edges?.[0]?.node
              ?.videoInterviewQuestions?.edges?.length === 0 &&
            'No video interview questions found',
          hasVideoInterview &&
            jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges?.some(
              (edge) => !edge?.node?.questionValue,
            ) &&
            'One or more video interview questions are empty',
          hasVideoInterview &&
            jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges?.some(
              (edge) =>
                !edge?.node?.attachments?.edges ||
                edge?.node?.attachments?.edges?.length === 0,
            ) &&
            'Video attachments missing for interview questions',

          hasVideoInterview &&
            !jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.introduction &&
            'Video interview introduction text is missing',
          hasVideoInterview &&
            (!jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.attachments
              ?.edges ||
              jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.attachments
                ?.edges?.length === 0) &&
            'Video interview introduction video is missing',

          !recruiterWorkspaceMember && 'Recruiter workspace member is missing',
          !recruiterWorkspaceMember?.name &&
            'Recruiter name is missing on workspace member',
          !recruiterWorkspaceMember?.phoneNumber &&
            'Recruiter phone number is missing on workspace member',
          !recruiterWorkspaceMember?.jobTitle &&
            'Recruiter job title is missing on workspace member',
          !currentWorkspace?.companyName?.trim() &&
            'Company name is missing on workspace company profile',
          !currentWorkspace?.summary?.trim() &&
            'Company summary is missing on workspace company profile',
        ]
          .filter(Boolean)
          .join('\n• ');

        if (
          consolidatedErrorMessage &&
          consolidatedErrorMessage.trim().length > 0
        ) {
          enqueueErrorSnackBar({
            message: `Job validation failed. Please fix the following issues:\n\n• ${consolidatedErrorMessage}`,
            options: { duration: 10000 },
          });
          return false;
        }
        enqueueSuccessSnackBar({
          message: 'Successfully validated job data',
          options: { duration: 3000 },
        });
        if (isDefined(onSuccess)) onSuccess();
        return true;
      } catch (error) {
        enqueueErrorSnackBar({
          message: 'Error in validating job data',
          options: { duration: 5000 },
        });
        if (isDefined(onError)) onError(error as Error);
        return false;
      }
    },
    [
      executeProjectQuery,
      executeWorkspaceMemberQuery,
      enqueueSuccessSnackBar,
      enqueueErrorSnackBar,
      onSuccess,
      onError,
      apiKeys,
      apiKeysLoading,
      currentWorkspace,
    ],
  );

  return { checkDataIntegrityOfProject };
};
