import { currentProjectIdState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { buildSelectedMetadataFieldsForPersist } from '@/arx-ai-filtering/utils/resumeMetadata';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { TableState, tableStateAtom } from '@/candidate-table/states/states';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useState } from 'react';
import { OtherFieldKey, TokenAnalysis } from '../types';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const useApiCalls = (index: number, onError: (error: string) => void) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComputingTokens, setIsComputingTokens] = useState(false);
  const [tokenAnalysis, setTokenAnalysis] = useState<TokenAnalysis | null>(
    null,
  );

  const currentProjectId = useAtomStateValue(currentProjectIdState);
  const [tokenPair] = useAtomState(tokenPairState);
  const tableState = useAtomStateValue<TableState>(tableStateAtom);

  const getSelectedOrAllRecordIds = () => {
    return tableState?.selectedRowIds?.length > 0
      ? tableState.selectedRowIds
      : tableState?.rawData?.map((row) => row.id) || [];
  };

  const processAIFilter = async (
    filterDescription: string,
    otherFieldKeys: OtherFieldKey[],
  ) => {
    if (!filterDescription) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/process-filter-description`,
        {
          filterDescription,
          otherFieldKeys: otherFieldKeys.map((field) => field.name),
        },
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          },
        },
      );

      if (response.data?.status === 'success' && response.data?.data) {
        console.log(
          'Response data from process AI filter:',
          response.data.data,
        );
        return response.data.data;
      } else {
        throw new Error(response.data?.error || 'Failed to process AI filter');
      }
    } catch (error) {
      console.error('Error processing AI filter:', error);
      onError(
        error instanceof Error ? error.message : 'Failed to process AI filter',
      );
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const computeTokens = async (enrichment: any) => {
    if (!enrichment?.modelName) {
      return;
    }

    setIsComputingTokens(true);
    try {
      const selectedRecordIds = getSelectedOrAllRecordIds();

      const response = await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/compute-tokens`,
        {
          enrichments: [
            {
              ...enrichment,
              selectedMetadataFields:
                buildSelectedMetadataFieldsForPersist(enrichment),
            },
          ],
          selectedRecordIds,
          projectId: currentProjectId,
        },
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
          },
        },
      );

      if (response.data?.status === 'success' && response.data?.data) {
        setTokenAnalysis(response.data.data);
        return response.data.data;
      }
    } catch (error) {
      console.error('Error computing tokens:', error);
      onError(
        error instanceof Error ? error.message : 'Failed to compute tokens',
      );
      throw error;
    } finally {
      setIsComputingTokens(false);
    }
  };

  return {
    isProcessing,
    isComputingTokens,
    tokenAnalysis,
    setTokenAnalysis,
    processAIFilter,
    computeTokens,
  };
};
