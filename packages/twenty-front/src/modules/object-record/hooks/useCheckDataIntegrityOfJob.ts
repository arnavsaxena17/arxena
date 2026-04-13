import { useCallback } from 'react';
import { useRecoilValue } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification';
import { apiKeysState } from '@/arx-jd-upload/states/apiKeysState';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { gql, useLazyQuery } from '@apollo/client';
import { graphqlToFindManyJobsWithCandidateValues, isDefined } from 'twenty-shared';


type UseCheckDataIntegrityOfJobProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export type CheckDataIntegrityOfJobOptions = {
  /** When set (including []), WhatsApp API key requirements use these channels only (e.g. selected candidates). When omitted, all job candidates from the query are used. */
  messagingChannelsForKeys?: string[];
};

export const useCheckDataIntegrityOfJob = ({
  onSuccess,
  onError,
}: UseCheckDataIntegrityOfJobProps = {}) => {
  const { enqueueSnackBar } = useSnackBar();
  // const { keys: apiKeys } = useApiKeys();
  const apiKeys = useRecoilValue(apiKeysState);
  // Removed console.log to prevent unnecessary re-renders
  const [executeQuery] = useLazyQuery(gql`
    ${graphqlToFindManyJobsWithCandidateValues}
  `);

  const checkDataIntegrityOfJob = useCallback(
    async (
      recordIds: string[],
      options?: CheckDataIntegrityOfJobOptions,
    ): Promise<boolean> => {
      try {
        const { data } = await executeQuery({
          variables: {
            filter: { id: { in: recordIds } },
            limit: 30,
            orderBy: [{ position: 'AscNullsFirst' }],
          },
        });
        if (!isDefined(data)) {
          enqueueSnackBar('Error in validating job data', {
            variant: SnackBarVariant.Error,
            duration: 5000,
          });
          if (isDefined(onError)) {
            onError(new Error('No job data returned'));
          }
          return false;
        }

        const jobNode = data?.jobs?.edges?.[0]?.node;
        const recruiterWorkspaceMemberProfile =
          jobNode?.recruiter?.workspaceMemberProfile?.edges?.[0]?.node;


        console.log("This is the recruiter workspace member:", jobNode?.recruiter)
        console.log("This is the recruiter workspace member profile:", recruiterWorkspaceMemberProfile)
        const recruiterWhatsappUnipileAccountId =
          recruiterWorkspaceMemberProfile?.whatsappUnipileAccountId?.trim() ??
          '';
        const chatFlowOrder = jobNode?.chatFlowOrder;
        const hasMeetingScheduling = chatFlowOrder?.includes('startMeetingSchedulingChat');
        const hasVideoInterview = chatFlowOrder?.includes('startVideoInterviewChat');
        const candidateEdges = jobNode?.candidates?.edges ?? [];
        const channelsForWhatsappKeyRules = isDefined(
          options?.messagingChannelsForKeys,
        )
          ? options.messagingChannelsForKeys
          : null;
        const needsWhatsappOfficialKeys =
          channelsForWhatsappKeyRules !== null
            ? channelsForWhatsappKeyRules.some(
                (ch) => ch === 'whatsapp-official',
              )
            : candidateEdges.some(
                (edge: { node?: { messagingChannel?: string | null } | null }) =>
                  edge?.node?.messagingChannel === 'whatsapp-official',
              );
        const needsWhatsappUnipileKey =
          channelsForWhatsappKeyRules !== null
            ? channelsForWhatsappKeyRules.some(
                (ch) => ch === 'whatsapp-unipile',
              )
            : candidateEdges.some(
                (edge: { node?: { messagingChannel?: string | null } | null }) =>
                  edge?.node?.messagingChannel === 'whatsapp-unipile',
              );

        const consolidatedErrorMessage = [
            // API Keys
            !apiKeys?.openaikey && 'OpenAI API key is missing',
            !apiKeys?.facebook_whatsapp_phone_number_id && needsWhatsappOfficialKeys &&
              'WhatsApp phone number ID is missing',
            needsWhatsappOfficialKeys &&
              !apiKeys?.facebook_whatsapp_asset_id &&
              'WhatsApp facebook_whatsapp_asset_id ID is missing',
            needsWhatsappOfficialKeys &&
              !apiKeys?.facebook_whatsapp_api_token &&
              'WhatsApp API token is missing',
            needsWhatsappUnipileKey &&
              !recruiterWhatsappUnipileAccountId &&
              'WhatsApp Unipile account ID is missing on the job recruiter workspace member profile',

            // Basic job validation
            !jobNode && 'Job data is missing or malformed',

            // Job details
            !jobNode?.attachments?.edges &&
              'Attachments data structure is missing',
            jobNode?.attachments?.edges?.length === 0 &&
              'No JD attachment found',
            !jobNode?.jobLocation &&
              'Job location is missing',
            (!jobNode?.chatFlowOrder ||
              !Array.isArray(jobNode?.chatFlowOrder) ||
              jobNode?.chatFlowOrder?.length === 0) &&
              'Chat flow order is missing',
            !jobNode?.companyId && 'Company ID is missing',
            jobNode?.isActive === false &&
              'Job is not active',

            // Company details
            !jobNode?.company?.descriptionOneliner &&
              'Company description is missing',

            // Interview schedule - only validate if meeting scheduling is in chat flow
            hasMeetingScheduling && !jobNode?.interviewSchedule?.edges &&
              'Interview schedule data structure is missing',
            hasMeetingScheduling && jobNode?.interviewSchedule?.edges?.length === 0 && 
              'Interview schedule is missing',
            hasMeetingScheduling && !jobNode?.interviewSchedule?.edges?.[0]?.node?.slotsAvailable && 
              'Interview slots are not available',
            hasMeetingScheduling && !jobNode?.interviewSchedule?.edges?.[0]?.node?.meetingType && 
              'Meeting type is not specified',

            // Recruiter
            !jobNode?.recruiterId &&
              'Recruiter ID is missing',

            // Questions
            // !data?.jobs?.edges?.[0]?.node?.questions?.edges &&
            //   'Questions data structure is missing',
            // data?.jobs?.edges?.[0]?.node?.questions?.edges?.length === 0 &&
            //   'No questions attached',

            // Video interview template - only validate if video interview is in chat flow
            hasVideoInterview && !jobNode?.videoInterviewTemplate?.edges &&
              'Video interview template data structure is missing',
            hasVideoInterview && jobNode?.videoInterviewTemplate?.edges?.length === 0 && 
              'No video interview template attached',
            hasVideoInterview && !jobNode?.videoInterviewTemplate?.edges?.[0]?.node && 
              'Video interview template node is missing',
            hasVideoInterview && !jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewModelId &&
              'Video interview model ID is missing',
            hasVideoInterview && !jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.instructions &&
              'Video interview instructions are missing',

            // Video interview questions
            hasVideoInterview && !jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges &&
              'Video interview questions data structure is missing',
            hasVideoInterview && jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges?.length === 0 &&
              'No video interview questions found',
            hasVideoInterview && jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges?.some(
              (edge: { node: { questionValue: any } }) =>
                !edge?.node?.questionValue,
            ) && 'One or more video interview questions are empty',
            hasVideoInterview && jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges?.some(
              (edge: { node: { attachments: { edges: string | any[] } } }) =>
                !edge?.node?.attachments?.edges ||
                edge?.node?.attachments?.edges?.length === 0,
            ) && 'Video attachments missing for interview questions',

            // Video interview introduction
            hasVideoInterview && !jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.introduction &&
              'Video interview introduction text is missing',
            hasVideoInterview && (!jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.attachments?.edges ||
              jobNode?.videoInterviewTemplate?.edges?.[0]?.node?.attachments?.edges?.length === 0) &&
              'Video interview introduction video is missing',

            // Recruiter profile
            !jobNode?.recruiter?.workspaceMemberProfile
              ?.edges?.[0]?.node?.name &&
              'Recruiter name is missing in workspace member profiles',
            !jobNode?.recruiter?.workspaceMemberProfile
              ?.edges?.[0]?.node?.phoneNumber &&
              'Recruiter phone number is missing in workspace member profiles',
            !jobNode?.recruiter?.workspaceMemberProfile
              ?.edges?.[0]?.node?.companyDescription &&
              'Recruiter company description is missing in workspace member profiles',
            !jobNode?.recruiter?.workspaceMemberProfile
              ?.edges?.[0]?.node?.jobTitle &&
              'Recruiter job title is missing in workspace member profiles',



            // Prompts (named prompts fall back to defaults server-side)
            // jobNode?.prompt?.edges?.length === 0 &&
              // 'No prompts found',


        ]
            .filter(Boolean)
            .join('\n• ');

        if (consolidatedErrorMessage && consolidatedErrorMessage.trim().length > 0) {
          console.log(
            'Job validation failed. Please fix the following issues:\n\n• ',
            consolidatedErrorMessage,
          );
          enqueueSnackBar(
            `Job validation failed. Please fix the following issues:\n\n• ${consolidatedErrorMessage}`,
            {
              variant: SnackBarVariant.Error,
              duration: 10000,
            },
          );
          return false;
        }
        console.log('Successfully validated job data');
        enqueueSnackBar('Successfully validated job data', {
          variant: SnackBarVariant.Success,
          duration: 3000,
        });
        if (isDefined(onSuccess)) onSuccess();
        return true;
      } catch (error) {
        enqueueSnackBar('Error in validating job data', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
        if (isDefined(onError)) onError(error as Error);
        return false;
      }
    },
    [executeQuery, enqueueSnackBar, onSuccess, onError, apiKeys],
  );

  return { checkDataIntegrityOfJob };
};
