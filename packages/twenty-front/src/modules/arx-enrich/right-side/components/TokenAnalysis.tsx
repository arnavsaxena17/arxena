import { IconLoader2 } from '@tabler/icons-react';
import { Button } from '@ui/input/button/components/Button';
import React from 'react';
import { TokenAnalysis as TokenAnalysisType } from '../types';
import {
    CodeBlock,
    LoadingContainer,
    ModelCodeDisplay,
    SectionGap,
    SelectLabel,
    TokenUsageContainer,
    TokenUsageLabel,
    TokenUsageRow,
    TokenUsageSection,
    TokenUsageTitle,
    TokenUsageValue
} from './StyledComponents';

type TokenAnalysisProps = {
  show: boolean;
  modelCode: string;
  isComputingTokens: boolean;
  tokenAnalysis: TokenAnalysisType | null;
  onComputeTokens: () => void;
};

export const TokenAnalysisComponent: React.FC<TokenAnalysisProps> = ({
  show,
  modelCode,
  isComputingTokens,
  tokenAnalysis,
  onComputeTokens
}) => {
  return (
    <ModelCodeDisplay show={show}>
      <SelectLabel>Generated Model Code</SelectLabel>
      <CodeBlock>
        <pre>{modelCode}</pre>
      </CodeBlock>
      
      <Button
        variant="primary"
        title="Compute Token Usage"
        onClick={onComputeTokens}
        disabled={isComputingTokens}
        type="button"
      >
        {isComputingTokens ? 'Computing...' : 'Compute Token Usage'}
      </Button>
      
      {isComputingTokens ? (
        <LoadingContainer>
          <IconLoader2 style={{ animation: 'spin 1s linear infinite' }} />
          Computing token usage...
        </LoadingContainer>
      ) : tokenAnalysis && (
        <>
          <SectionGap />
          <SelectLabel>Cost Analysis</SelectLabel>
          <TokenUsageContainer>
            <TokenUsageSection>
              <TokenUsageTitle>Token Usage Estimation</TokenUsageTitle>
              <TokenUsageRow>
                <TokenUsageLabel>Input Tokens</TokenUsageLabel>
                <TokenUsageValue>{tokenAnalysis.total_input_tokens.toLocaleString()}</TokenUsageValue>
              </TokenUsageRow>
              <TokenUsageRow>
                <TokenUsageLabel>Output Tokens</TokenUsageLabel>
                <TokenUsageValue>{tokenAnalysis.total_output_tokens.toLocaleString()}</TokenUsageValue>
              </TokenUsageRow>
              <TokenUsageRow>
                <TokenUsageLabel>Total Candidates</TokenUsageLabel>
                <TokenUsageValue>{tokenAnalysis.total_candidates}</TokenUsageValue>
              </TokenUsageRow>
            </TokenUsageSection>

            <TokenUsageSection>
              <TokenUsageTitle>Cost Statistics (USD)</TokenUsageTitle>
              <TokenUsageRow>
                <TokenUsageLabel>Total Cost</TokenUsageLabel>
                <TokenUsageValue>${tokenAnalysis.total_cost.toFixed(4)}</TokenUsageValue>
              </TokenUsageRow>
              <TokenUsageRow>
                <TokenUsageLabel>Mean Cost per Candidate</TokenUsageLabel>
                <TokenUsageValue>${tokenAnalysis.cost_statistics.mean_cost.toFixed(4)}</TokenUsageValue>
              </TokenUsageRow>
            </TokenUsageSection>
          </TokenUsageContainer>
        </>
      )}
    </ModelCodeDisplay>
  );
};
