import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useState } from 'react';
import { useRecoilState } from 'recoil';
import {
    activeDripCampaignState
} from '../states/dripCampaignModalOpenState';

export const useEmailSequences = () => {
  const [activeCampaign, setActiveCampaign] = useRecoilState(activeDripCampaignState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);

  const createSequence = async (sequenceData: {
    name: string;
    subject: string;
    content: string;
    delayDays?: number;
    delayHours?: number;
    delayMinutes?: number;
    order: number;
    isActive?: boolean;
  }) => {
    if (!activeCampaign) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns/sequences`,
        {
          ...sequenceData,
          campaignId: activeCampaign.id,
        },
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      const newSequence = response.data;
      const updatedCampaign = {
        ...activeCampaign,
        emailSequences: [...activeCampaign.emailSequences, newSequence]
      };
      setActiveCampaign(updatedCampaign);
      
      return newSequence;
    } catch (err) {
      console.error('Error creating sequence:', err);
      setError('Failed to create email sequence');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateSequence = async (sequenceId: string, updateData: {
    name?: string;
    subject?: string;
    content?: string;
    delayDays?: number;
    delayHours?: number;
    delayMinutes?: number;
    order?: number;
    isActive?: boolean;
  }) => {
    if (!activeCampaign) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.put(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns/sequences/${sequenceId}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      const updatedSequence = response.data;
      const updatedCampaign = {
        ...activeCampaign,
        emailSequences: activeCampaign.emailSequences.map(seq =>
          seq.id === sequenceId ? updatedSequence : seq
        )
      };
      setActiveCampaign(updatedCampaign);
      
      return updatedSequence;
    } catch (err) {
      console.error('Error updating sequence:', err);
      setError('Failed to update email sequence');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSequence = async (sequenceId: string) => {
    if (!activeCampaign) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      await axios.delete(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns/sequences/${sequenceId}`,
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      const updatedCampaign = {
        ...activeCampaign,
        emailSequences: activeCampaign.emailSequences.filter(seq => seq.id !== sequenceId)
      };
      setActiveCampaign(updatedCampaign);
    } catch (err) {
      console.error('Error deleting sequence:', err);
      setError('Failed to delete email sequence');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const reorderSequences = async (sequenceIds: string[]) => {
    if (!activeCampaign) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.put(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns/campaigns/${activeCampaign.id}/sequences/reorder`,
        { sequenceIds },
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      const updatedSequences = response.data;
      const updatedCampaign = {
        ...activeCampaign,
        emailSequences: updatedSequences
      };
      setActiveCampaign(updatedCampaign);
      
      return updatedSequences;
    } catch (err) {
      console.error('Error reordering sequences:', err);
      setError('Failed to reorder email sequences');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getSequencesByCampaignId = async (campaignId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns/campaigns/${campaignId}/sequences`,
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      return response.data;
    } catch (err) {
      console.error('Error fetching sequences:', err);
      setError('Failed to fetch email sequences');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    createSequence,
    updateSequence,
    deleteSequence,
    reorderSequences,
    getSequencesByCampaignId,
  };
};
