import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
    activeDripCampaignState,
    campaignMetricsState,
    currentJobIdForDripState,
    dripCampaignsState
} from '../states/dripCampaignModalOpenState';

export const useDripCampaigns = () => {
  const [campaigns, setCampaigns] = useRecoilState(dripCampaignsState);
  const [activeCampaign, setActiveCampaign] = useRecoilState(activeDripCampaignState);
  const [metrics, setMetrics] = useRecoilState(campaignMetricsState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);
  const jobId = useRecoilValue(currentJobIdForDripState);

  const fetchCampaigns = async () => {
    if (!jobId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns`,
        {
          params: { jobId },
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      setCampaigns(response.data);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError('Failed to fetch campaigns');
    } finally {
      setIsLoading(false);
    }
  };

  const createCampaign = async (campaignData: {
    name: string;
    description?: string;
  }) => {
    if (!jobId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns`,
        {
          ...campaignData,
          jobId,
        },
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      const newCampaign = response.data;
      setCampaigns(prev => [...prev, newCampaign]);
      setActiveCampaign(newCampaign);
      
      return newCampaign;
    } catch (err) {
      console.error('Error creating campaign:', err);
      setError('Failed to create campaign');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const updateCampaign = async (campaignId: string, updateData: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.put(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns/${campaignId}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      const updatedCampaign = response.data;
      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignId ? updatedCampaign : campaign
        )
      );
      
      if (activeCampaign?.id === campaignId) {
        setActiveCampaign(updatedCampaign);
      }
      
      return updatedCampaign;
    } catch (err) {
      console.error('Error updating campaign:', err);
      setError('Failed to update campaign');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      await axios.delete(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns/${campaignId}`,
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      setCampaigns(prev => prev.filter(campaign => campaign.id !== campaignId));
      
      if (activeCampaign?.id === campaignId) {
        setActiveCampaign(null);
      }
    } catch (err) {
      console.error('Error deleting campaign:', err);
      setError('Failed to delete campaign');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const startCampaign = async (campaignId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns/${campaignId}/start`,
        {},
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      const updatedCampaign = response.data;
      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignId ? updatedCampaign : campaign
        )
      );
      
      if (activeCampaign?.id === campaignId) {
        setActiveCampaign(updatedCampaign);
      }
      
      return updatedCampaign;
    } catch (err) {
      console.error('Error starting campaign:', err);
      setError('Failed to start campaign');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const pauseCampaign = async (campaignId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns/${campaignId}/pause`,
        {},
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      const updatedCampaign = response.data;
      setCampaigns(prev => 
        prev.map(campaign => 
          campaign.id === campaignId ? updatedCampaign : campaign
        )
      );
      
      if (activeCampaign?.id === campaignId) {
        setActiveCampaign(updatedCampaign);
      }
      
      return updatedCampaign;
    } catch (err) {
      console.error('Error pausing campaign:', err);
      setError('Failed to pause campaign');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCampaignMetrics = async (campaignId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_SERVER_BASE_URL}/drip-campaigns/${campaignId}/metrics`,
        {
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
        }
      );
      
      const campaignMetrics = response.data;
      setMetrics(prev => 
        prev.filter(m => m.campaignId !== campaignId).concat(campaignMetrics)
      );
      
      return campaignMetrics;
    } catch (err) {
      console.error('Error fetching campaign metrics:', err);
      setError('Failed to fetch campaign metrics');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) {
      fetchCampaigns();
    }
  }, [jobId]);

  return {
    campaigns,
    activeCampaign,
    metrics,
    isLoading,
    error,
    setActiveCampaign,
    fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    pauseCampaign,
    fetchCampaignMetrics,
  };
};
