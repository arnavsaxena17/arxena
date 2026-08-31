import { styled } from '@linaria/react';
import { type ReactNode } from 'react';
import { Card, CardContent } from 'twenty-ui/surfaces';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

const StyledCardInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

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
  <Card rounded fullWidth>
    <CardContent>
      <StyledCardInner>
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
        {children}
      </StyledCardInner>
    </CardContent>
  </Card>
);
