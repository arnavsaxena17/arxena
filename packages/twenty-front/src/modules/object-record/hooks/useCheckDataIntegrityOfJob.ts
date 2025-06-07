import { tokenPairState } from '@/auth/states/tokenPairState';
import { useCallback } from 'react';
import { useRecoilState } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { gql, useLazyQuery } from '@apollo/client';
import { graphqlToFindManyJobs, isDefined } from 'twenty-shared';

type UseCheckDataIntegrityOfJobProps = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export const useCheckDataIntegrityOfJob = ({
  onSuccess,
  onError,
}: UseCheckDataIntegrityOfJobProps = {}) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const { enqueueSnackBar } = useSnackBar();
  console.log('checking data integrity of job', tokenPair);
  const [executeQuery, { error, data }] = useLazyQuery(gql`
    ${graphqlToFindManyJobs}
  `);

  const checkDataIntegrityOfJob = useCallback(
    async (recordIds: string[]) => {
      try {
        const { data } = await executeQuery({
          variables: {
            filter: { id: { in: recordIds } },
            limit: 30,
            orderBy: [{ position: 'AscNullsFirst' }],
          },
        });
        console.log('data from data integrity check of the damn job', data);
        if (isDefined(data)) {
          const response = await fetch(
            process.env.REACT_APP_SERVER_BASE_URL +
              '/workspace-modifications/api-keys',
            {
              headers: {
                Accept: '*/*',
                Authorization: `Bearer ${tokenPair?.accessToken?.token}`,
              },
            },
          );
          const apiKeys = await response.json();
          console.log('apiKeys', apiKeys);
          console.log('data from data integrity check of the damn job', data);
          const chatFlowOrder = data?.jobs?.edges?.[0]?.node?.chatFlowOrder;
          const hasMeetingScheduling = chatFlowOrder?.includes('startMeetingSchedulingChat');
          const hasVideoInterview = chatFlowOrder?.includes('startVideoInterviewChat');

          const consolidatedErrorMessage = [
            // API Keys
            !apiKeys?.openaikey && 'OpenAI API key is missing',
            !apiKeys?.facebook_whatsapp_phone_number_id &&
              'WhatsApp phone number ID is missing',
            !apiKeys?.facebook_whatsapp_asset_id &&
              'WhatsApp facebook_whatsapp_asset_id ID is missing',
            !apiKeys?.facebook_whatsapp_api_token &&
              'WhatsApp API token is missing',

            // Basic job validation
            !data?.jobs?.edges?.[0]?.node && 'Job data is missing or malformed',

            // Job details
            !data?.jobs?.edges?.[0]?.node?.attachments?.edges &&
              'Attachments data structure is missing',
            data?.jobs?.edges?.[0]?.node?.attachments?.edges?.length === 0 &&
              'No JD attachment found',
            !data?.jobs?.edges?.[0]?.node?.jobCode && 'Job code is missing',
            !data?.jobs?.edges?.[0]?.node?.jobLocation &&
              'Job location is missing',
            (!data?.jobs?.edges?.[0]?.node?.chatFlowOrder ||
              !Array.isArray(data?.jobs?.edges?.[0]?.node?.chatFlowOrder) ||
              data?.jobs?.edges?.[0]?.node?.chatFlowOrder?.length === 0) &&
              'Chat flow order is missing',
            !data?.jobs?.edges?.[0]?.node?.companyId && 'Company ID is missing',
            data?.jobs?.edges?.[0]?.node?.isActive === false &&
              'Job is not active',

            // Company details
            !data?.jobs?.edges?.[0]?.node?.company?.descriptionOneliner &&
              'Company description is missing',

            // Interview schedule - only validate if meeting scheduling is in chat flow
            hasMeetingScheduling && !data?.jobs?.edges?.[0]?.node?.interviewSchedule?.edges &&
              'Interview schedule data structure is missing',
            hasMeetingScheduling && data?.jobs?.edges?.[0]?.node?.interviewSchedule?.edges?.length === 0 && 
              'Interview schedule is missing',
            hasMeetingScheduling && !data?.jobs?.edges?.[0]?.node?.interviewSchedule?.edges?.[0]?.node?.slotsAvailable && 
              'Interview slots are not available',
            hasMeetingScheduling && !data?.jobs?.edges?.[0]?.node?.interviewSchedule?.edges?.[0]?.node?.meetingType && 
              'Meeting type is not specified',

            // Recruiter
            !data?.jobs?.edges?.[0]?.node?.recruiterId &&
              'Recruiter ID is missing',

            // Questions
            // !data?.jobs?.edges?.[0]?.node?.questions?.edges &&
            //   'Questions data structure is missing',
            // data?.jobs?.edges?.[0]?.node?.questions?.edges?.length === 0 &&
            //   'No questions attached',

            // Video interview template - only validate if video interview is in chat flow
            hasVideoInterview && !data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges &&
              'Video interview template data structure is missing',
            hasVideoInterview && data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.length === 0 && 
              'No video interview template attached',
            hasVideoInterview && !data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.[0]?.node && 
              'Video interview template node is missing',
            hasVideoInterview && !data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewModelId &&
              'Video interview model ID is missing',
            hasVideoInterview && !data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.[0]?.node?.instructions &&
              'Video interview instructions are missing',

            // Video interview questions
            hasVideoInterview && !data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges &&
              'Video interview questions data structure is missing',
            hasVideoInterview && data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges?.length === 0 &&
              'No video interview questions found',
            hasVideoInterview && data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges?.some(
              (edge: { node: { questionValue: any } }) =>
                !edge?.node?.questionValue,
            ) && 'One or more video interview questions are empty',
            hasVideoInterview && data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.[0]?.node?.videoInterviewQuestions?.edges?.some(
              (edge: { node: { attachments: { edges: string | any[] } } }) =>
                !edge?.node?.attachments?.edges ||
                edge?.node?.attachments?.edges?.length === 0,
            ) && 'Video attachments missing for interview questions',

            // Video interview introduction
            hasVideoInterview && !data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.[0]?.node?.introduction &&
              'Video interview introduction text is missing',
            hasVideoInterview && (!data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.[0]?.node?.attachments?.edges ||
              data?.jobs?.edges?.[0]?.node?.videoInterviewTemplate?.edges?.[0]?.node?.attachments?.edges?.length === 0) &&
              'Video interview introduction video is missing',

            // Recruiter profile
            !data?.jobs?.edges?.[0]?.node?.recruiter?.workspaceMemberProfile
              ?.edges?.[0]?.node?.name &&
              'Recruiter name is missing in workspace member profiles',
            !data?.jobs?.edges?.[0]?.node?.recruiter?.workspaceMemberProfile
              ?.edges?.[0]?.node?.phoneNumber &&
              'Recruiter phone number is missing in workspace member profiles',
            !data?.jobs?.edges?.[0]?.node?.recruiter?.workspaceMemberProfile
              ?.edges?.[0]?.node?.companyDescription &&
              'Recruiter company description is missing in workspace member profiles',
            !data?.jobs?.edges?.[0]?.node?.recruiter?.workspaceMemberProfile
              ?.edges?.[0]?.node?.jobTitle &&
              'Recruiter job title is missing in workspace member profiles',

            // Prompts
            !data?.jobs?.edges?.[0]?.node?.prompt?.edges &&
              'Prompts data structure is missing',
            data?.jobs?.edges?.[0]?.node?.prompt?.edges?.length === 0 &&
              'No prompts found',
            !data?.jobs?.edges?.[0]?.node?.prompt?.edges?.some(
              (edge: { node: { name: string } }) =>
                edge?.node?.name === 'PROMPT_FOR_CHAT_CLASSIFICATION',
            ) && 'Chat classification prompt is missing',
            !data?.jobs?.edges?.[0]?.node?.prompt?.edges?.some(
              (edge: { node: { name: string } }) =>
                edge?.node?.name === 'ONLINE_MEETING_PROMPT',
            ) && 'Online meeting prompt is missing',
            !data?.jobs?.edges?.[0]?.node?.prompt?.edges?.some(
              (edge: { node: { name: string } }) =>
                edge?.node?.name === 'IN_PERSON_MEETING_SCHEDULING_PROMPT',
            ) && 'In-person meeting prompt is missing',
            !data?.jobs?.edges?.[0]?.node?.prompt?.edges?.some(
              (edge: { node: { name: string } }) =>
                edge?.node?.name === 'START_CHAT_PROMPT',
            ) && 'Start chat prompt is missing',
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
          } else {
            console.log('Successfully validated job data');
            enqueueSnackBar('Successfully validated job data', {
              variant: SnackBarVariant.Success,
              duration: 3000,
            });
            if (isDefined(onSuccess)) onSuccess();
          }
        }
      } catch (error) {
        enqueueSnackBar('Error in validating job data', {
          variant: SnackBarVariant.Error,
          duration: 5000,
        });
        if (isDefined(onError)) onError(error as Error);
      }
    },
    [executeQuery, enqueueSnackBar, onSuccess, onError],
  );

  return { checkDataIntegrityOfJob };
};
