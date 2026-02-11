import { enrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
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
    // Skip invalid jobIds to prevent unnecessary API calls
    if (!jobId || jobId === 'job-id' || jobId === 'undefined' || jobId === 'null') {
      console.log('Skipping fetchCandidateFields for invalid jobId:', jobId);
      return;
    }
    
    try {
      console.log('fetching candidate fields for job ID:', jobId);
      setIsLoadingFields(true);
      setApiError(null);
      
      if (jobId) {
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-candidate-fields-by-job`,
          { jobId },
          { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPair?.accessToken?.token}`, } }
        );
        
        console.log('Response from fetch candidate fields:', response.data);
        
        if (response.data.status === 'Success' && response.data.candidateFields) {
          console.log('Received candidate fields:', response?.data?.candidateFields);
          setCandidateFields(response.data.candidateFields);
          setApiError(null); // Clear any previous errors on success
          
          // Update enrichments with jobId and candidateFields only if they've changed
          setEnrichments(prev => {
            const updated = prev.map(enrichment => ({
              ...enrichment,
              jobId: jobId,
              candidateFields: response.data.candidateFields
            }));
            
            // Only update if there are actual changes to prevent unnecessary re-renders
            const hasChanges = prev.some((enrichment, index) => 
              enrichment.jobId !== updated[index].jobId || 
              JSON.stringify(enrichment.candidateFields) !== JSON.stringify(updated[index].candidateFields)
            );
            
            return hasChanges ? updated : prev;
          });
        } else if (response.data.status === 'Failed') {
          console.warn('API returned error:', response.data.message || response.data.error);
          setApiError(response.data.message || response.data.error || 'Failed to fetch candidate fields');
        } else {
          console.warn('No fields returned from API or unexpected response format');
          setApiError('No custom fields found for this job');
        }
      } else {
        console.warn('No job ID provided');
        setApiError('No job ID provided');
      }
    } catch (error) {
      console.error('Error fetching candidate fields:', error);
      setApiError('Error fetching candidate fields');
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
