import { AppErrorBoundary } from '@/error-handler/components/AppErrorBoundary';
import { AppErrorDisplay } from '@/error-handler/components/internal/AppErrorDisplay';
import { type AppErrorDisplayProps } from '@/error-handler/types/AppErrorDisplayProps';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledWorkflowStepBody = styled.div<{
  rowGap?: string;
  display?: string;
  overflow?: string;
  paddingBlock?: string;
  paddingInline?: string;
  gridTemplateRows?: string;
  gridTemplateColumns?: string;
}>`
  background: ${themeCssVariables.background.primary};
  display: ${({ display }) => display ?? 'flex'};
  flex: 1 1 auto;
  flex-direction: column;
  grid-template-columns: ${({ gridTemplateColumns }) =>
    gridTemplateColumns ?? 'none'};
  grid-template-rows: ${({ gridTemplateRows }) => gridTemplateRows ?? 'none'};
  height: 100%;
  min-width: 0;
  overflow: ${({ overflow }) => overflow ?? 'hidden scroll'};
  padding-block: ${({ paddingBlock }) =>
    paddingBlock ?? themeCssVariables.spacing[4]};
  padding-inline: ${({ paddingInline }) =>
    paddingInline ?? themeCssVariables.spacing[3]};
  row-gap: ${({ rowGap }) => rowGap ?? themeCssVariables.spacing[4]};
`;

export const WorkflowStepBody = ({
  children,
  rowGap,
  display,
  overflow,
  paddingBlock,
  paddingInline,
  gridTemplateRows,
  gridTemplateColumns,
}: {
  children: React.ReactNode;
  rowGap?: string;
  display?: string;
  overflow?: string;
  paddingBlock?: string;
  paddingInline?: string;
  gridTemplateRows?: string;
  gridTemplateColumns?: string;
}) => {
  return (
    <StyledWorkflowStepBody
      rowGap={rowGap}
      display={display}
      overflow={overflow}
      paddingBlock={paddingBlock}
      paddingInline={paddingInline}
      gridTemplateRows={gridTemplateRows}
      gridTemplateColumns={gridTemplateColumns}
    >
      <AppErrorBoundary
        resetOnLocationChange={true}
        FallbackComponent={({
          error,
          resetErrorBoundary,
          title,
        }: AppErrorDisplayProps) => (
          <AppErrorDisplay
            error={error}
            resetErrorBoundary={resetErrorBoundary}
            title={title}
          />
        )}
      >
        {children}
      </AppErrorBoundary>
    </StyledWorkflowStepBody>
  );
};
