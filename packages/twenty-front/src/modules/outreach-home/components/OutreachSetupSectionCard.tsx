import { styled } from '@linaria/react';
import { type ReactNode } from 'react';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

// Twenty settings-page section: H2Title header with the controls flowing
// underneath (no surrounding card), separated by the page gap.

const StyledHeaderRow = styled.div`
  align-items: flex-start;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
`;

const StyledHeaderMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const StyledHeaderAction = styled.div`
  flex-shrink: 0;
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
`;

type OutreachSetupSectionCardProps = {
  title: string;
  description?: string;
  headerAdornment?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
};

export const OutreachSetupSectionCard = ({
  title,
  description,
  headerAdornment,
  headerAction,
  children,
}: OutreachSetupSectionCardProps) => (
  <Section>
    <StyledHeaderRow>
      <StyledHeaderMain>
        <H2Title
          title={title}
          description={description}
          adornment={headerAdornment}
        />
      </StyledHeaderMain>
      {headerAction !== undefined && headerAction !== null && (
        <StyledHeaderAction>{headerAction}</StyledHeaderAction>
      )}
    </StyledHeaderRow>
    <StyledContent>{children}</StyledContent>
  </Section>
);
