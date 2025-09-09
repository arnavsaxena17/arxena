import { enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';

export type CandidateField = {
  name: string;
  label: string;
};

export const useFetchCandidateFields = () => {
  const [candidateFields, setCandidateFields] = useState<CandidateField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [tokenPair] = useRecoilState(tokenPairState);
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);

  const fetchCandidateFields = useCallback(async (jobId: string) => {
    try {
      console.log('fetching candidate fields for job ID:', jobId);
      setIsLoadingFields(true);
      setApiError(null);
      
      if (jobId) {
        try {
          const response = await axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-candidate-fields-by-job`,
            { jobId },
            { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPair?.accessToken?.token}`, } }
          );
          
          console.log('Response from fetch candidate fields:', response.data);
          
          if (response.data.status === 'Success' && response.data.candidateFields) {
            console.log('Received candidate fields:', response?.data?.candidateFields);
            setCandidateFields(response.data.candidateFields);
            
            // Update enrichments with jobId and candidateFields
            setEnrichments(prev => prev.map(enrichment => ({
              ...enrichment,
              jobId: jobId,
              candidateFields: response.data.candidateFields
            })));
          } else {
            console.warn('No fields returned from API or unexpected response format');
            setApiError('No custom fields found for this job');
          }
        } catch (error) {
          console.error('Error fetching candidate fields:', error);
          setApiError('Error fetching candidate fields');
        }
      } else {
        console.warn('No job ID provided');
        setApiError('No job ID provided');
      }
    } catch (error) {
      console.error('Error in fetchCandidateFields:', error);
      setApiError('Unexpected error occurred');
    } finally {
      setIsLoadingFields(false);
    }
  }, [tokenPair?.accessToken?.token, setEnrichments]);

  return {
    candidateFields,
    isLoadingFields,
    apiError,
    fetchCandidateFields,
    setCandidateFields,
    setApiError
  };
};
