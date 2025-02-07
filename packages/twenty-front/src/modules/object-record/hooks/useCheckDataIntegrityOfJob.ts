import { useCallback, useState } from 'react';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilState, useRecoilValue } from 'recoil';
// import { useShowNotification } from '@/notification/hooks/useShowNotification'; 
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { gql, useQuery , useLazyQuery} from '@apollo/client';
import { FIND_MANY_JOBS_QUERY } from '../graphql/queries/findManyJobsForDataIntegrity';



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

  const [executeQuery, { error, data }] = useLazyQuery(FIND_MANY_JOBS_QUERY);

  const checkDataIntegrityOfJob = useCallback(async (recordIds: string[]) => {
    try {
      const { data } = await executeQuery({
        variables: {
          filter: {
            id: {
              in: recordIds
            }
          },
          limit: 30,
          orderBy: [
            {
              position: "AscNullsFirst"
            }
          ]
        }
      });

      console.log("data from data integrity check of the damn job", data);

      if (data) {

        const response = await fetch(process.env.REACT_APP_SERVER_BASE_URL+'/workspace-modifications/api-keys', { headers: { 'Accept': '*/*', 'Authorization': `Bearer ${tokenPair?.accessToken?.token}`, } });
        const apiKeys = await response.json();
        if (!apiKeys.openaikey || !apiKeys.facebook_whatsapp_phone_number_id || !apiKeys.facebook_whatsapp_api_token) {
          console.log('Missing required API keys')
          enqueueSnackBar('Missing required API keys', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        // check if Has an attachment

        if (data.jobs.edges[0].node.attachments.edges.length === 0) {
          console.log('Has no JD as attachment')
          enqueueSnackBar('Has no JD as attachment', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        // Are whatsapp message elements (one liner description,// jobLocation, jobCode etc. avialable)
        if (data.jobs.edges[0].node.jobCode === "") {
          console.log('Has no jobCode')
          enqueueSnackBar('Has no jobCode', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        // Are whatsapp message elements (one liner description,// jobLocation, jobCode etc. avialable)
        if (data.jobs.edges[0].node.jobLocation === "") {
          console.log('Has no jobLocation')
          enqueueSnackBar('Has no jobLocation', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        // Are whatsapp message elements (one liner description,// jobLocation, jobCode etc. avialable)
        if (data.jobs.edges[0].node.companyId === null) {
          console.log('Has no companyId')
          enqueueSnackBar('Has no companyId', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        // Are whatsapp message elements (one liner description,// jobLocation, jobCode etc. avialable)
        if (data.jobs.edges[0].node.isActive === false) {
          console.log('Has no isActive')
          enqueueSnackBar('Has no isActive', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        // Are whatsapp message elements (one liner description,// jobLocation, jobCode etc. avialable)
        if (data.jobs.edges[0].node.company.descriptionOneliner === "") {
          console.log('Job company has no descriptionOneliner')
          enqueueSnackBar('Job company has no descriptionOneliner', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        // Are whatsapp message elements (one liner description,// jobLocation, jobCode etc. avialable)
        if (!data.jobs.edges[0]?.node) {
          console.log('Job node is missing')
          enqueueSnackBar('Job node is missing', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
          return;
        }

        if (data.jobs.edges[0].node.recruiterId === null) {
          console.log('Has no recruiterId')
          enqueueSnackBar('Has no recruiterId', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        if (!data.jobs.edges[0].node.questions?.edges) {
          console.log('Questions edges are missing')
          enqueueSnackBar('Questions edges are missing', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
          return;
        }
        
        if (data.jobs.edges[0].node.questions.edges.length === 0) {
          console.log('Has no questions attached')
          enqueueSnackBar('Has no questions attached', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }

        if (!data.jobs.edges[0].node.videoInterviewTemplate?.edges) {
          console.log('Video interview template edges are missing')
          enqueueSnackBar('Video interview template edges are missing', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
          return;
        }
        
        if (data.jobs.edges[0].node.videoInterviewTemplate.edges.length === 0) {
          console.log('Has no videoInterviewTemplates attached')
          enqueueSnackBar('Has no videoInterviewTemplates attached', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }

        if (!data.jobs.edges[0].node.videoInterviewTemplate.edges[0]?.node) {
          console.log('Video interview template node is missing')
          enqueueSnackBar('Video interview template node is missing', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
          return;
        }

        if (data.jobs.edges[0].node.videoInterviewTemplate.edges[0].node.videoInterviewModelId === null) {
          console.log('Jobs videoInterviewTemplate has no videoInterviewModelId attached')
          enqueueSnackBar('Jobs videoInterviewTemplate has no videoInterviewModelId attached', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        if (data.jobs.edges[0].node.videoInterviewTemplate.edges[0].node.instructions === '') {
          console.log('Has no videoInterviewTemplate instructions')
          enqueueSnackBar('Has no videoInterviewTemplate instructions', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        if (!data.jobs.edges[0].node.videoInterviewTemplate.edges[0].node.videoInterviewQuestions?.edges) {
          console.log('Video interview questions edges are missing')
          enqueueSnackBar('Video interview questions edges are missing', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
          return;
        }

        if (data.jobs.edges[0].node.videoInterviewTemplate.edges[0].node.videoInterviewQuestions.edges.length === 0) {
          console.log('Has no videoInterviewQuestions')
          enqueueSnackBar('Has no videoInterviewQuestions', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        if (data.jobs.edges[0].node.videoInterviewTemplate.edges[0].node.videoInterviewQuestions.edges.some((edge: { node: { questionValue: string; }; }) => edge.node.questionValue === "")) {
          console.log('Has no videoInterviewQuestions question value')
          enqueueSnackBar('Has no videoInterviewQuestions question value', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        // if (data.jobs.edges[0].node.videoInterviewTemplate.edges[0].node.videoInterviewQuestions.edges.some((edge: { node: { questionType: string; }; }) => edge.node.questionType === null)) {
        //   console.log('Has no videoInterviewQuestions question questionType')
        //   enqueueSnackBar('Has no videoInterviewQuestions question questionType', {
        //     variant: SnackBarVariant.Error,
        //     duration: 3000,
        //   });
        // }

        if (data.jobs.edges[0].node.videoInterviewTemplate.edges[0].node.videoInterviewQuestions.edges.some((edge: { node: { attachments: { edges: string | any[]; }; }; }) => edge.node.attachments.edges.length === 0)) {
          console.log('Has no videoInterviewQuestions question video')
          enqueueSnackBar('Has no videoInterviewQuestions question video', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        if (data.jobs.edges[0].node.videoInterviewTemplate.edges[0].node.introduction === '') {
          console.log('Has no videoInterview introduction')
          enqueueSnackBar('Has no videoInterview introduction', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        if (data.jobs.edges[0].node.videoInterviewTemplate.edges[0].node.attachments.edges.length === 0) {
          console.log('Has no videoInterview introduction video')
          enqueueSnackBar('Has no videoInterview introduction video', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }

        if (data.jobs.edges[0].node.prompt.edges.length === 0) {
          console.log('Has no prompts')
          enqueueSnackBar('Has no prompts', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
          return ;
        }
        
        if (!data.jobs.edges[0].node.prompt.edges.some((edge: { node: { name: string } }) => edge.node.name === "PROMPT_FOR_CHAT_CLASSIFICATION")) {
          console.log('Has no prompt for chat classifciation')
          enqueueSnackBar('Has no prompt for chat classifciation', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        if (!data.jobs.edges[0].node.prompt.edges.some((edge: { node: { name: string } }) => edge.node.name === "ONLINE_MEETING_PROMPT")) {
          console.log('Has no online meeting prompts')
          enqueueSnackBar('Has no online meeting prompts', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        if (!data.jobs.edges[0].node.prompt.edges.some((edge: { node: { name: string } }) => edge.node.name === "IN_PERSON_MEETING_SCHEDULING_PROMPT")) {
          console.log('Has no inperson meeting prompts')
          enqueueSnackBar('Has no inperson meeting prompts', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        
        if (!data.jobs.edges[0].node.prompt.edges.some((edge: { node: { name: string } }) => edge.node.name === "START_CHAT_PROMPT")) {
          console.log('Has no startchat prompts')
          enqueueSnackBar('Has no startchat prompts', {
            variant: SnackBarVariant.Error,
            duration: 3000,
          });
        }
        





        // has JD been uploaded in the job object
        // has the job been assigned to a recruiter
        // is facebook API keys available
        // Is facebook phone number available
        // Is job connected to company
        // is google accoutn connected
        // Is port open for incoming whatsapp messages
        // Are job questions created
        // Is video interview questions created
        // Is video interview model tied up with the job
        // Is video interview introduciton video, text available
        // Is video interview questions video available
        // Are the prompts attached to the job
        // shortlist creation datasets are available
        // interview schedule/ client interview dates and slots are available?












        console.log('Successfully created job object')
        enqueueSnackBar('Successfully created job object', {
          variant: SnackBarVariant.Success,
          duration: 3000,
        });
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      enqueueSnackBar("Error in creating job object", {
        variant: SnackBarVariant.Error,
        duration: 5000,
      });
      if (onError) onError(error as Error);
    }
  }, [executeQuery, enqueueSnackBar, onSuccess, onError]);

  return { checkDataIntegrityOfJob };
};
