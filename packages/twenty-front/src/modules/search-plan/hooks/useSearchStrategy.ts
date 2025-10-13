import { ParsedJobDescription } from '@/arx-jd-upload/hooks/useJobDescriptionParser';
import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  currentSearchStrategyState,
  strategyExecutionResultState,
  strategyExecutionStatusState
} from '@/candidate-table/states/states';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { SearchStrategyTree, StrategyExecutionResult } from '../types/SearchStrategy';

export const useSearchStrategy = () => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentStrategy, setCurrentStrategy] = useRecoilState(currentSearchStrategyState);
  const [executionStatus, setExecutionStatus] = useRecoilState(strategyExecutionStatusState);
  const setExecutionResult = useSetRecoilState(strategyExecutionResultState);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load strategy from backend
   */
  const loadStrategy = useCallback(async (searchFilterId: string): Promise<SearchStrategyTree | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get(
        `${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${searchFilterId}`,
        { 
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } 
        }
      );

      if (response.data?.data?.searchStrategy) {
        const strategy = response.data.data.searchStrategy;
        setCurrentStrategy(strategy);
        return strategy;
      }

      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load strategy';
      setError(errorMessage);
      console.error('Error loading strategy:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [tokenPair, setCurrentStrategy]);

  /**
   * Save strategy to backend
   */
  const saveStrategy = useCallback(async (
    searchFilterId: string, 
    treeData: SearchStrategyTree
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.put(
        `${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${searchFilterId}`,
        { searchStrategy: treeData },
        { 
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } 
        }
      );

      if (response.data?.status === 'success') {
        setCurrentStrategy(treeData);
        return true;
      }

      return false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save strategy';
      setError(errorMessage);
      console.error('Error saving strategy:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [tokenPair, setCurrentStrategy]);

  /**
   * Execute strategy with parsed job description
   */
  const executeStrategy = useCallback(async (
    searchFilterId: string,
    parsedJD: ParsedJobDescription
  ): Promise<StrategyExecutionResult | null> => {
    try {
      setIsLoading(true);
      setError(null);
      setExecutionStatus({ isExecuting: true, progress: 0, currentNode: null });

      const response = await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${searchFilterId}/execute-strategy`,
        { parsedJD },
        { 
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } 
        }
      );

      if (response.data?.status === 'success') {
        const result = response.data.data;
        setExecutionResult(result);
        setExecutionStatus({ isExecuting: false, progress: 100, currentNode: null });
        return result;
      }

      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute strategy';
      setError(errorMessage);
      setExecutionStatus({ isExecuting: false, progress: 0, currentNode: null });
      console.error('Error executing strategy:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [tokenPair, setExecutionResult, setExecutionStatus]);

  /**
   * Get execution status (for polling)
   */
  const getExecutionStatus = useCallback(async (searchFilterId: string) => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${searchFilterId}/execution-status`,
        { 
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } 
        }
      );

      return response.data?.data || null;
    } catch (err) {
      console.error('Error getting execution status:', err);
      return null;
    }
  }, [tokenPair]);

  /**
   * Load strategy templates
   */
  const loadStrategyTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get(
        `${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/strategy-templates`,
        { 
          headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` } 
        }
      );

      if (response.data?.status === 'success') {
        return response.data.data;
      }

      return [];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load templates';
      setError(errorMessage);
      console.error('Error loading strategy templates:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [tokenPair]);

  /**
   * Create strategy from template
   */
  const createStrategyFromTemplate = useCallback(async (
    searchFilterId: string,
    templateId: string
  ): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const templates = await loadStrategyTemplates();
      const template = templates.find((t: any) => t.id === templateId);
      
      if (!template) {
        setError('Template not found');
        return false;
      }

      return await saveStrategy(searchFilterId, template.tree);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create strategy from template';
      setError(errorMessage);
      console.error('Error creating strategy from template:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadStrategyTemplates, saveStrategy]);

  /**
   * Clear current strategy
   */
  const clearStrategy = useCallback(() => {
    setCurrentStrategy(null);
    setExecutionResult(null);
    setExecutionStatus({ isExecuting: false, progress: 0, currentNode: null });
    setError(null);
  }, [setCurrentStrategy, setExecutionResult, setExecutionStatus]);

  return {
    // State
    currentStrategy,
    executionStatus,
    isLoading,
    error,
    
    // Actions
    loadStrategy,
    saveStrategy,
    executeStrategy,
    getExecutionStatus,
    loadStrategyTemplates,
    createStrategyFromTemplate,
    clearStrategy,
    
    // Utilities
    setError,
  };
};
